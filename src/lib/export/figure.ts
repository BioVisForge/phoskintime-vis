/**
 * Panel figure export. SVG export serialises every <svg> in the figure; canvas layers (SveltePlot
 * draws them inside <foreignObject>) are replaced by <image> snapshots so nothing is lost. PNG is
 * the same SVG rasterised at 2x.
 */

export function download(name: string, data: Blob | string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function inlineSvg(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  // canvas layers -> images
  const srcCanvases = svg.querySelectorAll('canvas')
  const dstFOs = clone.querySelectorAll('foreignObject')
  const srcFOs = svg.querySelectorAll('foreignObject')
  srcFOs.forEach((fo, i) => {
    const c = fo.querySelector('canvas') ?? (srcCanvases[i] as HTMLCanvasElement | undefined)
    const dst = dstFOs[i]
    if (!c || !dst) return
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
    for (const k of ['x', 'y', 'width', 'height']) img.setAttribute(k, fo.getAttribute(k) ?? '0')
    img.setAttribute('href', c.toDataURL('image/png'))
    dst.replaceWith(img)
  })
  // computed styles that matter for standalone rendering
  const src = svg.querySelectorAll('*')
  const dst = clone.querySelectorAll('*')
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const d = dst[i] as SVGElement | undefined
    if (!d || !d.style) return
    for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'opacity', 'font-size', 'font-family', 'stroke-dasharray']) {
      const v = cs.getPropertyValue(p)
      if (v) d.style.setProperty(p, v)
    }
  })
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const r = svg.getBoundingClientRect()
  clone.setAttribute('width', String(Math.ceil(r.width)))
  clone.setAttribute('height', String(Math.ceil(r.height)))
  return clone
}

/** Stack all plot SVGs of a figure vertically into one SVG document. */
export function figureToSvg(root: HTMLElement): { svg: string; width: number; height: number } {
  const svgs = [...root.querySelectorAll('svg')].filter((s) => !s.closest('svg:not(:scope)') && s.getBoundingClientRect().width > 40) as SVGSVGElement[]
  const top = svgs.filter((s) => !svgs.some((o) => o !== s && o.contains(s)))
  const base = root.getBoundingClientRect()
  let width = 0
  let height = 0
  const parts: string[] = []
  for (const s of top) {
    const r = s.getBoundingClientRect()
    const x = r.left - base.left
    const y = r.top - base.top
    width = Math.max(width, x + r.width)
    height = Math.max(height, y + r.height)
    const c = inlineSvg(s)
    c.setAttribute('x', String(x))
    c.setAttribute('y', String(y))
    parts.push(new XMLSerializer().serializeToString(c))
  }
  width = Math.ceil(width)
  height = Math.ceil(height)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${parts.join('')}</svg>`
  return { svg, width, height }
}

export async function figureToPng(root: HTMLElement, scale = 2): Promise<Blob> {
  const { svg, width, height } = figureToSvg(root)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('could not rasterise SVG'))
    img.src = url
  })
  const c = document.createElement('canvas')
  c.width = Math.max(1, width * scale)
  c.height = Math.max(1, height * scale)
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}
