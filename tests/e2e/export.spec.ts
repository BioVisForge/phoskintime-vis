import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { PNG } from 'pngjs'
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib'
import { APP, openZip, waitVerified, goSection, bundleId, shortId } from './helpers'
import { readPngInfo } from '../../src/lib/export/png'

// exports are heavy; Chromium only (Firefox runs the UI specs)
test.skip(({ browserName }) => browserName !== 'chromium', 'export specs run in Chromium')
test.setTimeout(240_000)

const NET = bundleId('network')
const NET8 = shortId('network')
const SMALL8 = shortId('small-protwise')

async function openNetwork(page: Page, section: string) {
  await page.goto(APP)
  await openZip(page, 'network')
  await waitVerified(page)
  await goSection(page, section)
}

async function exportVia(page: Page, panel: string, fmt: string): Promise<{ name: string; bytes: Buffer }> {
  const card = page.locator(`[data-panel="${panel}"]`)
  await card.scrollIntoViewIfNeeded()
  await expect(card).toHaveAttribute('data-rendered', 'true')
  await expect(card.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  await card.locator('[data-testid=panel-menu]').click()
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), card.locator(`[data-testid=export-${fmt}]`).click()])
  return { name: dl.suggestedFilename(), bytes: readFileSync((await dl.path())!) }
}

async function pdfInfo(bytes: Buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 1 })
  const text = (await page.getTextContent()).items.map((i: any) => i.str).join(' ')
  const meta = (await doc.getMetadata()).info as Record<string, string>
  const ops = await page.getOperatorList()
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const images = ops.fnArray.filter((f: number) => f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject).length
  // embedded TrueType font program for PKV Sans
  const pl = await PDFDocument.load(bytes)
  let embedded = false
  for (const [, obj] of pl.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('FontFile2')) && String(obj.get(PDFName.of('FontName'))).includes('PKV')) embedded = true
  }
  return { mm: [(vp.width / 72) * 25.4, (vp.height / 72) * 25.4], text, meta, images, embedded }
}

test('PNG: true 600 dpi pixel size, pHYs, provenance text chunks, filename', async ({ page, browser }) => {
  await openNetwork(page, 'fit')
  const png = await exportVia(page, 'nm-gof', 'png')
  expect(png.name).toMatch(new RegExp(`^nm-gof_${NET8}_\\d{8}\\.png$`))
  const info = readPngInfo(new Uint8Array(png.bytes))
  expect(info.width).toBe(Math.round((85 / 25.4) * 600))
  expect(info.dpiX).toBe(600)
  expect(info.text.bundle_id).toBe(NET)
  expect(info.text.panel_id).toBe('nm-gof')
  expect(info.text.phoskintime_commit).toMatch(/^e634e17/)
  expect(info.text.Software).toMatch(/^PhosKinTime-Vis /)
  // pixel-compare against a direct high-resolution render of the same vector SVG
  const svg = await exportVia(page, 'nm-gof', 'svg')
  const ctx = await browser.newContext({ deviceScaleFactor: info.width / 476, viewport: { width: 476, height: 1200 } })
  const p2 = await ctx.newPage()
  const svgText = svg.bytes.toString('utf8').replace(/width="[^"]+mm" height="[^"]+mm"/, (m) => m.replace(/width="[^"]+"/, 'width="476"').replace(/height="([\d.]+)mm"/, (_x, h) => `height="${((+h * 476) / 85).toFixed(3)}"`))
  await p2.setContent(`<html><body style="margin:0;background:#fff">${svgText}</body></html>`)
  await p2.waitForTimeout(500)
  const shot = PNG.sync.read(await p2.locator('svg').first().screenshot())
  const exp = PNG.sync.read(png.bytes)
  const w = Math.min(shot.width, exp.width)
  const h = Math.min(shot.height, exp.height)
  expect(Math.abs(shot.width - exp.width)).toBeLessThanOrEqual(2)
  let diff = 0
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * exp.width + x) * 4
    const j = (y * shot.width + x) * 4
    diff += Math.abs(exp.data[i] - shot.data[j]) + Math.abs(exp.data[i + 1] - shot.data[j + 1]) + Math.abs(exp.data[i + 2] - shot.data[j + 2])
  }
  const meanAbs = diff / ((w / 2) * (h / 2) * 3)
  // anti-aliasing differs slightly between canvas drawImage and the compositor; a bitmap upscale would differ far more
  expect(meanAbs).toBeLessThan(6)
  await ctx.close()
})

test('PDF: page size in mm, embedded PKV Sans, extractable axis labels, provenance metadata, vector', async ({ page }) => {
  await openNetwork(page, 'fit')
  const pdf = await exportVia(page, 'nm-gof', 'pdf')
  const i = await pdfInfo(pdf.bytes)
  expect(i.mm[0]).toBeCloseTo(85, 0)
  expect(i.embedded).toBe(true)
  expect(i.text).toContain('Observed')
  expect(i.text).toContain('Predicted')
  expect(i.text).toMatch(/Robust-σ/)
  expect(i.meta.Title).toContain('nm-gof')
  expect(i.meta.Subject).toContain(`pkt-${NET8}`)
  expect(i.meta.Keywords).toContain(`bundle_id=${NET}`)
  expect(i.images).toBe(0) // 4,912 + 4,912 points < 50,000: fully vector
})

test('PDF: a data layer above 50,000 elements is rasterised at 600 dpi and the caption says so', async ({ page }) => {
  await openNetwork(page, 'dynamics')
  await page.check('[data-testid=raw-lines]')
  const pdf = await exportVia(page, 'nm-all-trajectories', 'pdf')
  const i = await pdfInfo(pdf.bytes)
  expect(i.images).toBeGreaterThanOrEqual(1)
  expect(i.text).toMatch(/rasterised at 600 dpi/)
  expect(i.text).toContain('Predicted FC') // axes stay vector text
})

test('SVG: size in mm, embedded font, light theme; CSV: provenance header and units', async ({ page }) => {
  await openNetwork(page, 'fit')
  await page.click('[data-testid=theme-toggle]') // dark UI: export must still be light
  const svg = (await exportVia(page, 'nm-gof', 'svg')).bytes.toString('utf8')
  expect(svg).toMatch(/^<svg[^>]+width="85mm"/)
  expect(svg).toContain("@font-face{font-family:'PKV Sans'")
  expect(svg).toContain('fill="#ffffff"')
  expect(svg).not.toContain('<canvas')
  const csv = (await exportVia(page, 'nm-gof', 'csv')).bytes.toString('utf8')
  expect(csv.split('\n')[0]).toBe('# PhosKinTime-Vis export: Goodness of fit (overall and per layer)')
  expect(csv).toContain(`# bundle_id: ${NET}`)
  expect(csv).toMatch(/# units: .*time=min/)
  expect(csv).toContain('# empty field = null (missing value, never zero)')
})

test('TikZ: zip with tikzpicture, standalone document, full-precision data, README', async ({ page }) => {
  await openNetwork(page, 'uncertainty')
  const z = await exportVia(page, 'nm-post-ridge', 'tikz')
  expect(z.name).toMatch(new RegExp(`^nm-post-ridge_${NET8}_\\d{8}_tikz\\.zip$`))
  const files = unzipSync(new Uint8Array(z.bytes))
  const names = Object.keys(files)
  expect(names).toContain('nm-post-ridge.tex')
  expect(names).toContain('nm-post-ridge-standalone.tex')
  expect(names).toContain('README.txt')
  expect(names.some((n) => n.startsWith('data/') && n.endsWith('.dat'))).toBe(true)
  const tex = strFromU8(files['nm-post-ridge.tex'])
  expect(tex).toMatch(/^% PhosKinTime-Vis PGFPlots export: Posterior ridgeline/)
  expect(tex).toContain(`% bundle_id: ${NET}`)
  expect(tex).toContain('\\begin{tikzpicture}')
  expect(strFromU8(files['nm-post-ridge-standalone.tex'])).toContain('\\pgfplotsset{compat=1.18}')
  const dat = strFromU8(files[names.find((n) => n.startsWith('data/'))!])
  expect(dat.split('\n')[1].split('\t')[0]).toMatch(/^-?\d\.\d{16}(e[-+]\d+)?$|^nan$/)
})

test('Export all panels: one zip with every available panel, settings remembered', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'small-protwise')
  await waitVerified(page)
  await page.keyboard.press('Control+k')
  await page.fill('[data-testid=palette-input]', 'Export all panels')
  await page.keyboard.press('Enter')
  const dlg = page.locator('[data-testid=export-dialog-el]')
  await expect(dlg).toBeVisible()
  for (const f of ['png', 'pdf', 'svg', 'tikz']) if (await page.locator(`[data-testid=fmt-${f}]`).isChecked()) await page.click(`[data-testid=fmt-${f}]`)
  if (!(await page.locator('[data-testid=fmt-csv]').isChecked())) await page.click('[data-testid=fmt-csv]')
  await page.fill('[data-testid=export-font]', '9')
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), page.click('[data-testid=export-run]')])
  expect(dl.suggestedFilename()).toMatch(new RegExp(`^all-panels_${SMALL8}_\\d{8}\\.zip$`))
  const files = Object.keys(unzipSync(new Uint8Array(readFileSync((await dl.path())!))))
  expect(files.length).toBe(15) // every available protwise panel
  expect(files.every((f) => new RegExp(`_${SMALL8}_\\d{8}\\.csv$`).test(f))).toBe(true)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pkv.export.settings.v1') ?? '{}'))
  expect(saved.fontPt).toBe(9)
})

test('PNG: an over-size request is refused, never downscaled', async ({ page }) => {
  await openNetwork(page, 'fit')
  await page.locator('[data-panel="nm-gof"] [data-testid=panel-menu]').click()
  await page.locator('[data-panel="nm-gof"] [data-testid=export-dialog]').click()
  await page.getByLabel('Custom').check()
  await page.fill('[data-testid=export-width]', '1200')
  await page.selectOption('[data-testid=export-dpi]', '1200')
  await expect(page.getByRole('alert')).toContainText('not downscaled')
  await expect(page.locator('[data-testid=export-run]')).toBeDisabled()
})
