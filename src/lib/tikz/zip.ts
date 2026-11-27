import { zipSync, strToU8 } from 'fflate'
import type { ExportTarget, Rendered } from '../export/render'
import type { ExportSettings, Provenance } from '../export/settings'
import { provenanceText } from '../export/settings'
import { fontBase64 } from '../export/fonts'
import type { PlotSpec } from '../plot/spec'
import { emitFigure, setVarScope, type EmitPlot, type EmitResult } from './emit'
import { tex } from './escape'

export const PGFPLOTS_COMPAT = '1.18'

/** Pixel extent [min, max] of a positional scale: from its range, else from fn at the domain ends. */
export function pixelExtent(sc: PlotSpec['scales'][string] | undefined): [number, number] | null {
  if (!sc) return null
  const r = (sc.range ?? []).map(Number).filter(Number.isFinite)
  if (r.length >= 2) return [Math.min(...r), Math.max(...r)]
  const d = sc.domain ?? []
  const fn = sc.fn as ((v: unknown) => number) | undefined
  if (fn && d.length) {
    const a = Number(fn(d[0]))
    const b = Number(fn(d[d.length - 1]))
    const bw = (fn as any).bandwidth?.() ?? 0
    if (Number.isFinite(a) && Number.isFinite(b)) return [Math.min(a, b), Math.max(a, b) + bw]
  }
  return null
}

function geometry(spec: PlotSpec, figure: HTMLElement) {
  const base = figure.getBoundingClientRect()
  const svg = spec.body?.querySelector('svg') ?? spec.body
  const r = svg?.getBoundingClientRect() ?? base
  const m = spec.margins ?? { left: 0, right: 0, top: 0, bottom: 0 }
  const fx = spec.scales.fx
  const fy = spec.scales.fy
  const fin = (v: number, d: number) => (Number.isFinite(v) ? v : d)
  let left = m.left
  let right = m.right
  let top = m.top
  let bottom = m.bottom
  const xe = pixelExtent(spec.scales.x)
  const ye = pixelExtent(spec.scales.y)
  if (fx) {
    const fe = pixelExtent(fx)
    if (fe && xe) {
      left = fe[0] + xe[0]
      right = r.width - (fe[1])
    }
  } else if (xe) {
    left = xe[0]
    right = r.width - xe[1]
  }
  if (fy) {
    const fe = pixelExtent(fy)
    if (fe && ye) {
      top = fe[0] + ye[0]
      bottom = r.height - fe[1]
    }
  } else if (ye) {
    top = ye[0]
    bottom = r.height - ye[1]
  }
  return { left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height, marginLeft: fin(left, m.left), marginRight: fin(right, m.right), marginTop: fin(top, m.top), marginBottom: fin(bottom, m.bottom) }
}

/** Crop a re-rendered raster layer (or paint a large mark) to the axis box at export resolution. */
function rasterFor(spec: PlotSpec, pixelRatio: number) {
  return async (markIndex: number): Promise<string | null> => {
    const mark = spec.marks[markIndex]
    const svg = spec.body?.querySelector('svg')
    if (!svg) return null
    const xe = pixelExtent(spec.scales.x)
    const ye = pixelExtent(spec.scales.y)
    if (!xe || !ye) return null
    const [x0, x1] = xe
    const [y0, y1] = ye
    const out = document.createElement('canvas')
    out.width = Math.round((x1 - x0) * pixelRatio)
    out.height = Math.round((y1 - y0) * pixelRatio)
    const ctx = out.getContext('2d')!
    const fo = mark.kind === 'FastLines' ? svg.querySelector<HTMLCanvasElement>('foreignObject[data-raster-layer] canvas') : null
    if (fo) {
      const k = fo.width / Number(fo.parentElement?.getAttribute('width') ?? fo.width)
      ctx.drawImage(fo, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, 0, 0, out.width, out.height)
      return out.toDataURL('image/png')
    }
    // generic painter for very large Line / Dot layers (drawn from the data at export resolution)
    const p = mark.props()
    const fx = spec.scales.x.fn as any
    const fy = spec.scales.y.fn as any
    const data: any[] = p.data ?? []
    const get = (k: string) => (typeof p[k] === 'function' ? p[k] : (d: any) => d[p[k]])
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, -x0 * pixelRatio, -y0 * pixelRatio)
    ctx.strokeStyle = typeof p.stroke === 'string' && p.stroke.startsWith('#') ? p.stroke : '#888'
    ctx.fillStyle = ctx.strokeStyle
    ctx.globalAlpha = typeof p.strokeOpacity === 'number' ? p.strokeOpacity : typeof p.opacity === 'number' ? p.opacity : 1
    ctx.lineWidth = typeof p.strokeWidth === 'number' ? p.strokeWidth : 1
    if (mark.kind === 'Line') {
      const z = p.z ? get('z') : () => '_'
      const groups = new Map<string, any[]>()
      for (const d of data) (groups.get(String(z(d))) ?? groups.set(String(z(d)), []).get(String(z(d)))!).push(d)
      ctx.beginPath()
      for (const g of groups.values()) g.forEach((d, i) => (i ? ctx.lineTo(fx(get('x')(d)), fy(get('y')(d))) : ctx.moveTo(fx(get('x')(d)), fy(get('y')(d)))))
      ctx.stroke()
    } else {
      const r = typeof p.r === 'number' ? p.r : 3
      for (const d of data) {
        ctx.beginPath()
        ctx.arc(fx(get('x')(d)), fy(get('y')(d)), r, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
    return out.toDataURL('image/png')
  }
}

export async function emitTarget(t: ExportTarget, r: Rendered, s: ExportSettings): Promise<EmitResult> {
  const name = t.id.replace(/[^A-Za-z0-9]+/g, '-')
  // only the plots of this figure: a comparison section is rendered inside the whole comparison view
  const plots: EmitPlot[] = r.collector.plots.filter((p) => p.body?.isConnected && r.figure.contains(p.body) && (p.body.querySelector('svg')?.getBoundingClientRect().width ?? 0) > 0).map((spec) => ({ spec, geom: geometry(spec, r.figure), rasterPng: rasterFor(spec, s.dpi / 142.24) }))
  if (!plots.length) throw new Error(`${t.title} has no plot to export as TikZ; use CSV for its table (or PDF/SVG).`)
  setVarScope(r.host.querySelector('[data-export-root]'))
  try {
    return await emitFigure(plots, { name, fontPt: s.fontPt, downsample: s.tikzDownsample })
  } finally {
    setVarScope(null)
  }
}

export function texHeader(t: ExportTarget, prov: Provenance, e: EmitResult): string {
  return [
    `% PhosKinTime-Vis PGFPlots export: ${t.title}`,
    `% panel_id: ${prov.panelId}`,
    `% bundle_id: ${prov.bundleIds.join(' vs ')}`,
    `% phoskintime_commit: ${prov.commits.join(' vs ')}`,
    `% viewer_version: ${prov.viewerVersion}`,
    `% export_date: ${prov.exportDate}`,
    `% definition: ${t.caption.replace(/\n/g, ' ')}`,
    `% compile: lualatex ${prov.panelId.replace(/[^A-Za-z0-9]+/g, '-')}-standalone.tex  (recommended)`,
    `% points: ${e.points}; pdflatex: ${e.pdflatexOk ? 'yes' : 'no (too many points for its fixed memory; use lualatex)'}`,
    ...e.notes.map((n) => `% NOTE: ${n}`),
    '',
  ].join('\n')
}

export function preamble(e: EmitResult): string {
  const libs = [...new Set(['groupplots', 'fillbetween', 'statistics', 'colormaps'].filter((l) => e.libraries.has(l)))]
  const tlibs = [...e.tikzLibraries]
  return [
    '\\usepackage{pgfplots}',
    `\\pgfplotsset{compat=${PGFPLOTS_COMPAT}}`,
    libs.length ? `\\usepgfplotslibrary{${libs.join(',')}}` : '',
    tlibs.length ? `\\usetikzlibrary{${tlibs.join(',')}}` : '',
    ...[...e.colors.entries()].map(([hex, n]) => `\\definecolor{${n}}{HTML}{${hex.slice(1)}}`),
  ].filter(Boolean).join('\n')
}

export function standalone(stemName: string, e: EmitResult, fontPt: number, header: string): string {
  return `${header}\\documentclass[${fontPt}pt]{standalone}
\\usepackage{iftex}
\\ifluatex
  \\usepackage{fontspec}
  \\setsansfont{PKVSans-Regular.ttf}[Path=./fonts/, BoldFont=PKVSans-Bold.ttf]
  \\renewcommand{\\familydefault}{\\sfdefault}
\\else
  \\usepackage[T1]{fontenc}
  \\usepackage[utf8]{inputenc}
  \\usepackage{helvet}
  \\renewcommand{\\familydefault}{\\sfdefault}
\\fi
${preamble(e)}
\\begin{document}
\\input{${stemName}.tex}
\\end{document}
`
}

export function readme(t: ExportTarget, e: EmitResult): string {
  return `PhosKinTime-Vis PGFPlots export: ${t.title}

Files
  ${t.id}.tex              tikzpicture to \\input in your document
  ${t.id}-standalone.tex   compiles on its own (lualatex recommended)
  data/*.dat               tab-separated data, full float64 precision (toPrecision(17)); "nan" = null (a gap)
  fonts/                   PKV Sans (SIL Open Font License 1.1, see fonts/OFL.txt) used by LuaLaTeX
${e.images.map((i) => `  ${i.name}   data layer rendered at 600 dpi (above the TeX size limit)`).join('\n')}

Required packages: pgfplots (compat=${PGFPLOTS_COMPAT}), tikz, iftex, fontspec (LuaLaTeX) or helvet (pdfLaTeX).
PGFPlots libraries: ${[...e.libraries].join(', ') || 'none'}. TikZ libraries: ${[...e.tikzLibraries].join(', ') || 'none'}.
Colours are defined with \\definecolor in the preamble of the standalone file; copy them into your own preamble.

Compile:   lualatex ${t.id}-standalone.tex
In your document: copy the preamble lines between \\documentclass and \\begin{document}, then \\input{${t.id}.tex}.
${e.notes.length ? '\nNotes:\n' + e.notes.map((n) => '  - ' + n).join('\n') : ''}
`
}

const OFL_NOTE = `PKV Sans is a subset of Noto Sans (Regular, Bold) with glyphs from Noto Sans Math.
Noto Sans and Noto Sans Math: Copyright 2022 The Noto Project Authors (https://github.com/notofonts).
Licensed under the SIL Open Font License, Version 1.1: https://openfontlicense.org
The full licence text is in THIRD_PARTY.md of phoskintime-vis.
`

export async function tikzZip(t: ExportTarget, r: Rendered, s: ExportSettings, prov: Provenance): Promise<Uint8Array> {
  const e = await emitTarget(t, r, s)
  const stemName = t.id.replace(/[^A-Za-z0-9]+/g, '-')
  const header = texHeader(t, prov, e)
  const caption = s.caption ? `% caption: ${tex(t.caption)}\n` : ''
  const files: Record<string, Uint8Array> = {
    [`${stemName}.tex`]: strToU8(header + caption + e.picture),
    [`${stemName}-standalone.tex`]: strToU8(standalone(stemName, e, Math.round(s.fontPt), header)),
    'README.txt': strToU8(readme({ ...t, id: stemName }, e)),
    'fonts/PKVSans-Regular.ttf': Uint8Array.from(atob(fontBase64.regular), (ch) => ch.charCodeAt(0)),
    'fonts/PKVSans-Bold.ttf': Uint8Array.from(atob(fontBase64.bold), (ch) => ch.charCodeAt(0)),
    'fonts/OFL.txt': strToU8(OFL_NOTE),
    'PROVENANCE.txt': strToU8(provenanceText(prov) + '\n'),
  }
  for (const [k, v] of Object.entries(e.files)) files[k] = strToU8(v)
  for (const img of e.images) files[img.name] = Uint8Array.from(atob(img.dataUrl.slice(img.dataUrl.indexOf(',') + 1)), (ch) => ch.charCodeAt(0))
  return zipSync(files, { level: 6 })
}
