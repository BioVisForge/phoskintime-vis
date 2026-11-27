// Frame times during pan, zoom and brush (docs/performance.md).
//
//   node scripts/frames.mjs [chromium|firefox] [--out file.json]
//
// Real input (Playwright mouse and wheel) on the single-file build from file://. An in-page
// requestAnimationFrame logger records every frame while the gesture runs; a frame interval is the
// time the main thread needed to handle the input, update the plot and paint (16.7 ms when the
// update fits in one frame at 60 Hz). Reported per gesture: frames, median, p95 and max interval,
// and the frames in the 700 ms after it: canvas layers show a transformed bitmap during the
// gesture and redraw properly when it pauses (large layers in slices), and a brush applies its
// selection when the pointer pauses.
import { chromium, firefox } from '@playwright/test'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const which = args.find((a) => !a.startsWith('--')) ?? 'chromium'
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null
const FIX = (n) => resolve(`tests/fixtures/out/${n}.pkt.zip`)

const browser = await (which === 'firefox' ? firefox : chromium).launch()
const result = { browser: `${which} ${browser.version()}`, date: new Date().toISOString(), gestures: [] }

async function open(page, fixture, hash) {
  await page.goto('file://' + resolve('dist-single/index.html'))
  await page.setInputFiles('[data-testid=open-zip]', FIX(fixture))
  await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 120000 })
  await page.evaluate((h) => (location.hash = h), hash)
}

const startLog = (page) =>
  page.evaluate(() => {
    const g = globalThis
    g.__frames = []
    g.__logging = true
    const tick = (t) => {
      g.__frames.push(t)
      if (g.__logging) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
const stopLog = (page) =>
  page.evaluate(() => {
    globalThis.__logging = false
    const f = globalThis.__frames
    return f.slice(1).map((t, i) => t - f[i])
  })
const stats = (iv) => {
  const s = [...iv].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { frames: s.length, medianMs: +q(0.5).toFixed(1), p95Ms: +q(0.95).toFixed(1), maxMs: +s[s.length - 1].toFixed(1) }
}
/** time from the end of the gesture until no canvas draw is pending and two frames have passed */
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const t0 = performance.now()
        const g = globalThis
        let quiet = 0
        const tick = () => {
          // the full redraw is the last 'canvas draw' span after the gesture ends (spans are on)
          const last = (g.__PKV_SPANS__ ?? []).filter((s) => s.stage === 'canvas draw' && s.start >= t0).at(-1)
          quiet = last ? quiet + 1 : 0
          if (quiet >= 2 || performance.now() - t0 > 3000) res(last ? +(last.start + last.dur - t0).toFixed(1) : null)
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
  )

async function gesture(page, name, box, fn) {
  await page.evaluate(() => (globalThis.__PKV_SPANS__ = []))
  await startLog(page)
  await fn(box)
  const n = await page.evaluate(() => globalThis.__frames.length)
  // keep logging while the deferred work runs (brush selection, full redraw after a gesture)
  await page.waitForTimeout(700)
  const all = await stopLog(page)
  const iv = all.slice(0, Math.max(1, n - 1))
  const after = all.slice(Math.max(1, n - 1))
  const redrawAfterMs = await settle(page)
  const r = { name, ...stats(iv), afterGesture: { maxMs: +Math.max(...after).toFixed(1), framesOver20ms: after.filter((x) => x > 20).length } }
  void redrawAfterMs
  result.gestures.push(r)
  console.error(JSON.stringify(r))
}

const cases = [
  { fixture: 'network', hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'Overall', label: 'GOF overall, 4,912 points (network)', brush: true },
  { fixture: 'gof-100k', hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'Overall', label: 'GOF overall, 102,868 points (gof-100k)', brush: true },
  // the three heaviest scatter plots by dot count: GOF per-layer and residuals (102,868 dots in
  // three facets each, gof-100k) and parameter parallel coordinates (2,400 dots, network)
  { fixture: 'gof-100k', hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'per-layer', label: 'GOF per-layer facets, 102,868 points (gof-100k)' },
  { fixture: 'gof-100k', hash: '#/fit?only=nm-residuals', panel: 'nm-residuals', key: 'main', label: 'Residuals, 102,868 points in 3 facets (gof-100k)' },
  { fixture: 'network', hash: '#/parameters?only=nm-param-parallel', panel: 'nm-param-parallel', key: 'main', label: 'Parameter parallel coordinates, 2,400 dots (network)' },
  { fixture: 'network', hash: '#/dynamics?only=nm-all-trajectories', panel: 'nm-all-trajectories', key: 'mRNA', label: 'raw lines, 56,000 points per plot (network)', raw: true },
]
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } })
  await ctx.addInitScript(() => (globalThis.__PKV_PROFILE__ = true))
  const page = await ctx.newPage()
  await open(page, c.fixture, c.hash)
  const card = page.locator(`[data-panel="${c.panel}"]`)
  await page.waitForFunction((id) => document.querySelector(`[data-panel="${id}"]`)?.getAttribute('data-rendered') === 'true', c.panel, { timeout: 120000 })
  if (c.raw) await page.check('[data-testid=raw-lines]')
  await card.locator('[data-testid=zoom-in]').first().waitFor({ timeout: 120000 })
  await page.waitForTimeout(1500)
  const wrap = card.locator(`.pkv-zoomwrap[data-zoom-key="${c.key}"]`).first()
  await wrap.scrollIntoViewIfNeeded()
  // the plot's own svg (legend swatches are small svgs too)
  const box = (await wrap.locator('svg').evaluateAll((ss) => ss.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 100).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))))[0]
  await wrap.locator('[data-testid=zoom-in]').click()
  if (await wrap.locator('[data-testid=zoom-reset]').isDisabled()) throw new Error('zoom-in did not zoom')
  await wrap.locator('[data-testid=zoom-reset]').click()
  await page.waitForTimeout(500)
  const cx = box.x + box.width * 0.55
  const cy = box.y + box.height * 0.45
  await gesture(page, `${c.label}: Ctrl+wheel zoom in, 30 steps`, box, async () => {
    await page.mouse.move(cx, cy)
    await page.keyboard.down('Control')
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -40)
    await page.keyboard.up('Control')
  })
  if (c.brush) await wrap.locator('[data-testid=zoom-pan]').click()
  await gesture(page, `${c.label}: pan, 40 steps`, box, async () => {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 120, cy + 60, { steps: 40 })
    await page.mouse.up()
  })
  if (c.brush) {
    await wrap.locator('[data-testid=zoom-reset]').click()
    await wrap.locator('[data-testid=zoom-pan]').click()
    await page.waitForTimeout(800)
    await gesture(page, `${c.label}: brush, 40 steps`, box, async () => {
      await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 40 })
      await page.mouse.up()
    })
  }
  await ctx.close()
}
await browser.close()
if (out) writeFileSync(out, JSON.stringify(result, null, 1))
console.log(JSON.stringify(result, null, 1))
