import { composeSvg, type Composed } from './compose'
import { renderOffscreen, type ExportTarget, type Rendered } from './render'
import { checkCanvasSize, physChunk, pngPixelSize, textChunk, withChunks } from './png'
import { exportFilename, provenanceText, type ExportSettings, type Provenance } from './settings'
import { fontBase64, FONT_FAMILY } from './fonts'
import { toCsv } from '../transforms/table'

export type Format = 'png' | 'pdf' | 'svg' | 'csv' | 'tikz'
export const FORMATS: Format[] = ['png', 'pdf', 'svg', 'csv', 'tikz']

export interface ExportFile {
  name: string
  data: Uint8Array
  mime: string
}

export function provenanceOf(t: ExportTarget): Provenance {
  return { bundleIds: t.bundleIds, commits: t.commits, panelId: t.id, viewerVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev', exportDate: new Date().toISOString() }
}

export function rasterNote(r: Rendered, dpi: number): string[] {
  const layers = [...r.host.querySelectorAll('[data-raster-layer]')]
  if (!layers.length) return []
  const n = layers.reduce((s, l) => s + Number(l.getAttribute('data-raster-elements') ?? 0), 0)
  return [`Data layer rasterised at ${dpi} dpi (${n.toLocaleString('en')} points exceed the vector limit); axes, text and legend are vector.`]
}

function compose(t: ExportTarget, r: Rendered, s: ExportSettings, embedFont = true): Composed {
  return composeSvg(r.figure, s, { title: t.title, caption: t.caption, provenance: provenanceOf(t), notes: rasterNote(r, s.dpi) }, embedFont)
}

const enc = (s: string) => new TextEncoder().encode(s)

export async function svgToPng(c: Composed, s: ExportSettings, prov: Provenance): Promise<Uint8Array> {
  const { width, height } = pngPixelSize(c.widthMm, c.heightMm, s.dpi)
  const err = checkCanvasSize(width, height)
  if (err) throw new Error(err)
  const url = URL.createObjectURL(new Blob([c.svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('could not rasterise the export SVG'))
      img.src = url
    })
    await img.decode().catch(() => {})
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(`The browser could not allocate a ${width} × ${height} canvas.`)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    // vector SVG drawn straight at target pixels: no bitmap is upscaled
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error(`The browser could not encode a ${width} × ${height} PNG.`)
    const png = new Uint8Array(await blob.arrayBuffer())
    return withChunks(png, [
      physChunk(s.dpi),
      textChunk('Title', `${prov.panelId}`),
      textChunk('bundle_id', prov.bundleIds.join(' vs ')),
      textChunk('phoskintime_commit', prov.commits.join(' vs ')),
      textChunk('panel_id', prov.panelId),
      textChunk('Software', `PhosKinTime-Vis ${prov.viewerVersion}`),
      textChunk('Comment', provenanceText(prov)),
    ])
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToPdf(c: Composed, t: ExportTarget, prov: Provenance): Promise<Uint8Array> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const doc = new jsPDF({ unit: 'mm', format: [c.widthMm, c.heightMm], orientation: c.widthMm > c.heightMm ? 'landscape' : 'portrait', compress: true })
  doc.addFileToVFS('PKVSans-Regular.ttf', fontBase64.regular)
  doc.addFont('PKVSans-Regular.ttf', FONT_FAMILY, 'normal')
  doc.addFileToVFS('PKVSans-Bold.ttf', fontBase64.bold)
  doc.addFont('PKVSans-Bold.ttf', FONT_FAMILY, 'bold')
  doc.setFont(FONT_FAMILY, 'normal')
  const el = new DOMParser().parseFromString(c.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement
  // svg2pdf resolves styles with the element in a document
  el.setAttribute('style', 'position:absolute;left:-30000px')
  document.body.appendChild(el)
  try {
    await (doc as any).svg(el, { x: 0, y: 0, width: c.widthMm, height: c.heightMm })
  } finally {
    el.remove()
  }
  doc.setProperties({
    title: `${t.title} (${prov.panelId})`,
    subject: provenanceText(prov),
    keywords: `bundle_id=${prov.bundleIds.join(',')}; phoskintime_commit=${prov.commits.join(',')}; panel_id=${prov.panelId}; viewer=${prov.viewerVersion}`,
    creator: `PhosKinTime-Vis ${prov.viewerVersion}`,
  })
  return new Uint8Array(doc.output('arraybuffer'))
}

export function csvWithHeader(t: ExportTarget, prov: Provenance, rows: Record<string, unknown>[]): string {
  const cols = rows.length ? Object.keys(rows[0]) : []
  const header = [
    `# PhosKinTime-Vis export: ${t.title}`,
    `# panel_id: ${prov.panelId}`,
    `# bundle_id: ${prov.bundleIds.join(' vs ')}`,
    `# phoskintime_commit: ${prov.commits.join(' vs ')}`,
    `# viewer_version: ${prov.viewerVersion}`,
    `# export_date: ${prov.exportDate}`,
    `# definition: ${t.caption.replace(/\n/g, ' ')}`,
    `# units: ${cols.map((c) => `${c}=${t.units?.[c] ?? ''}`).join('; ')}`,
    `# empty field = null (missing value, never zero)`,
  ]
  return header.join('\n') + '\n' + toCsv(rows, cols)
}

/** Export one target in one format. TikZ is delegated to the tikz module. */
export async function exportTarget(t: ExportTarget, fmt: Format, s: ExportSettings): Promise<ExportFile> {
  const prov = provenanceOf(t)
  const name = (ext: string) => exportFilename(t.id, t.bundleIds, ext)
  const r = await renderOffscreen(t, s)
  try {
    if (fmt === 'csv') return { name: name('csv'), data: enc(csvWithHeader(t, prov, t.report?.rows.length ? t.report.rows : r.report.rows)), mime: 'text/csv' }
    if (fmt === 'svg') return { name: name('svg'), data: enc(compose(t, r, s, s.svgEmbedFont).svg), mime: 'image/svg+xml' }
    if (fmt === 'png') return { name: name('png'), data: await svgToPng(compose(t, r, s, true), s, prov), mime: 'image/png' }
    if (fmt === 'pdf') return { name: name('pdf'), data: await svgToPdf(compose(t, r, s, false), t, prov), mime: 'application/pdf' }
    const { tikzZip } = await import('../tikz/zip')
    return { name: name('zip').replace(/\.zip$/, '_tikz.zip'), data: await tikzZip(t, r, s, prov, compose(t, r, s, true)), mime: 'application/zip' }
  } finally {
    r.destroy()
  }
}

/** Composed SVG + rendered figure for tests and galleries. */
export async function composeTarget(t: ExportTarget, s: ExportSettings) {
  const r = await renderOffscreen(t, s)
  try {
    return compose(t, r, s, true)
  } finally {
    r.destroy()
  }
}
