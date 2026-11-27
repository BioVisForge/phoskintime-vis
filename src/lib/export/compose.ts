/**
 * Compose one self-contained SVG for a rendered panel at the dialog's physical size: every plot
 * SVG (styles inlined), the figure's HTML text (legends, plot titles) as SVG text, optional
 * title / caption / provenance footer, and the export font. Raster layers (only layers above
 * the vector threshold) become <image> elements drawn at export resolution.
 */
import { fontFaceCss, FONT_FAMILY } from './fonts'
import { LAYOUT_PX_PER_MM, ptToLayoutPx, provenanceText, type ExportSettings, type Provenance } from './settings'

export interface Composed {
  svg: string
  widthMm: number
  heightMm: number
  layoutW: number
  layoutH: number
  rasterLayers: { kind: string; elements: number }[]
  /** text strings placed in the figure (for tests / accessibility) */
  texts: string[]
}

/** One element that sticks out of the chosen width. */
export interface FitOffender {
  kind: 'tick' | 'axis-title' | 'text' | 'html' | 'mark'
  text: string
  side: 'left' | 'right'
}

/** A figure that does not fit its width at the chosen pt size. */
export interface FitIssue {
  panelId: string
  title: string
  widthMm: number
  fontPt: number
  /** width the content needs at this layout (an estimate: a wider layout reflows) */
  neededMm: number
  /** scale that would fit, and the pt size text would then have */
  scale: number
  scaledPt: number
  /** layout px by which the content is wider than the page */
  overPx: number
  /** tick labels are among the offenders: "shorter labels" / "fewer ticks" can help */
  tickLabels: boolean
  /** fixes already applied in this attempt */
  applied: string[]
  offenders: FitOffender[]
}

/** Thrown instead of silently scaling text below the chosen pt size. */
export class FitError extends Error {
  constructor(public issues: FitIssue[]) {
    super(issues.map((i) => `${i.title}: needs about ${i.neededMm.toFixed(0)} mm but the figure is ${i.widthMm} mm wide; fitting would set text at ${i.scaledPt.toFixed(1)} pt instead of ${i.fontPt} pt.`).join(' '))
    this.name = 'FitError'
  }
}

/** Content may overhang by this fraction without counting as "does not fit" (sub-pixel rounding). */
export const FIT_TOLERANCE = 0.005
/** A tick label that is a number (with optional sign, exponent, SI suffix or %): never shortened. */
export const NUMERIC = /^[-+−]?(\d[\d,.\u202f\u2009]*|\.\d+)(e[-+−]?\d+)?\s?[%kKMGTµmnp]?$/i
/** Shortest tick label the "shorter labels" fix produces (including the ellipsis). */
export const MIN_LABEL_CHARS = 4
/** Largest tick step the "fewer ticks" fix uses (every 4th label). */
export const MAX_TICK_STEP = 4

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'paint-order', 'mix-blend-mode', 'visibility', 'display']

/** Values equal to the SVG initial value are not inlined (keeps large exports small). */
const STYLE_DEFAULTS: Record<string, string> = {
  opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1', 'stroke-dasharray': 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter',
  'font-style': 'normal', 'paint-order': 'normal', 'mix-blend-mode': 'normal', visibility: 'visible', display: 'inline', 'text-anchor': 'start',
}
// elements whose own opacity can be folded into fill/stroke opacity (text included: tick labels carry opacity 0.8)
const LEAF = new Set(['circle', 'path', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'text', 'tspan'])
const NON_INHERITED = new Set(['opacity', 'display', 'mix-blend-mode'])
const FONT_PROPS = new Set(['font-size', 'font-weight', 'font-style', 'text-anchor'])

function hidden(el: Element): boolean {
  return !!el.closest('select, option, button, input, label, textarea, [data-export-skip]')
}

/**
 * svg2pdf ignores most dominant-baseline values, which moved tick labels and axis titles in the
 * PDF. Resolve them to a plain offset, measured on the live element, so that every renderer
 * places the glyphs where the browser drew them.
 */
function baselineShift(text: SVGTextElement): number {
  const parts = [text, ...text.querySelectorAll('tspan')] as SVGElement[]
  if (!parts.some((p) => !['auto', 'alphabetic'].includes(getComputedStyle(p).dominantBaseline))) return 0
  const before = text.getBBox().y
  const saved = parts.map((p) => p.getAttribute('style'))
  for (const p of parts) p.style.setProperty('dominant-baseline', 'alphabetic', 'important')
  const shift = before - text.getBBox().y
  parts.forEach((p, i) => (saved[i] === null ? p.removeAttribute('style') : p.setAttribute('style', saved[i]!)))
  return shift
}

function inlineSvg(svg: SVGSVGElement, raster: Composed['rasterLayers']): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const src = [svg, ...svg.querySelectorAll('*')]
  const dst = [clone, ...clone.querySelectorAll('*')]
  // measured before any style is read or rewritten
  const shifts = src.map((el) => (el.tagName === 'text' ? baselineShift(el as SVGTextElement) : 0))
  src.forEach((el, i) => {
    const d = dst[i] as SVGElement
    if (!d?.style) return
    const cs = getComputedStyle(el)
    const isText = el.tagName === 'text' || el.tagName === 'tspan' || el.tagName === 'g' || el.tagName === 'svg'
    d.removeAttribute('style')
    for (const p of STYLE_PROPS) {
      if (!isText && FONT_PROPS.has(p)) continue
      let v = cs.getPropertyValue(p)
      // only two faces are embedded: map CSS weights onto regular (400) / bold (700)
      if (p === 'font-weight' && v) v = Number(v) >= 600 || v === 'bold' ? '700' : '400'
      // inherited properties: omit only when equal to the parent's computed value (inheritance then
      // reproduces it); non-inherited ones: omit only when equal to the initial value
      const parent = el.parentElement && el !== svg ? getComputedStyle(el.parentElement).getPropertyValue(p) : null
      const redundant = NON_INHERITED.has(p) ? STYLE_DEFAULTS[p] === v : parent !== null ? parent === v : STYLE_DEFAULTS[p] === v
      if (v && !redundant) d.style.setProperty(p, v)
    }
    if (isText) d.style.setProperty('font-family', `'${FONT_FAMILY}'`)
    // svg2pdf ignores element opacity on shapes: fold it into fill/stroke opacity (equivalent for
    // one shape, except where its own stroke overlaps its fill)
    const op = parseFloat(cs.getPropertyValue('opacity'))
    if (op < 1 && LEAF.has(el.tagName)) {
      d.style.removeProperty('opacity')
      const own = (p: string) => {
        const v = parseFloat(cs.getPropertyValue(p))
        return Number.isFinite(v) ? v : 1
      }
      d.style.setProperty('fill-opacity', String(op * own('fill-opacity')))
      d.style.setProperty('stroke-opacity', String(op * own('stroke-opacity')))
    }
    d.removeAttribute('dominant-baseline')
    d.removeAttribute('alignment-baseline')
    if (Math.abs(shifts[i]) > 0.01) d.setAttribute('transform', `${d.getAttribute('transform') ?? ''} translate(0 ${shifts[i].toFixed(2)})`.trim())
    d.removeAttribute('class')
  })
  // the zoom layer's frame rectangle (transparent, interaction only) is not part of the figure
  for (const r of clone.querySelectorAll('rect.pkv-zoom-overlay')) r.remove()
  const srcFO = svg.querySelectorAll('foreignObject')
  const dstFO = clone.querySelectorAll('foreignObject')
  srcFO.forEach((fo, i) => {
    const canvas = fo.querySelector('canvas')
    if (!canvas) return
    const kind = fo.getAttribute('data-raster-layer')
    if (!kind) throw new Error('A canvas layer without an export-resolution renderer was found; refusing to embed a screen bitmap.')
    raster.push({ kind, elements: Number(fo.getAttribute('data-raster-elements') ?? 0) })
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
    for (const k of ['x', 'y', 'width', 'height']) img.setAttribute(k, fo.getAttribute(k) ?? '0')
    img.setAttribute('href', canvas.toDataURL('image/png'))
    img.setAttribute('preserveAspectRatio', 'none')
    img.setAttribute('data-raster-layer', kind)
    // a zoomed view clips its layers to the frame ("export current view")
    const clip = fo.getAttribute('clip-path')
    if (clip) img.setAttribute('clip-path', clip)
    dstFO[i].replaceWith(img)
  })
  return clone
}

interface HtmlLine {
  text: string
  left: number
  top: number
  right: number
  size: number
  weight: string
  color: string
}

/** HTML text inside the figure (legends, plot titles, tables), split into its rendered lines. */
function htmlLines(root: HTMLElement): HtmlLine[] {
  const out: HtmlLine[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const raw = n.textContent ?? ''
    const el = n.parentElement
    if (!raw.trim() || !el || el.closest('svg') || hidden(el)) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    // group characters by the line box they render on
    let cur: { chars: string; left: number; top: number; right: number } | null = null
    const flush = () => {
      if (cur && cur.chars.trim()) out.push({ text: cur.chars.replace(/\s+/g, ' ').trim(), left: cur.left, top: cur.top, right: cur.right, size: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color })
      cur = null
    }
    for (let i = 0; i < raw.length; i++) {
      range.setStart(n, i)
      range.setEnd(n, i + 1)
      const r = range.getBoundingClientRect()
      if (!r.width && !r.height) continue
      if (cur && Math.abs(r.top - cur.top) > r.height / 2) flush()
      if (!cur) cur = { chars: '', left: r.left, top: r.top, right: r.right }
      cur.chars += raw[i]
      cur.right = Math.max(cur.right, r.right)
    }
    flush()
  }
  return out
}

function htmlText(lines: HtmlLine[], ox: number, oy: number, texts: string[]): string {
  return lines
    .map((l) => {
      texts.push(l.text)
      return `<text x="${(l.left - ox).toFixed(2)}" y="${(l.top - oy + l.size * 0.92).toFixed(2)}" style="font-family:'${FONT_FAMILY}';font-size:${l.size.toFixed(2)}px;font-weight:${Number(l.weight) >= 600 ? 700 : 400};fill:${l.color}">${esc(l.text)}</text>`
    })
    .join('')
}

/**
 * Client-space box of a drawn element. SVG text is measured by its glyph box (getBBox) mapped
 * through its screen transform: Firefox's getBoundingClientRect pads SVG text by about 1 px on
 * each side (its visual-overflow rect), which made 85 mm figures that fit in Chromium "not fit"
 * in Firefox. For other elements, and where the transform is unavailable, getBoundingClientRect.
 */
export function drawnRect(el: Element): { left: number; right: number; top: number; bottom: number; width: number; height: number } {
  if (el instanceof SVGTextElement || (typeof SVGTSpanElement !== 'undefined' && el instanceof SVGTSpanElement)) {
    const g = el as SVGGraphicsElement
    const m = g.getScreenCTM?.()
    if (m) {
      const b = g.getBBox()
      const pts = [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x, b.y + b.height],
        [b.x + b.width, b.y + b.height],
      ].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f])
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      const left = Math.min(...xs)
      const right = Math.max(...xs)
      const top = Math.min(...ys)
      const bottom = Math.max(...ys)
      return { left, right, top, bottom, width: right - left, height: bottom - top }
    }
  }
  return el.getBoundingClientRect()
}

/**
 * An element inside a zoomed plot ("export current view") is clipped to the plot frame: what
 * it can occupy is its box intersected with the frame (the zoom layer's frame rectangle in the
 * same facet). Unclipped elements keep their box.
 */
function clippedRect(el: Element, r: { left: number; right: number; top: number; bottom: number; width: number; height: number }) {
  const g = el.closest('[clip-path^="url(#pkv-zoom-clip-"]')
  const frame = g?.parentElement?.querySelector(':scope > rect.pkv-zoom-overlay')
  if (!frame) return r
  const f = frame.getBoundingClientRect()
  const left = Math.max(r.left, f.left)
  const right = Math.min(r.right, f.right)
  const top = Math.max(r.top, f.top)
  const bottom = Math.min(r.bottom, f.bottom)
  if (right <= left || bottom <= top) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}

interface Extent {
  minX: number
  maxX: number
  offenders: FitOffender[]
}

const TITLE_CLASS = /axis-[xy]-title/

const MEASURED = 'svg text, svg path, svg rect, svg circle, svg line, svg image'

/**
 * Horizontal extent of what is drawn (tick labels can overhang a plot's own box) and what sticks
 * out. part 'ticks': only axis ticks (the fixes change those); 'rest': everything else, including
 * the HTML text lines. The fix loops measure 'ticks' again and reuse 'rest'.
 */
function extentOf(figure: HTMLElement, W0: number, part: 'ticks' | 'rest', lines: HtmlLine[] = []): Extent {
  const base = figure.getBoundingClientRect()
  let minX = 0
  let maxX = W0
  const offenders: FitOffender[] = []
  const note = (kind: FitOffender['kind'], text: string, l: number, r: number) => {
    if (l < -0.5) offenders.push({ kind, text, side: 'left' })
    else if (r > W0 + 0.5) offenders.push({ kind, text, side: 'right' })
  }
  const els = part === 'ticks' ? figure.querySelectorAll(`svg g.tick :is(text, line, path)`) : [...figure.querySelectorAll(MEASURED)].filter((el) => !el.closest('g.tick') && !el.classList.contains('pkv-zoom-overlay'))
  for (const el of els) {
    if (hidden(el)) continue
    const r = clippedRect(el, drawnRect(el))
    if (!r.width && !r.height) continue
    const l = r.left - base.left
    const rt = r.right - base.left
    minX = Math.min(minX, l)
    maxX = Math.max(maxX, rt)
    const isText = el.tagName === 'text'
    const kind: FitOffender['kind'] = !isText ? 'mark' : part === 'ticks' ? 'tick' : TITLE_CLASS.test(el.getAttribute('class') ?? '') ? 'axis-title' : 'text'
    note(kind, isText ? (el.textContent ?? '').trim() : el.tagName, l, rt)
  }
  for (const l of lines) {
    minX = Math.min(minX, l.left - base.left)
    maxX = Math.max(maxX, l.right - base.left)
    note('html', l.text, l.left - base.left, l.right - base.left)
  }
  return { minX, maxX, offenders }
}

const merge = (a: Extent, b: Extent): Extent => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), offenders: [...a.offenders, ...b.offenders] })

function extent(figure: HTMLElement, W0: number, lines: HtmlLine[]): Extent {
  return merge(extentOf(figure, W0, 'rest', lines), extentOf(figure, W0, 'ticks'))
}

const fits = (e: Extent, W0: number) => W0 / Math.ceil(e.maxX - Math.floor(e.minX)) >= 1 - FIT_TOLERANCE

/** The axes (parents of g.tick) that hold an overflowing tick label. */
function overflowingAxes(figure: HTMLElement, W0: number): Element[] {
  const base = figure.getBoundingClientRect()
  const axes = new Set<Element>()
  for (const t of figure.querySelectorAll('svg g.tick text')) {
    const r = drawnRect(t)
    if ((r.width || r.height) && (r.left - base.left < -0.5 || r.right - base.left > W0 + 0.5)) {
      const g = t.closest('g.tick')?.parentElement
      if (g) axes.add(g)
    }
  }
  return [...axes]
}

/**
 * "Fewer ticks": on the axes that overflow, keep every k-th tick (k = 2..MAX_TICK_STEP), trying
 * each offset so that an overhanging first or last label can be the one dropped. Mutates the
 * offscreen render.
 */
function fewerTicks(figure: HTMLElement, W0: number, Wr: number, measure: () => Extent): string | null {
  const axes = overflowingAxes(figure, Wr)
  if (!axes.length) return null
  const ticks = axes.map((a) => [...a.children].filter((c) => c.matches('g.tick')) as SVGGElement[])
  const keep = (k: number, o: number) => (i: number) => i % k === o
  const show = (f: (i: number) => boolean) => ticks.forEach((list) => list.forEach((g, i) => g.style.setProperty('display', f(i) ? '' : 'none')))
  let best: [number, number] = [MAX_TICK_STEP, 0]
  search: for (let k = 2; k <= MAX_TICK_STEP; k++) {
    for (let o = 0; o < k; o++) {
      show(keep(k, o))
      if (fits(measure(), W0)) {
        best = [k, o]
        break search
      }
    }
  }
  const [k, o] = best
  ticks.forEach((list) => list.forEach((g, i) => (keep(k, o)(i) ? g.style.removeProperty('display') : g.remove())))
  return `Every ${k === 2 ? '2nd' : k === 3 ? '3rd' : `${k}th`} tick label shown on ${axes.length === 1 ? 'one axis' : `${axes.length} axes`} to fit the width.`
}

/**
 * "Shorter labels": truncate tick labels with an ellipsis to the longest length that fits
 * (binary search; shorter labels never make the figure wider). Mutates the offscreen render.
 */
function shortenLabels(figure: HTMLElement, W0: number, Wr: number, measure: () => Extent): string | null {
  const axes = overflowingAxes(figure, Wr)
  if (!axes.length) return null
  // leaf text holders on the overflowing axes: tspans, or text elements without tspans
  // numbers are never truncated (a cut-off number reads as a different value)
  const leaves = (axes.flatMap((a) => [...a.querySelectorAll(':scope > g.tick text')]) as SVGTextElement[])
    .flatMap((t) => {
      const sp = [...t.querySelectorAll('tspan')]
      return sp.length ? sp : [t]
    })
    .filter((l) => !NUMERIC.test((l.textContent ?? '').trim())) as SVGElement[]
  const orig = leaves.map((l) => [...(l.textContent ?? '')])
  const longest = Math.max(0, ...orig.map((o) => o.length))
  if (longest <= MIN_LABEL_CHARS) return null
  const apply = (n: number) => leaves.forEach((l, i) => (l.textContent = orig[i].length > n ? orig[i].slice(0, n - 1).join('') + '…' : orig[i].join('')))
  // largest n in [MIN_LABEL_CHARS, longest - 1] that fits; MIN_LABEL_CHARS when none does
  let lo = MIN_LABEL_CHARS
  let hi = longest - 1
  apply(lo)
  if (fits(measure(), W0)) {
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      apply(mid)
      if (fits(measure(), W0)) lo = mid
      else hi = mid - 1
    }
  }
  apply(lo)
  return `Tick labels on ${axes.length === 1 ? 'one axis' : `${axes.length} axes`} shortened to ${lo} characters (…) to fit the width; the CSV has the full labels.`
}

export interface ComposeMeta {
  title: string
  caption: string
  provenance: Provenance
  notes?: string[]
}

/**
 * Width check and the fixes the user chose. Text is never scaled below the chosen pt size unless
 * the user confirmed it (s.fitScale); otherwise a FitError describes what sticks out.
 * Mutates the offscreen render (fixes) and returns the caption notes.
 */
export function fitToWidth(figure: HTMLElement, s: ExportSettings, meta: Pick<ComposeMeta, 'title' | 'provenance'>): string[] {
  const W0 = Math.round(s.widthMm * LAYOUT_PX_PER_MM)
  const Wr = W0 - s.fitReservePx // the width the figure was rendered at
  const notes: string[] = []
  // the fixes only touch axis ticks: measure everything else (marks, titles, HTML text) once
  const rest = extentOf(figure, Wr, 'rest', htmlLines(figure))
  const measure = () => merge(rest, extentOf(figure, Wr, 'ticks'))
  let e = measure()
  if (fits(e, W0)) return notes
  const applied: string[] = []
  if (s.fitFewerTicks) {
    const n = fewerTicks(figure, W0, Wr, measure)
    if (n) {
      notes.push(n)
      applied.push('fewer ticks')
    }
    e = measure()
  }
  if (!fits(e, W0) && s.fitShortenLabels) {
    const n = shortenLabels(figure, W0, Wr, measure)
    if (n) {
      notes.push(n)
      applied.push('shorter labels')
    }
    e = measure()
  }
  if (fits(e, W0)) return notes
  const W = Math.ceil(e.maxX - Math.floor(e.minX))
  const scale = W0 / W
  const scaledPt = Math.floor(s.fontPt * scale * 10) / 10
  if (s.fitScale) {
    notes.push(`Scaled to ${Math.round(scale * 100)} % to fit ${s.widthMm} mm: text is ${scaledPt.toFixed(1)} pt instead of ${s.fontPt} pt.`)
    return notes
  }
  const seen = new Set<string>()
  const offenders = e.offenders.filter((o) => (seen.has(o.kind + o.text) ? false : (seen.add(o.kind + o.text), true)))
  throw new FitError([
    { panelId: meta.provenance.panelId, title: meta.title, widthMm: s.widthMm, fontPt: s.fontPt, neededMm: W / LAYOUT_PX_PER_MM, scale, scaledPt, overPx: W - W0, tickLabels: offenders.some((o) => o.kind === 'tick'), applied, offenders: offenders.slice(0, 12) },
  ])
}

export function composeSvg(figure: HTMLElement, s: ExportSettings, metaIn: ComposeMeta, embedFont = true): Composed {
  // fixes mutate the render before it is cloned; throws FitError when it still does not fit
  const fitNotes = fitToWidth(figure, s, metaIn)
  const meta = fitNotes.length ? { ...metaIn, notes: [...(metaIn.notes ?? []), ...fitNotes] } : metaIn
  const raster: Composed['rasterLayers'] = []
  const texts: string[] = []
  const F = ptToLayoutPx(s.fontPt)
  const W0 = Math.round(s.widthMm * LAYOUT_PX_PER_MM)
  const base = figure.getBoundingClientRect()
  const svgs = ([...figure.querySelectorAll('svg')] as SVGSVGElement[]).filter((x) => !x.parentElement?.closest('svg') && !hidden(x) && x.getBoundingClientRect().width > 0)
  let contentH = 0
  const parts: string[] = []
  for (const sv of svgs) {
    const r = sv.getBoundingClientRect()
    contentH = Math.max(contentH, r.bottom - base.top)
    const c = inlineSvg(sv, raster)
    c.setAttribute('x', (r.left - base.left).toFixed(2))
    c.setAttribute('y', (r.top - base.top).toFixed(2))
    c.setAttribute('width', r.width.toFixed(2))
    c.setAttribute('height', r.height.toFixed(2))
    c.setAttribute('overflow', 'visible') // axis titles sit above the plot box; svg2pdf clips nested SVGs otherwise
    for (const t of c.querySelectorAll('text')) if (t.textContent?.trim()) texts.push(t.textContent.trim())
    parts.push(new XMLSerializer().serializeToString(c))
  }
  const lines = htmlLines(figure)
  const html = htmlText(lines, base.left, base.top, texts)
  for (const l of lines) contentH = Math.max(contentH, l.top - base.top + l.size * 1.25)
  // real horizontal extent; wider than W0 only when the user confirmed "scale anyway" (or within FIT_TOLERANCE)
  const { minX, maxX } = extent(figure, W0 - s.fitReservePx, lines)
  const x0 = Math.floor(minX)
  // a figure drawn narrower to make room for labels keeps the page width: nothing is scaled up
  const W = s.fitReservePx ? Math.max(W0, Math.ceil(maxX - x0)) : Math.ceil(maxX - x0)
  // header / footer
  const pad = F * 0.6
  let y = 0
  const head: string[] = []
  const wrap = (text: string, size: number) => {
    const maxChars = Math.max(20, Math.floor(W / (size * 0.52)))
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        lines.push(cur.trim())
        cur = w
      } else cur += ' ' + w
    }
    if (cur.trim()) lines.push(cur.trim())
    return lines
  }
  if (s.title && meta.title) {
    y += F * 1.15
    head.push(`<text x="${x0}" y="${y.toFixed(2)}" style="font-family:'${FONT_FAMILY}';font-size:${(F * 1.1).toFixed(2)}px;font-weight:700;fill:#1a1a1a">${esc(meta.title)}</text>`)
    texts.push(meta.title)
    y += pad * 0.5
  }
  if (s.caption) {
    const cap = [meta.caption, ...(meta.notes ?? [])].filter(Boolean).join(' ')
    for (const line of wrap(cap, F * 0.9)) {
      y += F * 1.05
      head.push(`<text x="${x0}" y="${y.toFixed(2)}" style="font-family:'${FONT_FAMILY}';font-size:${(F * 0.9).toFixed(2)}px;fill:#333">${esc(line)}</text>`)
      texts.push(line)
    }
  }
  if (head.length) y += pad
  const top = y
  let H = top + contentH
  const foot: string[] = []
  if (s.footer) {
    H += pad
    for (const line of wrap(provenanceText(meta.provenance), F * 0.72)) {
      H += F * 0.85
      foot.push(`<text x="${x0}" y="${H.toFixed(2)}" style="font-family:'${FONT_FAMILY}';font-size:${(F * 0.72).toFixed(2)}px;fill:#666">${esc(line)}</text>`)
      texts.push(line)
    }
    H += F * 0.3
  }
  H = Math.ceil(H)
  const widthMm = s.widthMm
  const heightMm = s.heightMm ?? +((H * widthMm) / W).toFixed(3)
  const style = `<style>${embedFont ? fontFaceCss() : ''} text{font-family:'${FONT_FAMILY}',sans-serif}</style>`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm}mm" height="${heightMm}mm" viewBox="${x0} 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">` +
    `<defs>${style}</defs><rect x="${x0}" width="${W}" height="${H}" fill="#ffffff"/>` +
    head.join('') +
    `<g transform="translate(0 ${top.toFixed(2)})">${parts.join('')}${html}</g>` +
    foot.join('') +
    `</svg>`
  return { svg, widthMm, heightMm, layoutW: W, layoutH: H, rasterLayers: raster, texts }
}
