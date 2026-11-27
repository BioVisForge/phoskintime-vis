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

export function composeSvg(figure: HTMLElement, s: ExportSettings, metaIn: { title: string; caption: string; provenance: Provenance; notes?: string[] }, embedFont = true): Composed {
  let meta = metaIn
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
  // real horizontal extent (tick labels can overhang a plot's own box)
  let minX = 0
  let maxX = Math.round(s.widthMm * LAYOUT_PX_PER_MM)
  for (const el of figure.querySelectorAll('svg text, svg path, svg rect, svg circle, svg line, svg image')) {
    if (hidden(el)) continue
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    minX = Math.min(minX, r.left - base.left)
    maxX = Math.max(maxX, r.right - base.left)
  }
  for (const l of lines) {
    minX = Math.min(minX, l.left - base.left)
    maxX = Math.max(maxX, l.right - base.left)
  }
  // content wider than the page (overhanging labels): the whole figure is scaled to fit
  const x0 = Math.floor(minX)
  const W = Math.ceil(maxX - x0)
  const fit = W0 / W
  if (fit < 0.97) meta = { ...meta, notes: [...(meta.notes ?? []), `Scaled to ${Math.round(fit * 100)} % to fit ${s.widthMm} mm (long axis labels).`] }
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
