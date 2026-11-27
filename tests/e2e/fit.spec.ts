import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { APP, openZip, waitVerified, goSection } from './helpers'

// Fit to width: text is never scaled below the chosen pt size without confirmation.
test.skip(({ browserName }) => browserName !== 'chromium', 'export specs run in Chromium')
test.setTimeout(240_000)

async function open(page: Page, fixture: string, section: string) {
  await page.goto(APP)
  await openZip(page, fixture)
  await waitVerified(page)
  await goSection(page, section)
}

/** Quick SVG export from the panel menu, on a panel that does not fit 85 mm: opens the dialog with the warning. */
async function exportTooWide(page: Page, panel: string) {
  const card = page.locator(`[data-panel="${panel}"]`)
  await card.scrollIntoViewIfNeeded()
  await expect(card).toHaveAttribute('data-rendered', 'true')
  await expect(card.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  let downloads = 0
  page.on('download', () => downloads++)
  await card.locator('[data-testid=panel-menu]').click()
  await card.locator('[data-testid=export-svg]').click()
  const warning = page.locator('[data-testid=fit-warning]')
  await expect(warning).toBeVisible({ timeout: 120_000 })
  expect(downloads, 'nothing is exported before the user chooses').toBe(0)
  return warning
}

async function choose(page: Page, fix: string): Promise<{ svg: string; viewW: number; widthMm: number }> {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), page.click(`[data-testid=${fix}]`)])
  const svg = readFileSync((await dl.path())!, 'utf8')
  return { svg, viewW: Number(svg.match(/viewBox="\S+ \S+ (\S+) /)![1]), widthMm: Number(svg.match(/^<svg[^>]*? width="([\d.]+)mm"/)![1]) }
}

/** Layout width in px of a figure exported at the given mm without any scaling (5.6 px per mm). */
const unscaled = (mm: number) => Math.round(mm * 5.6)
const text = (svg: string) => svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const noScaling = (viewW: number, mm: number) => expect(viewW).toBeLessThanOrEqual(Math.ceil(unscaled(mm) * 1.006))

test('warning: names what sticks out, offers the fixes, exports nothing', async ({ page }) => {
  await open(page, 'network', 'uncertainty')
  const w = await exportTooWide(page, 'nm-post-ridge')
  await expect(w).toContainText('Labels do not fit 85 mm at 8 pt')
  await expect(w).toContainText('Nothing was exported')
  await expect(w.locator('[data-testid=fit-issue]')).toHaveAttribute('data-panel', 'nm-post-ridge')
  await expect(w).toContainText('tick label')
  await expect(w.locator('[data-testid=fit-shorten]')).toBeVisible()
  await expect(w.locator('[data-testid=fit-fewer-ticks]')).toBeVisible()
  await expect(w.locator('[data-testid=fit-next-preset]')).toContainText('1.5 column (114 mm)')
  await expect(w.locator('[data-testid=fit-scale]')).toContainText(/Scale anyway \(text \d\.\d pt\)/)
})

test('fix "shorter labels": no scaling, labels ellipsised, caption says so', async ({ page }) => {
  await open(page, 'network', 'uncertainty')
  await exportTooWide(page, 'nm-post-ridge')
  const r = await choose(page, 'fit-shorten')
  expect(r.widthMm).toBe(85)
  noScaling(r.viewW, 85)
  expect(r.svg).toContain('…')
  expect(text(r.svg)).toMatch(/Tick labels on .* shortened to \d+ characters/)
  expect(text(r.svg)).not.toContain('Scaled to')
})

test('fix "fewer ticks": no scaling, caption says which ticks are shown', async ({ page }) => {
  await open(page, 'network', 'parameters')
  await exportTooWide(page, 'nm-param-dist')
  const r = await choose(page, 'fit-fewer-ticks')
  expect(r.widthMm).toBe(85)
  noScaling(r.viewW, 85)
  expect(text(r.svg)).toMatch(/Every (2nd|3rd|4th) tick label shown/)
  expect(text(r.svg)).not.toContain('Scaled to')
})

test('fix "next width preset": exports at 114 mm without scaling', async ({ page }) => {
  await open(page, 'small-protwise', 'sensitivity')
  await exportTooWide(page, 'pw-sensitivity')
  const r = await choose(page, 'fit-next-preset')
  expect(r.widthMm).toBe(114)
  noScaling(r.viewW, 114)
  expect(text(r.svg)).not.toContain('Scaled to')
})

test('fix "scale anyway": caption records the resulting pt size; the choice is not remembered', async ({ page }) => {
  await open(page, 'network', 'uncertainty')
  const w = await exportTooWide(page, 'nm-post-ridge')
  const offered = Number((await w.locator('[data-testid=fit-scale]').innerText()).match(/text (\d\.\d) pt/)![1])
  const r = await choose(page, 'fit-scale')
  expect(r.widthMm).toBe(85)
  expect(r.viewW).toBeGreaterThan(unscaled(85)) // really scaled
  const m = text(r.svg).match(/Scaled to (\d+) % to fit 85 mm: text is (\d\.\d) pt instead of 8 pt/)!
  expect(m, 'caption records the pt size').toBeTruthy()
  expect(Number(m[2])).toBe(offered)
  expect(Number(m[2])).toBeCloseTo((8 * unscaled(85)) / r.viewW, 0)
  const saved = await page.evaluate(() => localStorage.getItem('pkv.export.settings.v1') ?? '{}')
  expect(saved).not.toMatch(/fitScale|fitShortenLabels|fitFewerTicks/)
  // the next quick export asks again
  await page.locator('[data-panel="nm-post-ridge"] [data-testid=panel-menu]').click()
  await page.locator('[data-panel="nm-post-ridge"] [data-testid=export-svg]').click()
  await expect(page.locator('[data-testid=fit-warning]')).toBeVisible({ timeout: 120_000 })
})
