// Gallery section "Screen vs export": each heavy panel as drawn on screen and as its 600 dpi PNG
// export (85 mm, 8 pt), side by side. Writes docs/screenshots/screen-vs-export/<panel>-screen.png
// and <panel>-png600.png (the export file as downloaded) and a JSON with the timings.
//   node scripts/screen-vs-export.mjs   (after npm run build:single)
import { chromium } from '@playwright/test'
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readPngInfo } from '../src/lib/export/png.ts'
import { readFileSync } from 'node:fs'

const OUT = 'docs/screenshots/screen-vs-export'
mkdirSync(OUT, { recursive: true })
const PANELS = [
  ['fit', 'nm-gof', 'GOF: 4,912 points per plot, fast dot layer on screen'],
  ['fit', 'nm-residuals', 'Residuals: 4,912 points, three facets'],
  ['dynamics', 'nm-all-trajectories', 'All trajectories, raw lines on: 112,000 points on canvas'],
  ['parameters', 'nm-param-parallel', 'Parameter parallel coordinates: 2,400 dots'],
  ['uncertainty', 'nm-post-ridge', 'Posterior ridgeline: 25 KDEs'],
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true })
await page.goto('file://' + resolve('dist-single/index.html'))
await page.setInputFiles('[data-testid=open-zip]', resolve('tests/fixtures/out/network.pkt.zip'))
await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 120000 })
const meta = []
for (const [section, id, caption] of PANELS) {
  await page.evaluate((h) => (location.hash = h), `#/${section}?only=${id}`)
  const card = page.locator(`[data-panel="${id}"]`)
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-panel="${id}"]`)
    return el?.getAttribute('data-rendered') === 'true' && !el.querySelector('.loading')
  }, id, { timeout: 120000 })
  if (id === 'nm-all-trajectories' && !(await page.isChecked('[data-testid=raw-lines]'))) await page.check('[data-testid=raw-lines]')
  await page.waitForTimeout(1500)
  await card.screenshot({ path: `${OUT}/${id}-screen.png` })
  await card.locator('[data-testid=panel-menu]').click()
  const t = Date.now()
  const dlp = page.waitForEvent('download', { timeout: 300000 })
  await card.locator('[data-testid=export-png]').click()
  // some panels do not fit 85 mm at 8 pt (long labels): take the dialog's "next width" fix
  const fix = page.locator('[data-testid=fit-next-preset]')
  let fitFix = null
  if ((await Promise.race([dlp.then(() => 'dl'), fix.waitFor({ timeout: 300000 }).then(() => 'fit')])) === 'fit') {
    fitFix = (await fix.innerText()).trim()
    await fix.click()
  }
  const dl = await dlp
  const ms = Date.now() - t
  copyFileSync(await dl.path(), `${OUT}/${id}-png600.png`)
  const info = readPngInfo(new Uint8Array(readFileSync(`${OUT}/${id}-png600.png`)))
  meta.push({ id, caption, fitFix, exportMs: ms, png: { width: info.width, height: info.height, dpi: info.dpiX } })
  console.log(id, ms, 'ms', info.width, 'x', info.height)
  if (id === 'nm-all-trajectories') await page.uncheck('[data-testid=raw-lines]')
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(meta, null, 1))
await browser.close()
