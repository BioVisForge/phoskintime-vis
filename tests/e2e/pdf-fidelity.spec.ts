import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { PNG } from 'pngjs'
import { APP, openZip, waitVerified, goSection, PANEL_SECTIONS } from './helpers'
import { confirmFit } from '../../scripts/lib/confirm-fit.mjs'

// The PDF is drawn by svg2pdf, which does not reproduce group-level opacity. Two guards:
// no exported figure may use it, and the PDF must look like the PNG of the same figure.
test.skip(({ browserName }) => browserName !== 'chromium', 'export specs run in Chromium')
test.setTimeout(900_000)

/** Opacity below 1 on a container (it composites the group as a whole, unlike fill/stroke opacity). */
function groupOpacity(page: Page, svg: string): Promise<string[]> {
  return page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml')
    const bad: string[] = []
    for (const el of doc.querySelectorAll('svg, g, a, switch, symbol, use, image, foreignObject')) {
      const v = (el as SVGElement).style?.opacity || el.getAttribute('opacity')
      if (v && Number(v) < 1) bad.push(`<${el.tagName} class="${el.getAttribute('class') ?? ''}" opacity=${v}>`)
    }
    // no shape or text may keep element opacity either: it is folded into fill/stroke opacity
    for (const el of doc.querySelectorAll('circle, path, rect, line, polygon, polyline, ellipse, text, tspan')) {
      const v = (el as SVGElement).style?.opacity || el.getAttribute('opacity')
      if (v && Number(v) < 1) bad.push(`<${el.tagName} opacity=${v}>`)
    }
    return bad
  }, svg)
}

for (const fixture of ['network', 'small-protwise']) {
  test(`no exported panel uses group-level opacity (${fixture}, every panel)`, async ({ page }) => {
    await page.goto(APP)
    await openZip(page, fixture)
    await waitVerified(page)
    // optional layers that add their own transparency
    for (const s of PANEL_SECTIONS) await goSection(page, s)
    await page.keyboard.press('Control+k')
    await page.fill('[data-testid=palette-input]', 'Export all panels')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-testid=export-dialog-el][open]')
    for (const f of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
      const box = page.locator(`[data-testid=fmt-${f}]`)
      if ((await box.isChecked()) !== (f === 'svg')) await box.click()
    }
    const download = page.waitForEvent('download', { timeout: 600_000 })
    await page.click('[data-testid=export-run]')
    await confirmFit(page, download)
    const files = unzipSync(new Uint8Array(readFileSync((await (await download).path())!)))
    expect(Object.keys(files).length).toBeGreaterThan(10)
    const bad: string[] = []
    for (const [name, data] of Object.entries(files)) for (const b of await groupOpacity(page, strFromU8(data))) bad.push(`${name}: ${b}`)
    expect(bad.slice(0, 10), `${bad.length} elements with opacity`).toEqual([])
  })
}

/**
 * Both images are compared at 150 dpi. The PDF is rendered at 600 dpi and downscaled, because
 * Ghostscript draws sub-pixel strokes too heavily when rendering at 150 dpi directly.
 */
const PDF_DPI = 600

/** Mean of each BLOCK×BLOCK block per channel: tolerant of anti-aliasing, not of wrong colour or opacity. */
function blocks(img: PNG, w: number, h: number, size: number): number[] {
  const out: number[] = []
  for (let y = 0; y + size <= h; y += size)
    for (let x = 0; x + size <= w; x += size)
      for (let c = 0; c < 3; c++) {
        let s = 0
        for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) s += img.data[((y + j) * img.width + x + i) * 4 + c]
        out.push(s / (size * size))
      }
  return out
}

/** Box-filter downscale by an integer factor. */
function shrink(src: PNG, f: number): PNG {
  const out = new PNG({ width: Math.floor(src.width / f), height: Math.floor(src.height / f) })
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0
        for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += src.data[((f * y + j) * src.width + f * x + i) * 4 + c]
        out.data[(y * out.width + x) * 4 + c] = Math.round(s / (f * f))
      }
  return out
}

const PANELS = [
  { panel: 'nm-gof', section: 'fit' }, // translucent dots
  { panel: 'nm-all-trajectories', section: 'dynamics' }, // translucent lines
  { panel: 'nm-post-predictive', section: 'uncertainty' }, // translucent bands
]

for (const { panel, section } of PANELS) {
  test(`PDF matches PNG: ${panel}`, async ({ page }, info) => {
    await page.goto(APP)
    await openZip(page, 'network')
    await waitVerified(page)
    await goSection(page, section)
    const card = page.locator(`[data-panel="${panel}"]`)
    await card.scrollIntoViewIfNeeded()
    await expect(card).toHaveAttribute('data-rendered', 'true')
    await expect(card.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
    await card.locator('[data-testid=panel-menu]').click()
    await card.locator('[data-testid=export-dialog]').click()
    await page.waitForSelector('[data-testid=export-dialog-el][open]')
    for (const f of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
      const box = page.locator(`[data-testid=fmt-${f}]`)
      if ((await box.isChecked()) !== (f === 'png' || f === 'pdf')) await box.click()
    }
    await page.selectOption('[data-testid=export-dpi]', '300')
    const download = page.waitForEvent('download', { timeout: 300_000 })
    await page.click('[data-testid=export-run]')
    await confirmFit(page, download)
    const files = unzipSync(new Uint8Array(readFileSync((await (await download).path())!)))
    const pick = (ext: string) => files[Object.keys(files).find((n) => n.endsWith(ext))!]
    const pdfPath = info.outputPath(`${panel}.pdf`)
    const rendered = info.outputPath(`${panel}-from-pdf.png`)
    writeFileSync(pdfPath, pick('.pdf'))
    writeFileSync(info.outputPath(`${panel}-export.png`), pick('.png'))
    // Ghostscript: a renderer independent of the browser that produced both files
    execFileSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=png16m', `-r${PDF_DPI}`, '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', `-sOutputFile=${rendered}`, pdfPath])
    const a = shrink(PNG.sync.read(Buffer.from(pick('.png'))), 2) // 300 dpi export
    const b = shrink(PNG.sync.read(readFileSync(rendered)), PDF_DPI / 150)
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(2)
    const w = Math.min(a.width, b.width)
    const h = Math.min(a.height, b.height)
    const pa = blocks(a, w, h, 8)
    const pb = blocks(b, w, h, 8)
    const diff = pa.map((v, i) => Math.abs(v - pb[i]))
    const mean = diff.reduce((s, v) => s + v, 0) / diff.length
    const far = diff.filter((v) => v > 32).length / diff.length
    console.log(`${panel}: mean ${mean.toFixed(2)}, blocks differing > 32/255: ${(100 * far).toFixed(3)} %`)
    expect(mean).toBeLessThan(MAX_MEAN)
    expect(far).toBeLessThan(MAX_FAR)
  })
}
/**
 * Measured on these panels: correct output at most mean 2.2 and 0.95 % far blocks; with the
 * dominant-baseline defect every panel exceeds 1.5 % far blocks; with translucency lost every
 * panel exceeds mean 3.
 */
const MAX_MEAN = 3
const MAX_FAR = 0.015
