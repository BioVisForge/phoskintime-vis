// Export sample panels in every format through the UI (single-file build, file://, Chromium).
// Usage: node scripts/export-samples.mjs [outDir]   default docs/samples/exports
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const out = resolve(process.argv[2] ?? 'docs/samples/exports')
mkdirSync(out, { recursive: true })
const SAMPLES = [
  { fixture: 'network', panel: 'nm-gof', section: 'fit' },
  { fixture: 'network', panel: 'nm-all-trajectories', section: 'dynamics' },
  { fixture: 'network', panel: 'nm-post-ridge', section: 'uncertainty' },
]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('file://' + resolve('dist-single/index.html') + '#/overview')
await page.setInputFiles('[data-testid=open-zip]', resolve('tests/fixtures/out/network.pkt.zip'))
await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 60000 })
const files = []
for (const s of SAMPLES) {
  await page.evaluate((h) => (location.hash = h), `#/${s.section}/${s.panel}`)
  const card = page.locator(`[data-panel="${s.panel}"]`)
  await card.scrollIntoViewIfNeeded()
  await page.waitForFunction((id) => { const el = document.querySelector(`[data-panel="${id}"]`); return el?.dataset.rendered === 'true' && !el.querySelector('.loading') }, s.panel, { timeout: 60000 })
  for (const fmt of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
    await card.locator('[data-testid=panel-menu]').click()
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), card.locator(`[data-testid=export-${fmt}]`).click()])
    const p = join(out, dl.suggestedFilename())
    await dl.saveAs(p)
    files.push(p)
    console.log('saved', p)
  }
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
await browser.close()
