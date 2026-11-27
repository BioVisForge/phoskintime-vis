/**
 * The performance paths (feat/wasm-perf), in Chromium and Firefox, from file://:
 * fast layers on and off (`?fast=0`) over every panel in one session, pan/zoom, brushing on
 * 102,868 points (gof-100k), and high-resolution exports of the raw-lines panel at the default
 * 85 mm in both browsers (Firefox used to refuse it: decision 0006).
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { APP, openZip, waitVerified, goSection, renderAllPanels, watchErrors, bundleId } from './helpers'
import { readPngInfo } from '../../src/lib/export/png'

test.setTimeout(300_000)

async function open(page: Page, query = '', fixture = 'network') {
  await page.goto(APP + query)
  await openZip(page, fixture)
  await waitVerified(page)
}

for (const [mode, query] of [['fast layers', ''], ['fallback (fast=0)', '?fast=0']] as const) {
  test(`every panel renders in one session: ${mode}`, async ({ page }) => {
    const errors = watchErrors(page)
    await open(page, query)
    const panels = await renderAllPanels(page)
    const available = panels.filter((p) => p.available)
    expect(available.length).toBeGreaterThan(15)
    for (const p of available) expect(p.marks, `${p.id} draws something`).toBeGreaterThan(0)
    const fast = await page.locator('[data-fast-layer]').count()
    if (query) expect(fast).toBe(0)
    expect(errors).toEqual([])
  })
}

/** the plot's own svg inside a zoomable plot (legend swatches are svgs too) */
async function plotBox(page: Page, panel: string) {
  const boxes = await page.locator(`[data-panel="${panel}"] .pkv-zoomwrap svg`).evaluateAll((ss) =>
    ss.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 100).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
  )
  return boxes[0]
}
const xTicks = (page: Page, panel: string) => page.locator(`[data-panel="${panel}"] .pkv-zoomwrap g.axis-x g.tick text`).evaluateAll((ts) => ts.map((t) => t.textContent ?? ''))

test('pan and zoom: buttons, Ctrl+wheel, pan mode, reset; exports keep the full range', async ({ page, browserName }) => {
  const errors = watchErrors(page)
  await open(page)
  await goSection(page, 'fit')
  const card = page.locator('[data-panel="nm-gof"]')
  await expect(card.locator('[data-testid=zoom-in]')).toBeVisible({ timeout: 60_000 })
  const full = await xTicks(page, 'nm-gof')
  await card.locator('[data-testid=zoom-in]').click()
  await expect.poll(() => xTicks(page, 'nm-gof')).not.toEqual(full)
  await expect(card.locator('.pkv-zoomwrap')).toHaveAttribute('data-zoomed', 'true')
  await card.locator('[data-testid=zoom-reset]').click()
  await expect.poll(() => xTicks(page, 'nm-gof')).toEqual(full)
  // Ctrl+wheel over the plot
  const b = await plotBox(page, 'nm-gof')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.keyboard.down('Control')
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect(card.locator('.pkv-zoomwrap')).toHaveAttribute('data-zoomed', 'true')
  const zoomed = await xTicks(page, 'nm-gof')
  // pan mode: dragging moves the view
  await card.locator('[data-testid=zoom-pan]').click()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 - 80, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => xTicks(page, 'nm-gof')).not.toEqual(zoomed)
  // the data layer is clipped to the frame while zoomed
  expect(await card.locator('.pkv-zoomwrap foreignObject[data-fast-layer]').first().getAttribute('clip-path')).toMatch(/^url\(#pkv-zoom-clip-/)
  // an export of a zoomed panel shows the full data range (the export renders the panel afresh)
  if (browserName === 'chromium') {
    await card.locator('[data-testid=panel-menu]').click()
    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('[data-testid=export-svg]').click()])
    const svg = readFileSync((await dl.path())!, 'utf8')
    for (const t of full.filter((x) => x.trim())) expect(svg).toContain(`>${t}<`)
  }
  // double-click in pan mode resets
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await expect.poll(() => xTicks(page, 'nm-gof')).toEqual(full)
  expect(errors).toEqual([])
})

test('brushing on 102,868 points (gof-100k): a selection is made and reported', async ({ page }) => {
  const errors = watchErrors(page)
  await open(page, '', 'gof-100k')
  await page.evaluate(() => (location.hash = '#/fit?only=nm-gof'))
  const card = page.locator('[data-panel="nm-gof"]')
  await expect(card.locator('[data-fast-layer="dots"]').first()).toBeVisible({ timeout: 120_000 })
  expect(Number(await card.locator('[data-fast-layer="dots"]').first().getAttribute('data-fast-elements'))).toBeGreaterThan(100_000)
  const b = await plotBox(page, 'nm-gof')
  await page.evaluate(() => {
    const g = globalThis as any
    g.__frames = []
    const tick = (t: number) => {
      g.__frames.push(t)
      if (g.__frames.length < 2000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.7, { steps: 30 })
  await page.mouse.up()
  const sel = card.locator('[data-testid=selection] b')
  await expect(sel).not.toHaveText('0', { timeout: 30_000 })
  const n = Number(await sel.innerText())
  expect(n).toBeGreaterThan(1000)
  expect(n).toBeLessThan(102_868)
  const iv: number[] = await page.evaluate(() => {
    const f = (globalThis as any).__frames as number[]
    return f.slice(1).map((t, i) => t - f[i])
  })
  iv.sort((x, y) => x - y)
  test.info().annotations.push({ type: 'frames', description: `brush on 102,868 points: ${iv.length} frames, median ${iv[iv.length >> 1].toFixed(1)} ms, p95 ${iv[Math.floor(iv.length * 0.95)].toFixed(1)} ms` })
  expect(errors).toEqual([])
})

for (const [fmt, dpi] of [['png', '1200'], ['pdf', '600']] as const) {
  test(`raw-lines panel at 85 mm exports as ${fmt.toUpperCase()} (${dpi} dpi) in every browser`, async ({ page }) => {
    await open(page)
    await goSection(page, 'dynamics')
    await page.check('[data-testid=raw-lines]')
    const card = page.locator('[data-panel="nm-all-trajectories"]')
    await expect(card.locator('canvas').first()).toBeVisible({ timeout: 60_000 })
    await card.locator('[data-testid=panel-menu]').click()
    await card.locator('[data-testid=export-dialog]').click()
    await page.selectOption('[data-testid=export-dpi]', dpi)
    for (const f of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
      const box = page.locator(`[data-testid=fmt-${f}]`)
      if ((await box.isChecked()) !== (f === fmt)) await box.click()
    }
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240_000 }), page.click('[data-testid=export-run]')])
    await expect(page.locator('[data-testid=fit-warning]')).toHaveCount(0)
    const bytes = new Uint8Array(readFileSync((await dl.path())!))
    if (fmt === 'png') {
      const info = readPngInfo(bytes)
      expect(info.dpiX).toBe(1200)
      expect(info.width).toBe(Math.round((85 / 25.4) * 1200))
      expect(info.text.bundle_id).toBe(bundleId('network'))
    } else {
      expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-')
    }
  })
}
