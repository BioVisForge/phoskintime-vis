import { expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'

export const APP = 'file://' + resolve('dist-single/index.html')
export const FIX = (n: string) => resolve(`tests/fixtures/out/${n}`)

/** Collect console errors and page errors for the no-console-errors check. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

export async function openZip(page: Page, ...names: string[]) {
  await page.setInputFiles('[data-testid=open-zip]', names.map((n) => FIX(`${n}.pkt.zip`)))
}

export async function openFolder(page: Page, name: string) {
  await page.setInputFiles('[data-testid=open-folder]', FIX(`${name}.pkt`))
}

export async function waitVerified(page: Page, state = 'verified') {
  await expect(page.locator(`[data-testid=verify-badge][data-state=${state}]`).first()).toBeVisible({ timeout: 30_000 })
}

export const PANEL_SECTIONS = ['fit', 'dynamics', 'parameters', 'uncertainty', 'sensitivity', 'network'] as const

export async function goSection(page: Page, section: string) {
  await page.evaluate((h) => (location.hash = h), `#/${section}`)
  await expect(page.locator('main h1')).toBeVisible()
}

/** Visit every section and scroll through its panels so lazy panels render. */
export async function renderAllPanels(page: Page) {
  const out: { id: string; available: boolean; marks: number; text: string }[] = []
  for (const sec of PANEL_SECTIONS) {
    await goSection(page, sec)
    out.push(...(await renderSectionPanels(page)))
  }
  return out
}

export async function renderSectionPanels(page: Page) {
  const ids = await page.locator('[data-panel]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')!))
  const out: { id: string; available: boolean; marks: number; text: string }[] = []
  for (const id of ids) {
    const loc = page.locator(`[data-panel="${id}"]`)
    await loc.scrollIntoViewIfNeeded()
    const available = (await loc.getAttribute('data-available')) === 'true'
    if (available) {
      await expect(loc).toHaveAttribute('data-rendered', 'true')
      await expect(loc.locator('.loading')).toHaveCount(0, { timeout: 30_000 })
      await page.waitForTimeout(100)
    }
    const marks = await loc.evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg line, svg image, canvas').length)
    out.push({ id, available, marks, text: available ? '' : await loc.locator('[data-testid=not-available]').innerText() })
  }
  return out
}
