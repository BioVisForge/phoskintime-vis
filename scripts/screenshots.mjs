// Dev tool: open the single-file build from file://, load fixtures, and screenshot every panel.
// Usage: node scripts/screenshots.mjs [fixture ...]   (default: small-protwise network partial)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fixtures = process.argv.slice(2).length ? process.argv.slice(2) : ['small-protwise', 'network', 'partial']
const out = resolve('docs/screenshots')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const report = {}
for (const fx of fixtures) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('file://' + resolve('dist-single/index.html'))
  await page.setInputFiles('[data-testid=open-zip]', `tests/fixtures/out/${fx}.pkt.zip`)
  await page.waitForSelector('[data-testid=verify-badge][data-state=verified], [data-testid=verify-badge][data-state=mismatch]', { timeout: 30000 })
  mkdirSync(`${out}/${fx}`, { recursive: true })
  await page.locator('[data-testid=bundle-header]').screenshot({ path: `${out}/${fx}/_header.png` })
  const ids = await page.locator('[data-panel]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')))
  report[fx] = {}
  for (const id of ids) {
    const loc = page.locator(`[data-panel="${id}"]`)
    await loc.scrollIntoViewIfNeeded()
    await page.waitForFunction((id) => { const el = document.querySelector(`[data-panel="${id}"]`); return el && (el.getAttribute('data-available') === 'false' || (el.getAttribute('data-rendered') === 'true' && !el.querySelector('.loading'))) }, id, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(250)
    const marks = await loc.evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg line, svg image, canvas').length)
    await loc.screenshot({ path: `${out}/${fx}/${id}.png` })
    report[fx][id] = { available: (await loc.getAttribute('data-available')) === 'true', marks }
  }
  report[fx]._errors = errors
  await page.close()
}
// comparison mode: network (A, before) vs network-after-fix (B, after)
if (!process.env.NO_COMPARE) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('file://' + resolve('dist-single/index.html'))
  await page.setInputFiles('[data-testid=open-zip]', ['tests/fixtures/out/network.pkt.zip', 'tests/fixtures/out/network-after-fix.pkt.zip'])
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=verify-badge][data-state=verified]').length >= 1, null, { timeout: 30000 })
  await page.click('[data-testid=tab-compare]')
  await page.waitForSelector('[data-testid=compare-ready]', { timeout: 60000 })
  await page.waitForTimeout(800)
  mkdirSync(`${out}/compare`, { recursive: true })
  const ids = await page.locator('[data-compare-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-compare-section')))
  report.compare = {}
  for (const id of ids) {
    const loc = page.locator(`[data-compare-section="${id}"]`)
    await loc.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await loc.screenshot({ path: `${out}/compare/${id}.png` })
    report.compare[id] = { marks: await loc.evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg line, svg image, canvas').length) }
  }
  report.compare._errors = errors
  await page.close()
}
await browser.close()
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
console.log(JSON.stringify(report, null, 1))
