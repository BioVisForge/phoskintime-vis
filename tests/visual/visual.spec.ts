/**
 * Visual regression: one screenshot per section per theme (Chromium, fixed viewport).
 * Update baselines after an intended visual change:
 *   npm run build:single && npx playwright test --project=visual --update-snapshots
 * then review the changed PNGs in tests/visual/visual.spec.ts-snapshots/ before committing.
 */
import { test, expect } from '@playwright/test'
import { APP, openZip, waitVerified, goSection, renderSectionPanels, PANEL_SECTIONS } from '../e2e/helpers'

const SECTIONS = ['overview', ...PANEL_SECTIONS, 'compare'] as const
for (const theme of ['light', 'dark'] as const) {
  for (const s of SECTIONS) {
    test(`${s} (${theme})`, async ({ page }) => {
      await page.goto(APP)
      await page.evaluate((t) => localStorage.setItem('pkv.theme', t), theme)
      await page.reload()
      await openZip(page, 'network', 'network-after-fix')
      await waitVerified(page)
      await goSection(page, s)
      if (s === 'compare') await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
      else if (s !== 'overview') {
        await renderSectionPanels(page)
        await page.locator('main').evaluate((m) => m.scrollTo(0, 0))
      }
      await page.waitForTimeout(300)
      await expect(page).toHaveScreenshot(`${s}-${theme}.png`, { maxDiffPixelRatio: 0.01, animations: 'disabled' })
    })
  }
}
