/**
 * Visual parity of the fast data layers: every canvas a panel draws with the fast layers on is
 * compared, pixel by pixel, with the canvas SveltePlot draws for the same mark (`?fast=0`), at
 * the same size and device pixel ratio.
 *
 * Tolerance (documented in docs/decisions/0006-wasm-perf.md): a channel may differ by at most
 * AA_TOL levels of 255 (anti-aliasing of the same path rasterised in a different order of
 * operations); at most AA_MAX_FRACTION of the pixels may differ at all. Anything larger fails.
 */
import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { openZip, waitVerified } from '../e2e/helpers'

export const AA_TOL = 2
export const AA_MAX_FRACTION = 0.001

const APP = 'file://' + resolve('dist-single/index.html')
/** panels whose data marks the fast layers draw on screen (network fixture) */
export const FAST_PANELS: [string, string][] = [
  ['fit', 'nm-gof'],
  ['fit', 'nm-residuals'],
  ['parameters', 'nm-param-parallel'],
]

async function canvases(page: Page, query: string, section: string, id: string, compat = false) {
  if (compat) await page.addInitScript(() => ((globalThis as any).__PKV_DOTCANVAS_COMPAT__ = true))
  await page.goto(APP + query)
  await openZip(page, 'network')
  await waitVerified(page)
  await page.evaluate((h) => (location.hash = h), `#/${section}?only=${id}`)
  const card = page.locator(`[data-panel="${id}"]`)
  await expect(card).toHaveAttribute('data-rendered', 'true', { timeout: 60_000 })
  await expect(card.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  await page.waitForTimeout(500)
  const layers = await card.locator('[data-fast-layer]').count()
  expect(layers > 0, `fast layers ${query === '?fast=0' ? 'off' : 'on'}`).toBe(query !== '?fast=0')
  return card.evaluate((el) =>
    [...el.querySelectorAll('canvas')].map((c) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      return { w: c.width, h: c.height, px: Array.from(d) }
    }),
  )
}

test.skip(({ browserName }) => browserName !== 'chromium', 'pixel parity runs in Chromium (the Firefox e2e covers the fast path functionally)')

/**
 * Canvases where the fast layer intentionally differs from SveltePlot's DotCanvas: dots with an
 * explicit strokeWidth (DotCanvas always strokes at 1.6 px; the fast layer and the vector export
 * use the mark's strokeWidth). For these the comparison runs with __PKV_DOTCANVAS_COMPAT__, which
 * makes the fast layer stroke at 1.6 px too; equality then shows nothing else differs.
 */
export const STROKE_WIDTH_CANVASES: Record<string, number[]> = { 'nm-gof': [0] }

for (const [section, id] of FAST_PANELS) {
  test(`fast layer = SveltePlot canvas, pixel for pixel: ${id}`, async ({ page, browser }) => {
    test.setTimeout(240_000)
    const ref = await canvases(page, '?fast=0', section, id)
    const fast = await canvases(page, '', section, id)
    if (STROKE_WIDTH_CANVASES[id]) {
      const p2 = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 })
      const compat = await canvases(p2, '', section, id, true)
      await p2.close()
      for (const k of STROKE_WIDTH_CANVASES[id]) fast[k] = compat[k]
    }
    expect(fast.length, 'same number of canvas layers').toBe(ref.length)
    expect(fast.length).toBeGreaterThan(0)
    for (let k = 0; k < ref.length; k++) {
      expect([fast[k].w, fast[k].h]).toEqual([ref[k].w, ref[k].h])
      let differ = 0
      let maxd = 0
      for (let i = 0; i < ref[k].px.length; i++) {
        const d = Math.abs(ref[k].px[i] - fast[k].px[i])
        if (d) differ++
        if (d > maxd) maxd = d
      }
      const frac = differ / ref[k].px.length
      test.info().annotations.push({ type: 'parity', description: `${id} canvas ${k}: max channel diff ${maxd}, differing ${(frac * 100).toFixed(4)} %` })
      expect(maxd, `${id} canvas ${k}: max channel difference`).toBeLessThanOrEqual(AA_TOL)
      expect(frac, `${id} canvas ${k}: fraction of differing channels`).toBeLessThanOrEqual(AA_MAX_FRACTION)
    }
  })
}
