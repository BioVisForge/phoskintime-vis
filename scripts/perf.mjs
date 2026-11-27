// Measured performance on the `network` fixture (single-file build from file://, headless).
// Usage: node scripts/perf.mjs [chromium|firefox]  -> prints JSON, writes docs/performance.json
import { chromium, firefox } from '@playwright/test'
import { statSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const which = process.argv[2] ?? 'chromium'
const bt = which === 'firefox' ? firefox : chromium
const browser = await bt.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } })
await page.goto('file://' + resolve('dist-single/index.html') + '#/fit')
const ready = (id) => page.waitForFunction((id) => {
  const el = document.querySelector(`[data-panel="${id}"]`)
  return el && el.getAttribute('data-rendered') === 'true' && !el.querySelector('.loading') && el.querySelectorAll('svg path, svg circle, svg rect, svg image, canvas').length > 0
}, id, { timeout: 120000, polling: 10 })

const t0 = Date.now()
await page.setInputFiles('[data-testid=open-zip]', resolve('tests/fixtures/out/network.pkt.zip'))
const first = await page.locator('[data-panel]').first().getAttribute('data-panel')
await ready(first)
const openToFirstPanel = Date.now() - t0
await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 120000 })
const openToVerified = Date.now() - t0

// each available panel in isolation ("Show only"), so queued neighbours do not distort timings
const topics = { fit: [], dynamics: [], parameters: [], uncertainty: [], sensitivity: [], network: [] }
for (const t of Object.keys(topics)) {
  await page.evaluate((h) => (location.hash = h), `#/${t}`)
  await page.waitForSelector('main h1')
  topics[t] = await page.locator('[data-panel][data-available=true]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')))
}
const panels = {}
for (const [t, ids] of Object.entries(topics)) {
  for (const id of ids) {
    await page.evaluate(() => (location.hash = '#/overview'))
    await page.waitForSelector('main h1')
    const t0p = Date.now()
    await page.evaluate((h) => (location.hash = h), `#/${t}?only=${id}`)
    await ready(id)
    panels[id] = Date.now() - t0p
  }
}
// raw lines on canvas: all 8,000 predicted series
await page.evaluate(() => (location.hash = '#/dynamics?only=nm-all-trajectories'))
await ready('nm-all-trajectories')
let t = Date.now()
await page.check('[data-testid=raw-lines]')
await page.waitForFunction(() => document.querySelector('[data-panel="nm-all-trajectories"] canvas'), null, { timeout: 120000, polling: 20 })
const rawLinesCanvas = Date.now() - t
await page.uncheck('[data-testid=raw-lines]')

// comparison: open B, switch tab, wait until all sections exist
t = Date.now()
await page.setInputFiles('[data-testid=open-zip]', resolve('tests/fixtures/out/network-after-fix.pkt.zip'))
await page.waitForFunction(() => document.querySelectorAll('[data-testid=tab-compare]:not([disabled])').length > 0)
await page.click('[data-testid=tab-compare]')
await page.waitForSelector('[data-testid=compare-ready] [data-compare-section="params"] svg', { timeout: 120000 })
const comparisonLoad = Date.now() - t

const heaviest = Object.entries(panels).sort((a, b) => b[1] - a[1])[0]
const res = {
  browser: `${which} ${browser.version()}`,
  date: new Date().toISOString(),
  fixture: 'network (100 proteins, 400 states x 20 samples = 8,000 series, 112,000 rows; 200 parameters; posterior 4x500x200)',
  openToFirstPanelMs: openToFirstPanel,
  openToVerifiedMs: openToVerified,
  heaviestPanel: { id: heaviest[0], ms: heaviest[1] },
  rawLinesCanvasMs: rawLinesCanvas,
  comparisonLoadMs: comparisonLoad,
  panelsMs: panels,
  singleFileBytes: statSync('dist-single/index.html').size,
}
await browser.close()
const f = 'docs/performance.json'
const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}
all[which] = res
writeFileSync(f, JSON.stringify(all, null, 1))
console.log(JSON.stringify(res, null, 1))
