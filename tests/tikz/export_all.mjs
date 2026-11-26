// "Export all panels" through the UI (single-file build, file://, Chromium).
// Usage: node tests/tikz/export_all.mjs <fixture> <outDir> [formats=tikz] [dpi=600]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const [fixture = 'network', outDir = 'tests/tikz/out', formats = 'tikz', dpi = '600'] = process.argv.slice(2)
mkdirSync(resolve(outDir), { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('file://' + resolve('dist-single/index.html') + '#/overview')
await page.setInputFiles('[data-testid=open-zip]', resolve(`tests/fixtures/out/${fixture}.pkt.zip`))
await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 60000 })
await page.keyboard.press('Control+k')
await page.fill('[data-testid=palette-input]', 'Export all panels')
await page.keyboard.press('Enter')
await page.waitForSelector('[data-testid=export-dialog-el][open]')
for (const f of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
  const box = page.locator(`[data-testid=fmt-${f}]`)
  if ((await box.isChecked()) !== formats.split(',').includes(f)) await box.click()
}
await page.selectOption('[data-testid=export-dpi]', dpi)
const t0 = Date.now()
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 1_200_000 }), page.click('[data-testid=export-run]')])
const p = join(resolve(outDir), dl.suggestedFilename())
await dl.saveAs(p)
console.log(JSON.stringify({ zip: p, ms: Date.now() - t0, errors }))
await browser.close()
