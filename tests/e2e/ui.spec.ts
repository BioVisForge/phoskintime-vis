import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { APP, openZip, waitVerified, goSection, renderSectionPanels, PANEL_SECTIONS, watchErrors } from './helpers'

test('navigation by section, sidebar counts and current page', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'network')
  await waitVerified(page)
  await page.click('[data-testid=nav-uncertainty]')
  await expect(page).toHaveURL(/#\/uncertainty/)
  await expect(page.locator('main h1')).toHaveText('Uncertainty')
  await expect(page.locator('[data-testid=nav-uncertainty]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('[data-panel="nm-post-ridge"]')).toBeVisible()
  await expect(page.locator('[data-panel="pw-gof"]')).toHaveCount(0) // protwise panels hidden for a networkmodel bundle
})

test('command palette jumps to a panel and runs actions (Ctrl+K)', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'network')
  await waitVerified(page)
  await page.keyboard.press('Control+k')
  await expect(page.locator('[data-testid=palette]')).toBeVisible()
  await page.fill('[data-testid=palette-input]', 'ridgeline')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/uncertainty\/nm-post-ridge/)
  await expect(page.locator('[data-panel="nm-post-ridge"]')).toBeInViewport()
  await page.keyboard.press('Control+k')
  await page.fill('[data-testid=palette-input]', 'dark theme')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('deep link restores section, panel and global context', async ({ page }) => {
  await page.goto(APP + '#/dynamics/nm-timeseries?protein=G007&layer=phospho')
  await openZip(page, 'network')
  await waitVerified(page)
  await expect(page.locator('main h1')).toHaveText('Dynamics')
  await expect(page.locator('[data-testid=ctx-current]')).toHaveText('G007')
  await expect(page.locator('[data-testid=ctx-layer]')).toHaveValue('phospho')
})

test('the global protein selector drives every dependent panel and the URL', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto(APP + '#/dynamics')
  await openZip(page, 'network')
  await waitVerified(page)
  await page.fill('[data-testid=ctx-protein]', 'G042')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid=ctx-current]')).toHaveText('G042')
  await expect(page).toHaveURL(/protein=G042/)
  for (const id of ['nm-timeseries', 'nm-all-trajectories']) {
    const card = page.locator(`[data-panel="${id}"]`)
    await card.scrollIntoViewIfNeeded()
    await expect(card.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  }
  // time series rows are G042 only
  const ts = page.locator('[data-panel="nm-timeseries"]')
  await ts.locator('[data-testid=panel-menu]').click()
  await ts.getByRole('menuitem', { name: /View data/ }).click()
  const proteins = await ts.locator('.raw tbody tr td:nth-child(2)').allInnerTexts()
  expect(proteins.length).toBeGreaterThan(5)
  expect(new Set(proteins)).toEqual(new Set(['G042']))
  // predictive bands follow the same protein
  await goSection(page, 'uncertainty')
  const pp = page.locator('[data-panel="nm-post-predictive"]')
  await pp.scrollIntoViewIfNeeded()
  await expect(pp.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  await pp.locator('[data-testid=panel-menu]').click()
  await pp.getByRole('menuitem', { name: /View data/ }).click()
  await expect(pp.locator('.raw tbody tr').first()).toContainText('G042_')
  expect(errors).toEqual([])
})

test('theme toggle switches and persists; export stays light', async ({ page }) => {
  await page.goto(APP)
  await page.click('[data-testid=theme-toggle]')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).not.toBe('rgb(0, 0, 0)') // dark theme never pure black
})

for (const theme of ['light', 'dark'] as const) {
  test(`axe: no serious or critical violations on any section (${theme})`, async ({ page, browserName }) => {
    test.setTimeout(240_000)
    // Playwright's Firefox (build 1572) segfaults the content process (signal 11) when a script
    // reads the reflected ariaLabelledByElements of the overview section, which axe-core 4.14.1
    // does. Without the getter axe reads the aria-labelledby attribute, so the same relationship is
    // still checked. The app itself never reads this property.
    if (browserName === 'firefox') await page.addInitScript(() => delete (Element.prototype as any).ariaLabelledByElements)
    await page.goto(APP)
    await page.evaluate((t) => localStorage.setItem('pkv.theme', t), theme)
    await page.reload()
    await openZip(page, 'network', 'network-after-fix')
    await waitVerified(page)
    const sections = ['overview', ...PANEL_SECTIONS, 'compare']
    for (const s of sections) {
      await goSection(page, s)
      if (s !== 'overview' && s !== 'compare') await renderSectionPanels(page)
      if (s === 'compare') await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
      // charts are SVG drawings with a text alternative on the figure; axe checks the UI around them
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.svelteplot svg').analyze()
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(bad.map((v) => `${s}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`), JSON.stringify(bad.map((v) => v.nodes.slice(0, 2).map((n) => n.failureSummary)), null, 1)).toEqual([])
    }
  })
}
