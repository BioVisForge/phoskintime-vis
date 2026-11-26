// Dev tool: screenshots for docs/screenshots (single-file build from file://, Chromium).
//   node scripts/screenshots.mjs            -> sections (light+dark), every panel, comparison sections
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const out = resolve('docs/screenshots')
mkdirSync(out, { recursive: true })
const APP = 'file://' + resolve('dist-single/index.html')
const SECTIONS = ['overview', 'fit', 'dynamics', 'parameters', 'uncertainty', 'sensitivity', 'network', 'compare']
const browser = await chromium.launch()
const report = { sections: {}, panels: {}, compare: {} }

async function newPage(theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(APP)
  await page.evaluate((t) => localStorage.setItem('pkv.theme', t), theme)
  await page.reload()
  return { page, errors }
}
async function open(page, ...fx) {
  await page.setInputFiles('[data-testid=open-zip]', fx.map((f) => `tests/fixtures/out/${f}.pkt.zip`))
  await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 60000 })
}
async function renderPanels(page) {
  const ids = await page.locator('[data-panel]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')))
  for (const id of ids) {
    await page.locator(`[data-panel="${id}"]`).scrollIntoViewIfNeeded()
    await page.waitForFunction((id) => { const el = document.querySelector(`[data-panel="${id}"]`); return el && (el.getAttribute('data-available') === 'false' || (el.getAttribute('data-rendered') === 'true' && !el.querySelector('.loading'))) }, id, { timeout: 60000 }).catch(() => {})
  }
  return ids
}
async function go(page, hash) {
  await page.evaluate((h) => (location.hash = h), hash)
  await page.waitForSelector('main h1')
}

// 1. sections in both themes (network vs network-after-fix loaded)
for (const theme of ['light', 'dark']) {
  const { page, errors } = await newPage(theme)
  await open(page, 'network', 'network-after-fix')
  mkdirSync(`${out}/sections`, { recursive: true })
  for (const s of SECTIONS) {
    await go(page, `#/${s}`)
    if (s === 'compare') await page.waitForSelector('[data-testid=compare-ready]', { timeout: 60000 })
    else if (s !== 'overview') await renderPanels(page)
    await page.locator('main').evaluate((m) => m.scrollTo(0, 0))
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/sections/${s}-${theme}.png` })
  }
  report.sections[theme] = { errors }
  await page.close()
}

// 2. every panel (light), per fixture
for (const fx of ['small-protwise', 'network', 'partial']) {
  const { page, errors } = await newPage('light')
  await open(page, fx)
  mkdirSync(`${out}/${fx}`, { recursive: true })
  report.panels[fx] = {}
  for (const s of SECTIONS.slice(1, -1)) {
    await go(page, `#/${s}`)
    for (const id of await renderPanels(page)) {
      const loc = page.locator(`[data-panel="${id}"]`)
      await loc.scrollIntoViewIfNeeded()
      await page.waitForTimeout(150)
      await loc.screenshot({ path: `${out}/${fx}/${id}.png` })
      report.panels[fx][id] = { available: (await loc.getAttribute('data-available')) === 'true', marks: await loc.evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg line, svg image, canvas').length) }
    }
  }
  report.panels[fx]._errors = errors
  await page.close()
}

// 3. comparison sections (light)
{
  const { page, errors } = await newPage('light')
  await open(page, 'network', 'network-after-fix')
  await go(page, '#/compare')
  await page.waitForSelector('[data-testid=compare-ready]', { timeout: 60000 })
  mkdirSync(`${out}/compare`, { recursive: true })
  for (const id of await page.locator('[data-compare-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-compare-section')))) {
    const loc = page.locator(`[data-compare-section="${id}"]`)
    await loc.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await loc.screenshot({ path: `${out}/compare/${id}.png` })
    report.compare[id] = { marks: await loc.evaluate((el) => el.querySelectorAll('svg path, svg circle, svg rect, svg image, canvas').length) }
  }
  report.compare._errors = errors
  await page.close()
}
await browser.close()
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
console.log(JSON.stringify({ sections: report.sections, panelErrors: Object.fromEntries(Object.entries(report.panels).map(([k, v]) => [k, v._errors])), compareErrors: report.compare._errors }))
