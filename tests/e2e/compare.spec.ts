import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { APP, openZip, waitVerified, watchErrors } from './helpers'

test('comparison: network vs network-after-fix, aligned, and report export', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto(APP)
  await openZip(page, 'network', 'network-after-fix')
  await waitVerified(page)
  await page.click('[data-testid=tab-compare]')
  await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid=param-alignment]')).toHaveAttribute('data-mode', 'aligned')
  await expect(page.locator('[data-testid=issue-diff]')).toContainText('N5')
  await expect(page.locator('[data-testid=gof-compare] tbody tr')).toHaveCount(4)
  for (const id of ['overlay', 'delta-lines', 'delta-raster', 'params']) {
    const marks = await page.locator(`[data-compare-section="${id}"]`).evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg image, canvas').length)
    expect(marks, id).toBeGreaterThan(3)
  }
  const downloads: string[] = []
  page.on('download', async (d) => downloads.push((await d.path())!))
  const [d1] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-report]')])
  await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1)
  const html = readFileSync((await d1.path())!, 'utf8')
  expect(html).toContain('Run comparison: A (before) vs B (after)')
  expect(html).toContain('<svg')
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2)
  const csv = readFileSync(downloads.find((p) => readFileSync(p, 'utf8').startsWith('kind,'))!, 'utf8')
  expect(csv.split('\n').filter((l) => l.startsWith('parameter,')).length).toBe(200)
  expect(csv).toContain('trajectory_pred,')
  expect(errors, errors.join('\n')).toEqual([])
})

test('comparison by name when the parameter order differs', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'network', 'reordered-params')
  await waitVerified(page)
  await page.click('[data-testid=tab-compare]')
  await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
  const al = page.locator('[data-testid=param-alignment]')
  await expect(al).toHaveAttribute('data-mode', 'by-name')
  await expect(al).toContainText('only in A: tf_scale')
  await expect(al).toContainText('only in B: Dp_i[G050_S1]')
})
