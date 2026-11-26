/**
 * PGFPlots emitter ("a matplot2tikz for this viewer"). Input: the figure spec captured from the
 * plot wrappers while a panel rendered (marks with their data and channel accessors, resolved
 * scales, plot geometry). Output: a tikzpicture with one axis (or groupplot) per Plot, data in
 * tab-separated files at full float64 precision, and \addplot graphics only for layers above the
 * TeX size threshold. No second plotting implementation: channel accessors are evaluated exactly
 * as the screen marks evaluate them.
 */
import { confidenceInterval } from 'svelteplot/helpers/math.js'
import type { MarkSpec, PlotSpec } from '../plot/spec'
import { linregress } from '../transforms/stats'
import { boxStats } from '../transforms/box'
import { num, short, tex } from './escape'
import { okabeItoNames } from '../ui/palette'

/** Per layer, above this many points the layer becomes \addplot graphics. Measured: LuaLaTeX
 * compiles 20,000 marks in one axis in ~12 s and 80,000 in ~44 s (docs/decisions/0003). */
export const TEX_MAX_POINTS = 20_000
/** pdfLaTeX's fixed main memory: 5,000 marks per picture compile, 8,000 fail (measured). */
export const PDFLATEX_MAX_POINTS = 5_000
/** layout px -> pt (exports lay out at 5.6 px/mm) */
export const PX_TO_PT = 72 / 25.4 / 5.6
const PX_TO_MM = 1 / 5.6

export interface Geometry {
  /** plot svg box relative to the figure (layout px) */
  left: number
  top: number
  width: number
  height: number
  marginLeft: number
  marginTop: number
  marginRight: number
  marginBottom: number
}

export interface EmitPlot {
  spec: PlotSpec
  geom: Geometry
  /** raster layers present in this plot (canvas re-rendered at export dpi), already cropped to the axis box */
  rasterPng?: (markIndex: number) => Promise<string | null>
}

export interface EmitOptions {
  name: string
  fontPt: number
  downsample: boolean
  texMax?: number
}

export interface EmitResult {
  picture: string
  colors: Map<string, string>
  files: Record<string, string>
  images: { name: string; dataUrl: string }[]
  notes: string[]
  libraries: Set<string>
  tikzLibraries: Set<string>
  rasterised: string[]
  /** data rows written (≈ points TeX has to draw) */
  points: number
  pdflatexOk: boolean
}

type Acc = (d: any, i: number) => unknown

/** Channel accessor with SveltePlot semantics: field name, function, or constant. */
export function accessor(v: unknown, data?: any[]): Acc | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'function') return v as Acc
  if (typeof v === 'string' && data && data.length && v in (data[0] ?? {})) return (d) => d[v]
  if (typeof v === 'string' && data && data.length && typeof data[0] === 'object') return () => v // constant (e.g. a colour)
  if (typeof v === 'string') return (d) => (d && typeof d === 'object' && v in d ? d[v] : v)
  return () => v
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', gray: '#808080', grey: '#808080', skyblue: '#87ceeb', orange: '#ffa500', green: '#008000', coral: '#ff7f50', lightcoral: '#f08080', dodgerblue: '#1e90ff', lightblue: '#add8e6', blue: '#0000ff', purple: '#800080', none: 'none',
}
let ctx2d: CanvasRenderingContext2D | null = null
let varScope: Element | null = null
/** CSS variables (theme tokens) resolve against this element: the export root (print theme). */
export function setVarScope(el: Element | null) {
  varScope = el
}
export function cssToHex(c: string): string | null {
  const v = /^var\((--[A-Za-z0-9-]+)\)$/.exec(c.trim())
  if (v) {
    const el = varScope ?? (typeof document !== 'undefined' ? document.documentElement : null)
    const r = el ? getComputedStyle(el).getPropertyValue(v[1]).trim() : ''
    return r ? cssToHex(r) : '#1b1f27'
  }
  const s = c.trim().toLowerCase()
  if (s === 'none' || s === 'transparent') return null
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((x) => x + x).join('')
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7)
  if (s in NAMED) return NAMED[s]
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s)
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')
  if (typeof document !== 'undefined') {
    ctx2d ??= document.createElement('canvas').getContext('2d')
    if (ctx2d) {
      // an invalid colour leaves fillStyle unchanged: detect it with a sentinel
      ctx2d.fillStyle = '#010203'
      ctx2d.fillStyle = s
      const r = String(ctx2d.fillStyle)
      if (r === '#010203') return null
      if (r.startsWith('#')) return r
      return cssToHex(r)
    }
  }
  return null
}

function isColor(v: unknown): v is string {
  return typeof v === 'string' && (/^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgba?\(/.test(v) || v.toLowerCase() in NAMED || v.startsWith('var(') || /^[a-z]+$/.test(v) && cssToHex(v) !== null && !/^\d/.test(v))
}

class Ctx {
  colors = new Map<string, string>()
  files: Record<string, string> = {}
  images: { name: string; dataUrl: string }[] = []
  notes: string[] = []
  libs = new Set<string>()
  tlibs = new Set<string>()
  rasterised: string[] = []
  seq = 0
  points = 0
  constructor(readonly opt: EmitOptions) {}
  color(c: string | null | undefined, fallback = '#333333'): string {
    const hex = (c && cssToHex(c)) || fallback
    const key = hex.toUpperCase()
    let n = this.colors.get(key)
    if (!n) {
      n = okabeItoNames[key] ?? `pkvc${this.colors.size + 1}`
      this.colors.set(key, n)
    }
    return n
  }
  file(prefix: string, header: string[], rows: unknown[][]): string {
    const name = `data/${this.opt.name}-${prefix}-${++this.seq}.dat`
    this.points += rows.length
    this.files[name] = header.join('\t') + '\n' + rows.map((r) => r.map(num).join('\t')).join('\n') + '\n'
    return name
  }
}

interface AxisScale {
  kind: 'linear' | 'log' | 'symlog' | 'band'
  domain: number[]
  categories?: string[]
  reverse?: boolean
}

function axisScale(spec: PlotSpec, key: 'x' | 'y'): AxisScale {
  const s = spec.scales[key]
  if (!s) return { kind: 'linear', domain: [0, 1] }
  if (s.type === 'band' || s.type === 'point' || s.type === 'ordinal') {
    const categories = (s.domain as unknown[]).map(String)
    return { kind: 'band', domain: [-0.5, categories.length - 0.5], categories }
  }
  const d = (s.domain as unknown[]).map(Number)
  const reverse = d[0] > d[d.length - 1]
  const lo = Math.min(...d)
  const hi = Math.max(...d)
  const kind = s.type === 'log' ? 'log' : s.type === 'symlog' ? 'symlog' : 'linear'
  return { kind, domain: [lo, hi], reverse }
}

function coord(sc: AxisScale, v: unknown): number {
  if (sc.kind === 'band') return sc.categories!.indexOf(String(v))
  if (v === null || v === undefined || v === '') return NaN
  return Number(v)
}

function dash(v: unknown): string {
  if (typeof v !== 'string' || v === 'none' || !v.trim()) return ''
  const parts = v.trim().split(/[\s,]+/).map(Number)
  const seg: string[] = []
  for (let i = 0; i < parts.length; i += 2) seg.push(`on ${(parts[i] * PX_TO_PT).toFixed(2)}pt off ${((parts[i + 1] ?? parts[i]) * PX_TO_PT).toFixed(2)}pt`)
  return `dash pattern=${seg.join(' ')}`
}

const constNum = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Largest-triangle-three-buckets downsampling (only when the user enables it). */
export function lttb(xs: number[], ys: number[], n: number): number[] {
  const L = xs.length
  if (n >= L || n < 3) return xs.map((_, i) => i)
  const out = [0]
  const every = (L - 2) / (n - 2)
  let a = 0
  for (let i = 0; i < n - 2; i++) {
    const s0 = Math.floor((i + 1) * every) + 1
    const s1 = Math.min(Math.floor((i + 2) * every) + 1, L)
    let ax = 0
    let ay = 0
    for (let j = s0; j < s1; j++) {
      ax += xs[j]
      ay += ys[j]
    }
    ax /= Math.max(1, s1 - s0)
    ay /= Math.max(1, s1 - s0)
    const r0 = Math.floor(i * every) + 1
    const r1 = Math.floor((i + 1) * every) + 1
    let best = r0
    let bestA = -1
    for (let j = r0; j < r1; j++) {
      const area = Math.abs((xs[a] - ax) * (ys[j] - ys[a]) - (xs[a] - xs[j]) * (ay - ys[a]))
      if (area > bestA) {
        bestA = area
        best = j
      }
    }
    out.push(best)
    a = best
  }
  out.push(L - 1)
  return out
}

/** Positive / negative polygons between y1 and y2 (sign changes interpolated linearly, as on screen). */
export function differencePolygons(xs: number[], y1: number[], y2: number[]): { sign: 1 | -1; pts: [number, number][] }[] {
  const out: { sign: 1 | -1; pts: [number, number][] }[] = []
  let cur: { sign: 1 | -1; top: [number, number][]; bot: [number, number][] } | null = null
  const close = () => {
    if (cur && cur.top.length > 1) out.push({ sign: cur.sign, pts: [...cur.top, ...cur.bot.reverse()] })
    cur = null
  }
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const a = y1[i]
    const b = y2[i]
    if (![x, a, b].every(Number.isFinite)) {
      close()
      continue
    }
    const s: 1 | -1 = b >= a ? 1 : -1
    if (cur && cur.sign !== s) {
      // interpolate the crossing between i-1 and i
      const xp = xs[i - 1]
      const dp = y2[i - 1] - y1[i - 1]
      const dc = b - a
      const t = dp / (dp - dc)
      const xc = xp + t * (x - xp)
      const yc = y1[i - 1] + t * (a - y1[i - 1])
      cur.top.push([xc, yc])
      cur.bot.push([xc, yc])
      close()
      cur = { sign: s, top: [[xc, yc]], bot: [[xc, yc]] }
    }
    cur ??= { sign: s, top: [], bot: [] }
    cur.top.push([x, b])
    cur.bot.push([x, a])
  }
  close()
  return out
}

function facetValues(spec: PlotSpec, key: 'fx' | 'fy'): unknown[] | null {
  const s = spec.scales[key]
  if (!s || !s.domain?.length) return null
  return s.domain as unknown[]
}

/** Emit every plot of a figure into one tikzpicture. */
export async function emitFigure(plots: EmitPlot[], opt: EmitOptions): Promise<EmitResult> {
  const c = new Ctx(opt)
  const texMax = opt.texMax ?? TEX_MAX_POINTS
  const body: string[] = []
  for (const p of plots) body.push(await emitPlot(p, c, texMax))
  const fs = opt.fontPt
  const picture =
    `\\begin{tikzpicture}[font=\\fontsize{${fs}}{${(fs * 1.2).toFixed(1)}}\\selectfont]\n` +
    `\\pgfplotsset{every axis/.append style={font=\\fontsize{${fs}}{${(fs * 1.2).toFixed(1)}}\\selectfont, tick label style={font=\\fontsize{${(fs * 0.875).toFixed(2)}}{${(fs * 1.05).toFixed(1)}}\\selectfont, /pgf/number format/assume math mode=true}, legend style={font=\\fontsize{${(fs * 0.875).toFixed(2)}}{${(fs * 1.05).toFixed(1)}}\\selectfont}, clip mode=individual}}\n` +
    body.join('\n') +
    '\\end{tikzpicture}\n'
  if (c.points > PDFLATEX_MAX_POINTS) c.notes.push(`${c.points.toLocaleString('en')} data points: compile with LuaLaTeX (pdfLaTeX's fixed memory handles about ${PDFLATEX_MAX_POINTS.toLocaleString('en')}).`)
  return { picture, colors: c.colors, files: c.files, images: c.images, notes: c.notes, libraries: c.libs, tikzLibraries: c.tlibs, rasterised: c.rasterised, points: c.points, pdflatexOk: c.points <= PDFLATEX_MAX_POINTS }
}

async function emitPlot(p: EmitPlot, c: Ctx, texMax: number): Promise<string> {
  const { spec, geom } = p
  const o = spec.options()
  const X = axisScale(spec, 'x')
  const Y = axisScale(spec, 'y')
  const fxv = facetValues(spec, 'fx')
  const fyv = facetValues(spec, 'fy')
  const nx = fxv?.length ?? 1
  const ny = fyv?.length ?? 1
  const innerW = geom.width - geom.marginLeft - geom.marginRight
  const innerH = geom.height - geom.marginTop - geom.marginBottom
  const fxs = spec.scales.fx?.fn as any
  const fys = spec.scales.fy?.fn as any
  const cellW = fxv && fxs?.bandwidth ? fxs.bandwidth() : innerW
  const cellH = fyv && fys?.bandwidth ? fys.bandwidth() : innerH
  const step = (fn: any, vals: unknown[] | null, size: number) => (vals && vals.length > 1 && fn ? fn(vals[1]) - fn(vals[0]) - size : 0)
  const hsep = step(fxs, fxv, cellW)
  const vsep = step(fys, fyv, cellH)

  const axisOpts: string[] = ['scale only axis', `width=${(cellW * PX_TO_MM).toFixed(2)}mm`, `height=${(cellH * PX_TO_MM).toFixed(2)}mm`, 'unbounded coords=jump', 'axis line style={draw=black!60}', 'tick style={draw=black!60}', 'clip=true']
  const optX = (o.x ?? {}) as Record<string, any>
  const optY = (o.y ?? {}) as Record<string, any>
  const lab = (k: 'x' | 'y', oo: Record<string, any>) => {
    if (oo.label === false || oo.axis === false) return ''
    const l = typeof oo.label === 'string' ? oo.label : (spec.scales[k]?.label ?? '')
    return l ? `${k}label={${tex(l)}}` : ''
  }
  for (const [k, S, oo] of [['x', X, optX], ['y', Y, optY]] as const) {
    if (oo.axis === false) axisOpts.push(`hide ${k} axis`)
    const l = lab(k, oo)
    if (l) axisOpts.push(l)
    if (S.kind === 'band') {
      axisOpts.push(`${k}min=-0.5`, `${k}max=${short(S.categories!.length - 0.5)}`, `${k}tick={${S.categories!.map((_, i) => i).join(',')}}`, `${k}ticklabels={${S.categories!.map((s) => `{${tex(s)}}`).join(',')}}`, `${k}tick style={draw=none}`)
      if (k === 'x') axisOpts.push('x tick label style={rotate=0}')
      if (k === 'y') axisOpts.push('y dir=reverse')
      continue
    }
    const [lo, hi] = S.domain
    if (S.kind === 'log') axisOpts.push(`${k}mode=log`)
    if (S.kind === 'symlog') {
      // d3 scaleSymlog with the plot's constant C: sign(x)·ln(1+|x|/C); evaluated with the PGF
      // floating point unit (fixed-point TeX math overflows above 16383)
      const C = Number(oo.constant ?? 1) || 1
      const fpu = (expr: string) => `{\\begingroup\\pgfkeys{/pgf/fpu=true,/pgf/fpu/output format=fixed}\\pgfmathparse{${expr}}\\pgfmathsmuggle\\pgfmathresult\\endgroup}`
      axisOpts.push(`${k} coord trafo/.code=${fpu(`sign(#1)*ln(1+abs(#1)/${C})`)}`, `${k} coord inv trafo/.code=${fpu(`sign(#1)*${C}*(exp(abs(#1))-1)`)}`)
    }
    axisOpts.push(`${k}min=${short(lo)}`, `${k}max=${short(hi)}`)
    if (S.reverse) axisOpts.push(`${k} dir=reverse`)
    const ticks = Array.isArray(oo.ticks) ? oo.ticks.map(Number).filter((t: number) => t >= lo && t <= hi) : null
    if (ticks?.length) {
      axisOpts.push(`${k}tick={${ticks.map(short).join(',')}}`)
      if (typeof oo.tickFormat === 'function') axisOpts.push(`${k}ticklabels={${ticks.map((t: number, i: number) => `{${tex(String(oo.tickFormat(t, i, ticks)))}}`).join(',')}}`)
      else if (S.kind === 'symlog') axisOpts.push(`${k}ticklabels={${ticks.map((t: number) => (t >= 1000 ? `${t / 1000}K` : short(t))).join(',')}}`)
    } else if (S.kind === 'symlog') {
      axisOpts.push(`${k}tick={0,1,10,100,1000}`, `${k}ticklabels={0,1,10,100,1K}`)
    }
    if (S.kind === 'linear') axisOpts.push(`scaled ${k} ticks=false`, `${k}ticklabel style={/pgf/number format/fixed, /pgf/number format/precision=3}`)
  }
  if (o.grid || optX.grid) axisOpts.push('xmajorgrids')
  if (o.grid || optY.grid) axisOpts.push('ymajorgrids')
  if (o.grid || optX.grid || optY.grid) axisOpts.push('grid style={draw=black!12}')
  const colorOpt = (o.color ?? {}) as Record<string, any>
  const cscale = spec.scales.color
  const continuous = !!cscale && !['ordinal', 'categorical', 'band', 'point'].includes(cscale.type)
  if (continuous && cscale) {
    const name = `pkvmap${++c.seq}`
    const fn = cscale.fn as (v: number) => string
    const d = (cscale.domain as number[]).map(Number)
    const stops: string[] = []
    for (let i = 0; i <= 10; i++) {
      const t = d[0] + ((d[d.length - 1] - d[0]) * i) / 10
      const h = cssToHex(String(fn(t))) ?? '#000000'
      stops.push(`rgb255=(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})`)
    }
    axisOpts.push(`colormap={${name}}{${stops.join(' ')}}`, `point meta min=${short(Math.min(...d))}`, `point meta max=${short(Math.max(...d))}`)
    if (colorOpt.legend) axisOpts.push(`colorbar`, `colorbar style={ylabel={${tex(colorOpt.label ?? '')}}, width=2mm}`)
    c.libs.add('colormaps')
  }
  if (typeof o.title === 'string' && o.title) axisOpts.push(`title={${tex(o.title)}}`)
  if (colorOpt.legend && !continuous) axisOpts.push('legend style={draw=none, fill=none, at={(0.5,1.02)}, anchor=south, legend columns=-1, /tikz/every even column/.append style={column sep=2mm}}', 'legend cell align=left')

  const ox = (geom.left + geom.marginLeft) * PX_TO_MM
  const oy = (geom.top + geom.marginTop) * PX_TO_MM
  const cells: { fx: unknown; fy: unknown; title: string }[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cells.push({ fx: fxv?.[i], fy: fyv?.[j], title: [fxv ? String(fxv[i]) : '', fyv ? String(fyv[j]) : ''].filter(Boolean).join(' · ') })
  const legendSeen = new Set<string>()
  const lines: string[] = []
  if (cells.length > 1) {
    c.libs.add('groupplots')
    lines.push(`\\begin{scope}[shift={(${ox.toFixed(2)}mm,${(-oy).toFixed(2)}mm)}]`)
    lines.push(`\\begin{groupplot}[group style={group size=${nx} by ${ny}, horizontal sep=${(hsep * PX_TO_MM).toFixed(2)}mm, vertical sep=${(vsep * PX_TO_MM).toFixed(2)}mm, xlabels at=edge bottom, ylabels at=edge left, yticklabels at=edge left}, ${axisOpts.join(', ')}, anchor=north west]`)
    for (const cell of cells) {
      lines.push(`\\nextgroupplot[title={${tex(cell.title)}}]`)
      // facet titles already name the category: no per-cell legends
      for (let mi = 0; mi < spec.marks.length; mi++) lines.push(...(await emitMark(spec.marks[mi], mi, p, c, X, Y, cell, legendSeen, texMax, false)))
    }
    lines.push('\\end{groupplot}')
    lines.push('\\end{scope}')
  } else {
    lines.push(`\\begin{scope}[shift={(${ox.toFixed(2)}mm,${(-oy).toFixed(2)}mm)}]`)
    lines.push(`\\begin{axis}[${axisOpts.join(', ')}, at={(0,0)}, anchor=north west]`)
    for (let mi = 0; mi < spec.marks.length; mi++) lines.push(...(await emitMark(spec.marks[mi], mi, p, c, X, Y, { fx: undefined, fy: undefined }, legendSeen, texMax, !!colorOpt.legend)))
    lines.push('\\end{axis}')
    lines.push('\\end{scope}')
  }
  return lines.join('\n')
}

function inCell(props: Record<string, any>, data: any[], cell: { fx: unknown; fy: unknown }): any[] {
  let out = data
  const fx = accessor(props.fx, data)
  const fy = accessor(props.fy, data)
  if (cell.fx !== undefined && fx) out = out.filter((d, i) => String(fx(d, i)) === String(cell.fx))
  if (cell.fy !== undefined && fy) out = out.filter((d, i) => String(fy(d, i)) === String(cell.fy))
  if (typeof props.filter === 'function') out = out.filter(props.filter)
  return out
}

function resolveColor(v: unknown, plot: PlotSpec): string | null {
  if (v === null || v === undefined) return null
  if (isColor(v)) return String(v)
  const fn = plot.scales.color?.fn as ((x: unknown) => unknown) | undefined
  if (fn) {
    const r = fn(v)
    if (typeof r === 'string') return r
  }
  return null
}

function styleOf(props: Record<string, any>, c: Ctx, colorHex: string | null, kind: 'line' | 'fill' | 'mark'): string[] {
  const s: string[] = []
  const col = c.color(colorHex)
  if (kind === 'line') {
    s.push(`color=${col}`, `line width=${(constNum(props.strokeWidth, 1.5) * PX_TO_PT).toFixed(2)}pt`)
    const d = dash(props.strokeDasharray)
    if (d) s.push(d)
    const op = constNum(props.strokeOpacity, constNum(props.opacity, 1))
    if (op < 1) s.push(`draw opacity=${op}`)
    if (props.curve === 'step-after') s.push('const plot mark left')
    else if (props.curve === 'step-before') s.push('const plot mark right')
    else if (props.curve === 'step') s.push('const plot mark mid')
  } else if (kind === 'fill') {
    s.push(`fill=${col}`, 'draw=none')
    const op = constNum(props.fillOpacity, constNum(props.opacity, 1))
    if (op < 1) s.push(`fill opacity=${op}`)
  }
  return s
}

async function emitMark(m: MarkSpec, mi: number, p: EmitPlot, c: Ctx, X: AxisScale, Y: AxisScale, cell: { fx: unknown; fy: unknown }, legendSeen: Set<string>, texMax: number, legend: boolean): Promise<string[]> {
  const props = m.props()
  const out: string[] = []
  const all: any[] = Array.isArray(props.data) ? props.data : []
  const data = inCell(props, all, cell)
  const ax = (k: string, fallback?: string) => accessor(props[k] ?? fallback, all)
  const tag = `${m.kind.toLowerCase()}${mi}`
  const legendEntry = (key: string | null) => {
    if (!legend || key === null || legendSeen.has(key)) return 'forget plot'
    legendSeen.add(key)
    return ''
  }
  switch (m.kind) {
    case 'Line': {
      const x = ax('x')!
      const y = ax('y')!
      const z = ax('z') ?? null
      const stroke = props.stroke
      const sAcc = accessor(stroke, all)
      const groups = new Map<string, any[]>()
      data.forEach((d, i) => {
        const k = z ? String(z(d, i)) : sAcc && !isColor(stroke) ? String(sAcc(d, i)) : '_'
        ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(d)
      })
      let total = 0
      for (const g of groups.values()) total += g.length
      if (total > texMax && !c.opt.downsample) return rasterLayer(m, mi, p, c, total)
      for (const [k, g] of groups) {
        const sv = sAcc ? sAcc(g[0], 0) : null
        const colHex = resolveColor(sv ?? '#333333', p.spec)
        let pts = g.map((d, i) => [coord(X, x(d, i)), coord(Y, y(d, i))])
        if (props.sort == null) pts.sort((a, b) => a[0] - b[0])
        if (total > texMax && c.opt.downsample) {
          const keep = lttb(pts.map((q) => q[0]), pts.map((q) => q[1]), Math.max(3, Math.floor((g.length * texMax) / total)))
          pts = keep.map((i) => pts[i])
        }
        const f = c.file(tag, ['x', 'y'], pts)
        const key = sAcc && !isColor(stroke) && sv != null && !isColor(sv) ? String(sv) : null
        const extra = legendEntry(key)
        out.push(`\\addplot[no markers, ${styleOf(props, c, colHex, 'line').join(', ')}${extra ? ', ' + extra : ''}] table[x=x,y=y] {${f}};${!extra && key ? `\n\\addlegendentry{${tex(key)}}` : ''} % ${tex(k)}`)
      }
      if (total > texMax && c.opt.downsample) c.notes.push(`${m.kind} layer downsampled for TeX with largest-triangle-three-buckets (${total} → ≤ ${texMax} points).`)
      return out
    }
    case 'Dot':
    case 'CustomMark': {
      const x = ax('x')!
      const y = ax('y')!
      if (data.length > texMax && !c.opt.downsample) return rasterLayer(m, mi, p, c, data.length)
      const fillV = props.fill ?? (m.kind === 'CustomMark' ? '#d62728' : null)
      const strokeV = props.stroke
      const colAcc = accessor(fillV ?? strokeV ?? '#333333', all)!
      const r = constNum(props.r, 3)
      const glyph = m.glyph ?? (props.symbol === 'square' ? 'square*' : props.symbol === 'times' ? 'x' : fillV ? '*' : 'o')
      const mark = m.kind === 'CustomMark' ? ({ ring: 'o', cross: 'x', triangle: 'triangle*' } as Record<string, string>)[m.glyph ?? ''] ?? 'o' : glyph
      const cscale = p.spec.scales.color
      const continuous = !!cscale && !['ordinal', 'categorical', 'band', 'point'].includes(cscale.type)
      const vals = data.map((d, i) => colAcc(d, i))
      if (continuous && vals.some((v) => typeof v === 'number')) {
        const f = c.file(tag, ['x', 'y', 'meta'], data.map((d, i) => [coord(X, x(d, i)), coord(Y, y(d, i)), Number(vals[i])]))
        out.push(`\\addplot[scatter, only marks, mark=${mark}, mark size=${(r * PX_TO_PT).toFixed(2)}pt, point meta=explicit, scatter/use mapped color={draw=black!60, fill=mapped color}, forget plot] table[x=x,y=y,meta=meta] {${f}};`)
        return out
      }
      const groups = new Map<string, any[][]>()
      data.forEach((d, i) => {
        const v = vals[i]
        const k = String(v)
        ;(groups.get(k) ?? groups.set(k, []).get(k)!).push([coord(X, x(d, i)), coord(Y, y(d, i))])
      })
      const op = constNum(props.fillOpacity, constNum(props.opacity, 1))
      for (const [k, pts] of groups) {
        const colHex = resolveColor(k === 'undefined' ? '#333333' : k, p.spec)
        const col = c.color(colHex)
        const f = c.file(tag, ['x', 'y'], pts)
        const key = !isColor(k) && k !== 'undefined' ? k : null
        const extra = legendEntry(key)
        const filled = mark.endsWith('*')
        const edge = props.stroke && isColor(props.stroke) ? `, mark options={line width=${(constNum(props.strokeWidth, 1) * PX_TO_PT).toFixed(2)}pt}` : `, mark options={line width=${(0.5 * PX_TO_PT).toFixed(2)}pt}`
        out.push(`\\addplot[only marks, mark=${mark}, mark size=${(r * PX_TO_PT).toFixed(2)}pt, ${filled ? `fill=${col}, draw=${props.stroke && isColor(props.stroke) ? c.color(props.stroke) : col}` : `draw=${col}`}${op < 1 ? `, opacity=${op}` : ''}${edge}${extra ? ', ' + extra : ''}] table[x=x,y=y] {${f}};${!extra && key ? `\n\\addlegendentry{${tex(key)}}` : ''}`)
      }
      return out
    }
    case 'AreaY': {
      // band = closed polygon: upper edge forward, lower edge backward (vertices are the data;
      // PGFPlots' fillbetween is not used: its layers break inside shifted groupplots)
      const x = ax('x')!
      const y1 = ax('y1') ?? (() => 0)
      const y2 = ax('y2') ?? ax('y')!
      const z = ax('z')
      const fillAcc = accessor(props.fill ?? '#999999', all)!
      const groups = new Map<string, any[]>()
      data.forEach((d, i) => {
        const k = z ? String(z(d, i)) : '_'
        ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(d)
      })
      for (const [, g] of groups) {
        const pts = g.map((d, i) => [coord(X, x(d, i)), Number(y1(d, i)), Number(y2(d, i))]).sort((a, b) => a[0] - b[0])
        // split at gaps (nulls are gaps)
        const segs: number[][][] = [[]]
        for (const q of pts) {
          if (q.every(Number.isFinite)) segs[segs.length - 1].push(q)
          else if (segs[segs.length - 1].length) segs.push([])
        }
        const colHex = resolveColor(fillAcc(g[0], 0), p.spec)
        for (const s of segs.filter((s) => s.length > 1)) {
          const poly = [...s.map((q) => [q[0], q[2]]), ...[...s].reverse().map((q) => [q[0], q[1]])]
          const f = c.file(tag, ['x', 'y'], poly)
          out.push(`\\addplot[${styleOf(props, c, colHex, 'fill').join(', ')}, forget plot] table[x=x,y=y] {${f}} -- cycle;`)
        }
      }
      return out
    }
    case 'DifferenceY': {
      const x = ax('x')!
      const y1 = ax('y1')!
      const y2 = ax('y2')!
      const pts = data.map((d, i) => [coord(X, x(d, i)), Number(y1(d, i)), Number(y2(d, i))]).sort((a, b) => a[0] - b[0])
      const polys = differencePolygons(pts.map((q) => q[0]), pts.map((q) => q[1]), pts.map((q) => q[2]))
      const op = constNum(props.fillOpacity, 1)
      for (const poly of polys) {
        const col = c.color(poly.sign > 0 ? (props.positiveFill ?? 'red') : (props.negativeFill ?? 'blue'))
        const f = c.file(`${tag}-${poly.sign > 0 ? 'pos' : 'neg'}`, ['x', 'y'], poly.pts)
        out.push(`\\addplot[fill=${col}, draw=none${op < 1 ? `, fill opacity=${op}` : ''}, forget plot] table[x=x,y=y] {${f}} -- cycle;`)
      }
      return out
    }
    case 'BoxY': {
      c.libs.add('statistics')
      const x = ax('x')!
      const y = ax('y')!
      const groups = new Map<string, number[]>()
      data.forEach((d, i) => {
        const k = String(x(d, i))
        ;(groups.get(k) ?? groups.set(k, []).get(k)!).push(Number(y(d, i)))
      })
      const fillCol = c.color(isColor(props.fill) ? props.fill : '#bcd4ec')
      for (const [k, v] of groups) {
        const b = boxStats(v)
        const pos = coord(X, k)
        const f = c.file(tag, ['y'], b.outliers.map((o) => [o]))
        out.push(`\\addplot+[forget plot, solid, draw=black, fill=${fillCol}, mark=*, mark size=0.8pt, mark options={fill=${fillCol}, draw=${fillCol}}, boxplot prepared={draw direction=y, draw position=${pos}, lower whisker=${num(b.whiskerLow)}, lower quartile=${num(b.q1)}, median=${num(b.median)}, upper quartile=${num(b.q3)}, upper whisker=${num(b.whiskerHigh)}, box extend=0.6}] table[y=y] {${f}};`)
      }
      return out
    }
    case 'RuleX':
    case 'RuleY': {
      const isX = m.kind === 'RuleX'
      const pos = accessor(props[isX ? 'x' : 'y'] ?? ((d: unknown) => d), all)!
      const a1 = ax(isX ? 'y1' : 'x1')
      const a2 = ax(isX ? 'y2' : 'x2')
      const S = isX ? X : Y
      const O = isX ? Y : X
      const rows: number[][] = []
      const items = all.length ? data : [null]
      items.forEach((d, i) => {
        const v = coord(S, all.length ? pos(d, i) : props[isX ? 'x' : 'y'])
        const lo = a1 ? coord(O, a1(d, i)) : O.domain[0]
        const hi = a2 ? coord(O, a2(d, i)) : O.domain[1]
        if (!Number.isFinite(v)) return
        rows.push(isX ? [v, lo] : [lo, v], isX ? [v, hi] : [hi, v], [NaN, NaN])
      })
      if (!rows.length) return out
      const col = c.color(isColor(props.stroke) ? props.stroke : '#333333')
      const f = c.file(tag, ['x', 'y'], rows)
      out.push(`\\addplot[no markers, forget plot, color=${col}, line width=${(constNum(props.strokeWidth, 1) * PX_TO_PT).toFixed(2)}pt${dash(props.strokeDasharray) ? ', ' + dash(props.strokeDasharray) : ''}] table[x=x,y=y] {${f}};`)
      return out
    }
    case 'RegressionY': {
      const x = ax('x')!
      const y = ax('y')!
      const xs: number[] = []
      const ys: number[] = []
      data.forEach((d, i) => {
        const a = Number(x(d, i))
        const b = Number(y(d, i))
        if (Number.isFinite(a) && Number.isFinite(b)) {
          xs.push(a)
          ys.push(b)
        }
      })
      if (xs.length < 2) return out
      const lr = linregress(xs, ys)
      const predict = (v: number) => lr.intercept + lr.slope * v
      const lo = Math.min(...xs)
      const hi = Math.max(...xs)
      const grid = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40)
      const col = c.color(isColor(props.stroke) ? props.stroke : '#000000')
      const conf = props.confidence === false ? null : constNum(props.confidence, 0.99)
      if (conf !== null && xs.length > 2) {
        const band = confidenceInterval(xs.map((v, i) => ({ x: v, y: ys[i] })), predict, 1 - conf)
        const bands = grid.map((g) => band(g))
        const poly = [...bands.map((b) => [b.x, b.right]), ...[...bands].reverse().map((b) => [b.x, b.left])]
        const f = c.file(`${tag}-ci`, ['x', 'y'], poly)
        out.push(`% ${Math.round(conf * 100)} % confidence band (analytic, same formula as the viewer)`, `\\addplot[fill=${col}, fill opacity=0.15, draw=none, forget plot] table[x=x,y=y] {${f}} -- cycle;`)
      }
      const f = c.file(tag, ['x', 'y'], grid.map((g) => [g, predict(g)]))
      out.push(`\\addplot[no markers, forget plot, color=${col}, line width=${(1.5 * PX_TO_PT).toFixed(2)}pt] table[x=x,y=y] {${f}}; % OLS: slope ${num(lr.slope)}, intercept ${num(lr.intercept)}`)
      return out
    }
    case 'Vector': {
      c.tlibs.add('calc')
      c.tlibs.add('arrows.meta')
      const col = c.color(isColor(props.stroke) ? props.stroke : '#444444')
      const L = (typeof props.length === 'function' ? Number(props.length({})) : constNum(props.length, 12)) * PX_TO_PT
      for (const d of data) {
        if (!('x1' in d)) continue
        // fixed screen length along the drawn direction (pixel space), centred on the segment midpoint
        out.push(`\\draw[-{Stealth[length=${(L * 0.35).toFixed(2)}pt]}, ${col}, line width=${(1 * PX_TO_PT).toFixed(2)}pt] ($(axis cs:${num(d.x)},${num(d.y)})!${(-L / 2).toFixed(2)}pt!(axis cs:${num(d.x1)},${num(d.y1)})$) -- ($(axis cs:${num(d.x)},${num(d.y)})!${(L / 2).toFixed(2)}pt!(axis cs:${num(d.x1)},${num(d.y1)})$);`)
      }
      return out
    }
    case 'Cell':
    case 'Raster': {
      const isCell = m.kind === 'Cell'
      const x = ax('x')!
      const y = ax('y')!
      const v = ax('fill')!
      if (data.length > texMax) return rasterLayer(m, mi, p, c, data.length)
      const xsAll = isCell ? (X.categories ?? []) : null
      const ysAll = isCell ? (Y.categories ?? []) : null
      const map = new Map<string, number>()
      data.forEach((d, i) => map.set(`${coord(X, x(d, i))}|${coord(Y, y(d, i))}`, Number(v(d, i))))
      const xi = isCell ? xsAll!.map((_, i) => i) : [...new Set(data.map((d, i) => coord(X, x(d, i))))].sort((a, b) => a - b)
      const yi = isCell ? ysAll!.map((_, i) => i) : [...new Set(data.map((d, i) => coord(Y, y(d, i))))].sort((a, b) => a - b)
      const rows: number[][] = []
      for (const yy of yi) for (const xx of xi) rows.push([xx, yy, map.get(`${xx}|${yy}`) ?? NaN])
      const f = c.file(tag, ['x', 'y', 'v'], rows)
      out.push(`% ${m.kind}: one cell per stored value; empty cells are nan (left blank, never coloured as 0)`, `\\addplot[matrix plot*, mesh/cols=${xi.length}, mesh/rows=${yi.length}, mesh/ordering=x varies, point meta=explicit, forget plot, unbounded coords=discard] table[x=x,y=y,meta=v] {${f}};`)
      return out
    }
    case 'BarX': {
      const x = ax('x')!
      const y = ax('y')!
      const fillAcc = accessor(props.fill ?? '#4682b4', all)!
      const groups = new Map<string, number[][]>()
      data.forEach((d, i) => {
        const k = String(fillAcc(d, i))
        ;(groups.get(k) ?? groups.set(k, []).get(k)!).push([Number(x(d, i)), coord(Y, y(d, i))])
      })
      const band = (p.spec.scales.y?.fn as any)?.bandwidth?.() ?? 10
      for (const [k, pts] of groups) {
        const col = c.color(resolveColor(k, p.spec))
        const f = c.file(tag, ['x', 'y'], pts)
        const key = !isColor(k) ? k : null
        const extra = legendEntry(key)
        out.push(`\\addplot[xbar, bar shift=0pt, bar width=${(band * PX_TO_PT).toFixed(2)}pt, fill=${col}, draw=${props.stroke && isColor(props.stroke) ? c.color(props.stroke) : 'none'}${extra ? ', ' + extra : ''}] table[x=x,y=y] {${f}};${!extra && key ? `\n\\addlegendentry{${tex(key)}}` : ''}`)
      }
      return out
    }
    case 'RectY': {
      const x1 = ax('x1')!
      const x2 = ax('x2')!
      const y1 = ax('y1') ?? (() => 0)
      const y2 = ax('y2') ?? ax('y')!
      const rows: number[][] = []
      data.forEach((d, i) => {
        const a = Number(x1(d, i))
        const b = Number(x2(d, i))
        const lo = Number(typeof props.y1 === 'number' ? props.y1 : y1(d, i))
        const hi = Number(y2(d, i))
        rows.push([a, lo], [b, lo], [b, hi], [a, hi], [a, lo], [NaN, NaN])
      })
      const col = c.color(isColor(props.fill) ? props.fill : '#7aa6d6')
      const f = c.file(tag, ['x', 'y'], rows)
      out.push(`\\addplot[fill=${col}, draw=white, line width=0.4pt, forget plot] table[x=x,y=y] {${f}};`)
      return out
    }
    case 'Text': {
      const x = ax('x')!
      const y = ax('y')!
      const t = accessor(props.text, all)!
      const anchor = props.textAnchor === 'start' ? 'west' : props.textAnchor === 'end' ? 'east' : 'center'
      const dx = constNum(props.dx, 0) * PX_TO_PT
      const dy = -constNum(props.dy, 0) * PX_TO_PT
      const fs = constNum(props.fontSize, 0)
      for (const [i, d] of data.entries()) {
        const xv = coord(X, x(d, i))
        const yv = typeof props.y === 'number' ? props.y : coord(Y, y(d, i))
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue
        out.push(`\\node[anchor=${anchor}, inner sep=1pt, xshift=${dx.toFixed(2)}pt, yshift=${dy.toFixed(2)}pt${fs ? `, font=\\fontsize{${(fs * PX_TO_PT).toFixed(2)}}{${(fs * PX_TO_PT * 1.2).toFixed(2)}}\\selectfont` : ''}] at (axis cs:${num(xv)},${num(yv)}) {${tex(String(t(d, i)))}};`)
      }
      return out
    }
    case 'FastLines': {
      const xs = props.xs as Float64Array
      if (xs.length > texMax && !c.opt.downsample) return rasterLayer(m, mi, p, c, xs.length)
      const ys = props.ys as Float64Array
      const starts = props.starts as Int32Array
      const rows: number[][] = []
      for (let s = 0; s < starts.length; s++) {
        const a = starts[s]
        const b = s + 1 < starts.length ? starts[s + 1] : xs.length
        for (let i = a; i < b; i++) rows.push([xs[i], ys[i]])
        rows.push([NaN, NaN])
      }
      const f = c.file(tag, ['x', 'y'], rows)
      out.push(`\\addplot[no markers, forget plot, color=${c.color(props.stroke)}, draw opacity=${props.opacity}, line width=${(constNum(props.width, 0.6) * PX_TO_PT).toFixed(2)}pt] table[x=x,y=y] {${f}};`)
      return out
    }
    case 'Rect':
    case 'Brush':
      return out // interaction overlays: never exported
  }
  return out
}

async function rasterLayer(m: MarkSpec, mi: number, p: EmitPlot, c: Ctx, n: number): Promise<string[]> {
  const url = p.rasterPng ? await p.rasterPng(mi) : null
  if (!url) {
    c.notes.push(`${m.kind} layer with ${n} points exceeds the TeX limit and could not be rasterised; it is omitted.`)
    return [`% ${m.kind} layer omitted: ${n} points exceed the TeX limit (${TEX_MAX_POINTS}) and no raster was available`]
  }
  const name = `${c.opt.name}-layer${c.images.length ? `-${c.images.length + 1}` : ''}.png`
  c.images.push({ name, dataUrl: url })
  const X = axisScale(p.spec, 'x')
  const Y = axisScale(p.spec, 'y')
  c.rasterised.push(`${m.kind} (${n} points)`)
  c.notes.push(`Data layer (${m.kind}, ${n.toLocaleString('en')} points) embedded as a 600 dpi image (${name}): above the TeX limit of ${TEX_MAX_POINTS.toLocaleString('en')} points; axes and labels are PGFPlots.`)
  return [`% ${m.kind}: ${n} points > ${TEX_MAX_POINTS} (TeX memory) -> \\addplot graphics at 600 dpi; axes stay PGFPlots`, `\\addplot graphics[xmin=${short(X.domain[0])}, xmax=${short(X.domain[1])}, ymin=${short(Y.domain[0])}, ymax=${short(Y.domain[1])}] {${name}};`]
}
