// Export every comparison-mode section (A = network, B = network-after-fix) through the UI
// (single-file build, file://, Chromium), one file per section.
// Usage: node tests/tikz/export_compare.mjs <outDir> [formats=tikz]
// Then: bash tests/tikz/compile_all.sh <outDir> [workdir]   (accepts a directory of *_tikz.zip)
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const [outDir = 'tests/tikz/out/compare', formats = 'tikz'] = process.argv.slice(2)
mkdirSync(resolve(outDir), { recursive: true })
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('file://' + resolve('dist-single/index.html') + '#/overview')
await page.setInputFiles('[data-testid=open-zip]', ['network', 'network-after-fix'].map((n) => resolve(`tests/fixtures/out/${n}.pkt.zip`)))
await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 60000 })
await page.evaluate(() => (location.hash = '#/compare'))
await page.waitForSelector('[data-testid=compare-ready]', { timeout: 60000 })
const ids = await page.locator('[data-compare-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-compare-section')))
const files = []
for (const id of ids) {
  for (const f of formats.split(',')) {
    // table-only sections have no TikZ button
    if (!(await page.locator(`[data-compare-section="${id}"] [data-testid=cmp-export-${f}]`).count())) continue
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click(`[data-compare-section="${id}"] [data-testid=cmp-export-${f}]`)])
    const p = join(resolve(outDir), dl.suggestedFilename())
    await dl.saveAs(p)
    files.push(p)
  }
}
console.log(JSON.stringify({ sections: ids, files, errors }))
await browser.close()
if (errors.length) process.exit(1)
