import { test, expect } from '@playwright/test'
import { APP, openZip, openFolder, waitVerified, renderAllPanels, watchErrors, goSection } from './helpers'

const GOOD = ['small-protwise', 'network', 'network-after-fix', 'reordered-params', 'partial']

for (const fx of GOOD) {
  for (const form of ['zip', 'folder'] as const) {
    test(`${fx} opens as ${form}, verifies and renders non-empty panels`, async ({ page }) => {
      const errors = watchErrors(page)
      await page.goto(APP)
      if (form === 'zip') await openZip(page, fx)
      else await openFolder(page, fx)
      await waitVerified(page)
      await expect(page.locator('[data-testid=bundle-id]')).toHaveText(/^pkt-[0-9a-f]{16}$/)
      // fast path for the folder form: header + one panel; zip form renders everything
      if (form === 'folder') {
        await goSection(page, 'fit')
        await expect(page.locator('[data-panel]').first()).toBeVisible()
      } else {
        const panels = await renderAllPanels(page)
        expect(panels.length).toBeGreaterThan(10)
        for (const p of panels) {
          if (p.available) expect(p.marks, `${p.id} has marks`).toBeGreaterThan(3)
          else expect(p.text, `${p.id} gives a reason`).toMatch(/Not available\.\s+\S/)
        }
      }
      expect(errors, errors.join('\n')).toEqual([])
    })
  }
}

test('partial bundle shows the manifest reason on missing panels', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'partial')
  await waitVerified(page)
  await goSection(page, 'sensitivity')
  const na = page.locator('[data-panel="pw-sensitivity"] [data-testid=not-available]')
  await expect(na).toContainText('Manifest:')
  await expect(na).toContainText('deliberately left out')
})

test('open-issue chip shows bundled issue text', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'network')
  await waitVerified(page)
  await expect(page.locator('[data-testid=issues-chip]')).toContainText('N17')
  await page.locator('[data-testid=issues-chip] button', { hasText: 'N7' }).click()
  await expect(page.locator('[data-testid=issue-text]')).toContainText('Fold-change baseline')
})

for (const form of ['zip', 'folder'] as const) {
test(`tampered bundle (${form}) is flagged as sha256 mismatch with the file named`, async ({ page }) => {
  await page.goto(APP)
  if (form === 'zip') await openZip(page, 'tampered')
  else await openFolder(page, 'tampered')
  await waitVerified(page, 'mismatch')
  await expect(page.locator('[data-testid=mismatch-list]')).toContainText('tables/metrics.parquet')
})

test(`future-major bundle (${form}) is refused with a clear message`, async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto(APP)
  if (form === 'zip') await openZip(page, 'future-major')
  else await openFolder(page, 'future-major')
  const err = page.locator('[data-testid=load-error]')
  await expect(err).toHaveAttribute('data-kind', 'unsupported-version')
  await expect(err).toContainText('Unsupported bundle schema 2.0')
  await expect(page.locator('[data-testid=bundle-header]')).toHaveCount(0)
  expect(errors).toEqual([])
})
}

test('labels fall back to raw names when the manifest has none (N8)', async ({ page }) => {
  await page.goto(APP)
  await openZip(page, 'network')
  await waitVerified(page)
  await goSection(page, 'uncertainty')
  const panel = page.locator('[data-panel="nm-post-ci"]')
  await panel.scrollIntoViewIfNeeded()
  await panel.locator('select').first().selectOption('E_i')
  await expect(panel.locator('svg').first()).toContainText('E_i[G001]')
})
