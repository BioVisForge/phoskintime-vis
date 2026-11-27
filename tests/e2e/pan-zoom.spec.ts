/**
 * Pan/zoom on every plot with dot marks (docs/pan-zoom.md), Chromium and Firefox, from file://:
 * toolbar, keyboard (+/−, arrows, 0), Ctrl/⌘ + wheel, pan mode and double-click reset, linked and
 * unlinked facets, the brush after a zoom (selection in data coordinates), and exports of the full
 * range vs the current view (caption states the ranges).
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { APP, openZip, waitVerified, watchErrors } from './helpers'

test.setTimeout(240_000)

type Case = {
  name: string
  fixtures: string[]
  hash: string
  /** container: a panel id, or a comparison section */
  panel?: string
  section?: string
  /** zoom key, or a prefix ending in ':' for plots inside a loop */
  key: string
  axes: 'xy' | 'x' | 'y'
  facets?: number
  brush?: boolean
  setup?: (page: Page) => Promise<void>
}

const NET = ['network']
const PW = ['small-protwise']
const CMP = ['network', 'network-after-fix']
const brushOnce = async (page: Page, c: Locator) => {
  const w = c.locator('.pkv-zoomwrap[data-zoom-key="Overall"]')
  const b = (await frameBox(w))!
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.7, { steps: 6 })
  await page.mouse.up()
  await expect(c.locator('[data-testid=selection] b').first()).not.toHaveText('0')
}
export const CASES: Case[] = [
  { name: 'nm-gof Overall', fixtures: NET, hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'Overall', axes: 'xy', brush: true },
  { name: 'nm-gof per-layer', fixtures: NET, hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'per-layer', axes: 'xy', facets: 3 },
  { name: 'nm-gof selected-trajectories', fixtures: NET, hash: '#/fit?only=nm-gof', panel: 'nm-gof', key: 'selected-trajectories', axes: 'xy', setup: (p) => brushOnce(p, p.locator('[data-panel="nm-gof"]')) },
  { name: 'nm-residuals', fixtures: NET, hash: '#/fit?only=nm-residuals', panel: 'nm-residuals', key: 'main', axes: 'xy', facets: 3 },
  { name: 'nm-timeseries', fixtures: NET, hash: '#/dynamics?only=nm-timeseries', panel: 'nm-timeseries', key: 'main', axes: 'xy' },
  { name: 'nm-all-trajectories (raw lines)', fixtures: NET, hash: '#/dynamics?only=nm-all-trajectories', panel: 'nm-all-trajectories', key: 'mRNA', axes: 'xy', setup: (p) => p.check('[data-testid=raw-lines]') },
  { name: 'nm-param-parallel', fixtures: NET, hash: '#/parameters?only=nm-param-parallel', panel: 'nm-param-parallel', key: 'main', axes: 'x' },
  { name: 'nm-multistart ranked', fixtures: NET, hash: '#/uncertainty?only=nm-multistart', panel: 'nm-multistart', key: 'ranked', axes: 'xy', brush: true },
  { name: 'nm-multistart distribution', fixtures: NET, hash: '#/uncertainty?only=nm-multistart', panel: 'nm-multistart', key: 'distribution', axes: 'y' },
  { name: 'nm-pareto', fixtures: NET, hash: '#/uncertainty?only=nm-pareto', panel: 'nm-pareto', key: 'main', axes: 'xy', brush: true },
  { name: 'nm-profile', fixtures: NET, hash: '#/uncertainty?only=nm-profile', panel: 'nm-profile', key: 'main', axes: 'xy', facets: 6 },
  { name: 'nm-post-ci', fixtures: NET, hash: '#/uncertainty?only=nm-post-ci', panel: 'nm-post-ci', key: 'main', axes: 'x' },
  { name: 'nm-post-predictive', fixtures: NET, hash: '#/uncertainty?only=nm-post-predictive', panel: 'nm-post-predictive', key: 'main', axes: 'xy' },
  { name: 'nm-sensitivity μ*–σ', fixtures: NET, hash: '#/sensitivity?only=nm-sensitivity', panel: 'nm-sensitivity', key: 'mu-sigma', axes: 'xy', brush: true },
  { name: 'pw-gof Overall', fixtures: PW, hash: '#/fit?only=pw-gof', panel: 'pw-gof', key: 'Overall', axes: 'xy', brush: true },
  { name: 'pw-model-fit', fixtures: PW, hash: '#/dynamics?only=pw-model-fit', panel: 'pw-model-fit', key: 'part:', axes: 'xy' },
  { name: 'pw-pca', fixtures: PW, hash: '#/dynamics?only=pw-pca', panel: 'pw-pca', key: 'main', axes: 'xy' },
  { name: 'pw-tsne', fixtures: PW, hash: '#/dynamics?only=pw-tsne', panel: 'pw-tsne', key: 'main', axes: 'xy' },
  { name: 'pw-parallel', fixtures: PW, hash: '#/dynamics?only=pw-parallel', panel: 'pw-parallel', key: 'main', axes: 'x' },
  { name: 'pw-time-state-grid', fixtures: PW, hash: '#/sensitivity?only=pw-time-state-grid', panel: 'pw-time-state-grid', key: 'main', axes: 'y' },
  { name: 'pw-phase-space', fixtures: PW, hash: '#/sensitivity?only=pw-phase-space', panel: 'pw-phase-space', key: 'main', axes: 'xy' },
  { name: 'pw-param-pairs pair', fixtures: PW, hash: '#/sensitivity?only=pw-param-pairs', panel: 'pw-param-pairs', key: 'pair:', axes: 'xy' },
  { name: 'pw-param-pairs focus', fixtures: PW, hash: '#/sensitivity?only=pw-param-pairs', panel: 'pw-param-pairs', key: 'focus', axes: 'xy', brush: true },
  { name: 'pw-sensitivity μ*–σ', fixtures: PW, hash: '#/sensitivity?only=pw-sensitivity', panel: 'pw-sensitivity', key: 'mu-sigma', axes: 'xy', brush: true },
  { name: 'pw-sensitivity ranking', fixtures: PW, hash: '#/sensitivity?only=pw-sensitivity', panel: 'pw-sensitivity', key: 'ranking', axes: 'x' },
  { name: 'pw-param-profiles', fixtures: PW, hash: '#/parameters?only=pw-param-profiles', panel: 'pw-param-profiles', key: 'main', axes: 'xy' },
  { name: 'compare gof', fixtures: CMP, hash: '#/compare', section: 'gof', key: 'gof', axes: 'x' },
  { name: 'compare overlay', fixtures: CMP, hash: '#/compare', section: 'overlay', key: 'overlay', axes: 'xy' },
  { name: 'compare params', fixtures: CMP, hash: '#/compare', section: 'params', key: 'params', axes: 'xy' },
]

const sel = (key: string) => (key.endsWith(':') ? `.pkv-zoomwrap[data-zoom-key^="${key}"]` : `.pkv-zoomwrap[data-zoom-key="${key}"]`)
const view = async (w: Locator) => JSON.parse((await w.getAttribute('data-view')) ?? '{}') as { x?: number[]; y?: number[] }
/** the plot's own frame (the zoom overlay rect) in page coordinates */
async function frameBox(w: Locator) {
  return w.locator('[data-testid=zoom-overlay]').first().boundingBox()
}
async function expectAxes(w: Locator, axes: Case['axes']) {
  await expect(w).toHaveAttribute('data-zoomed', 'true')
  const v = await view(w)
  expect(!!v.x, 'x zoomed').toBe(axes.includes('x'))
  expect(!!v.y, 'y zoomed').toBe(axes.includes('y'))
}
async function reset(w: Locator) {
  await w.locator('[data-testid=zoom-reset]').first().click()
  await expect(w).toHaveAttribute('data-zoomed', 'false')
}

async function exportSvg(page: Page, c: Case, current: boolean): Promise<string> {
  if (c.section) {
    const s = page.locator(`[data-compare-section="${c.section}"]`)
    const box = s.locator('[data-testid=cmp-export-view]')
    if ((await box.isChecked()) !== current) await box.click()
    const dlp = page.waitForEvent('download', { timeout: 180_000 })
    await s.locator('[data-testid=cmp-export-svg]').click()
    return readFileSync((await (await widenUntilDownload(page, dlp)).path())!, 'utf8')
  }
  const card = page.locator(`[data-panel="${c.panel}"]`)
  await card.locator('[data-testid=panel-menu]').click()
  await card.locator('[data-testid=export-dialog]').click()
  for (const f of ['png', 'pdf', 'svg', 'csv', 'tikz']) {
    const b = page.locator(`[data-testid=fmt-${f}]`)
    if ((await b.isChecked()) !== (f === 'svg')) await b.click()
  }
  const v = page.locator('[data-testid=export-view]')
  if ((await v.isChecked()) !== current) await v.click()
  const dlp = page.waitForEvent('download', { timeout: 180_000 })
  await page.click('[data-testid=export-run]')
  return readFileSync((await (await widenUntilDownload(page, dlp)).path())!, 'utf8')
}

/**
 * Some panels do not fit 85 mm at 8 pt with or without zoom (long parameter labels, wide tables;
 * a known limitation): take the dialog's "next width" fix, up to the widest preset. The view
 * check is what these tests are about.
 */
async function widenUntilDownload(page: Page, dlp: Promise<import('@playwright/test').Download>) {
  const next = page.locator('[data-testid=fit-next-preset]')
  for (let i = 0; i < 3; i++) {
    const r = await Promise.race([dlp.then(() => 'dl' as const), next.waitFor({ timeout: 180_000 }).then(() => 'fit' as const)])
    if (r === 'dl') break
    await next.click()
    await expect(next).toHaveCount(0, { timeout: 30_000 }).catch(() => {})
  }
  return dlp
}

for (const c of CASES) {
  test(`pan/zoom: ${c.name}`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto(APP)
    await openZip(page, ...c.fixtures)
    await waitVerified(page)
    await page.evaluate((h) => (location.hash = h), c.hash)
    if (c.section) await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
    const box = c.section ? page.locator(`[data-compare-section="${c.section}"]`) : page.locator(`[data-panel="${c.panel}"]`)
    await expect(box).toBeVisible({ timeout: 60_000 })
    if (!c.section) await expect(box).toHaveAttribute('data-rendered', 'true', { timeout: 60_000 })
    await c.setup?.(page)
    const w = box.locator(sel(c.key)).first()
    await expect(w).toBeVisible({ timeout: 60_000 })
    await w.scrollIntoViewIfNeeded()
    await expect(w.locator('[data-testid=zoom-overlay]').first()).toBeAttached({ timeout: 60_000 })

    // toolbar
    await w.locator('[data-testid=zoom-in]').first().click()
    await expectAxes(w, c.axes)
    const zin = await view(w)
    await w.locator('[data-testid=zoom-out]').first().click()
    expect(await view(w)).not.toEqual(zin)
    await reset(w)

    // keyboard: + zooms, arrows pan along the zoomed axis, - zooms out, 0 resets
    await w.focus()
    await page.keyboard.press('+')
    await expectAxes(w, c.axes)
    const k1 = await view(w)
    await page.keyboard.press(c.axes.includes('x') ? 'ArrowRight' : 'ArrowUp')
    const k2 = await view(w)
    if (c.axes.includes('x')) expect(k2.x![0]).toBeGreaterThan(k1.x![0])
    else expect(k2.y![0]).toBeGreaterThan(k1.y![0])
    await page.keyboard.press('-')
    expect(await view(w)).not.toEqual(k2)
    await page.keyboard.press('0')
    await expect(w).toHaveAttribute('data-zoomed', 'false')

    // Ctrl/⌘ + wheel over the frame
    const f = (await frameBox(w))!
    await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')
    await expectAxes(w, c.axes)
    await reset(w)

    // pan mode: drag moves the view; double-click resets
    if (c.brush) await w.locator('[data-testid=zoom-pan]').first().click()
    await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
    await page.mouse.down()
    await page.mouse.move(f.x + f.width / 2 - 40, f.y + f.height / 2 + 30, { steps: 5 })
    await page.mouse.up()
    await expectAxes(w, c.axes)
    await page.mouse.dblclick(f.x + f.width / 2, f.y + f.height / 2)
    await expect(w).toHaveAttribute('data-zoomed', 'false')
    if (c.brush) await w.locator('[data-testid=zoom-pan]').first().click()

    // facets: linked by default; unlinked, each facet has its own view
    if (c.facets) {
      await w.locator('[data-testid=zoom-link]').click()
      const parts = box.locator(sel(`${c.key}:`))
      await expect(parts).toHaveCount(c.facets)
      await parts.nth(0).locator('[data-testid=zoom-in]').click()
      await expect(parts.nth(0)).toHaveAttribute('data-zoomed', 'true')
      await expect(parts.nth(1)).toHaveAttribute('data-zoomed', 'false')
      await reset(parts.nth(0))
      await box.locator('[data-testid=zoom-link]').click()
      await expect(box.locator(sel(c.key)).first()).toBeVisible()
    }

    // brush after zoom: selects in data coordinates
    if (c.brush) {
      const wz = box.locator(sel(c.key)).first()
      await wz.focus()
      // GOF: zoom into its dense centre and check the selection exactly. Elsewhere the data may
      // lie away from the centre: zoom out (the domain still changes) and brush the whole frame.
      if (c.panel === 'nm-gof') {
        await page.keyboard.press('+')
        await page.keyboard.press('+')
      } else await page.keyboard.press('-')
      const v = await view(wz)
      const g = (await frameBox(wz))!
      // start inside the scale range (the frame adds the plot's inset) and end beyond the frame:
      // the brush is clamped to the zoomed domain on that side
      const sx = g.x + 14
      const sy = g.y + 14
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      await page.mouse.move(g.x + g.width + 20, g.y + g.height + 20, { steps: 8 })
      await page.mouse.up()
      const n = box.locator('[data-testid=selection] b').first()
      await expect.poll(async () => Number(await n.innerText()), { timeout: 10_000 }).toBeGreaterThan(0)
      await page.waitForTimeout(400)
      const count = Number(await n.innerText())
      if (c.panel === 'nm-gof') {
        // exact, in data coordinates: GOF's scales are linear with inset 6, so the brushed data
        // rectangle is [x(start), view x max] × [view y min, y(start)]; the selection must lie
        // between the counts for that rectangle shrunk and grown by 1 px at the start corner
        const inset = 6
        const r0x = g.x + inset
        const rwx = g.width - 2 * inset
        const r0y = g.y + inset
        const rhy = g.height - 2 * inset
        const xAt = (px: number) => v.x![0] + ((px - r0x) / rwx) * (v.x![1] - v.x![0])
        const yAt = (py: number) => v.y![1] - ((py - r0y) / rhy) * (v.y![1] - v.y![0])
        const card = page.locator('[data-panel="nm-gof"]')
        await card.locator('[data-testid=panel-menu]').click()
        const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('[data-testid=export-csv]').click()])
        const lines = readFileSync((await dl.path())!, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
        const head = lines[0].split(',')
        const io = head.indexOf('obs')
        const ip = head.indexOf('pred')
        const pts = lines.slice(1).map((l) => l.split(',')).map((x) => [+x[io], +x[ip]])
        const inside = (dx: number) => pts.filter(([o, p]) => o >= xAt(sx + dx) && o <= v.x![1] && p >= v.y![0] && p <= yAt(sy + dx)).length
        expect(count).toBeGreaterThanOrEqual(inside(1))
        expect(count).toBeLessThanOrEqual(inside(-1))
        expect(inside(1)).toBeGreaterThan(0)
      }
      await page.keyboard.press('Escape')
    }

    // exports: full range by default; "current view" states the ranges in the caption
    const wz = box.locator(sel(c.key)).first()
    await wz.focus()
    await page.keyboard.press('+')
    await expect(wz).toHaveAttribute('data-zoomed', 'true')
    // the caption is wrapped over several <text> lines: compare the text, not the markup
    const text = (svg: string) => svg.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const full = text(await exportSvg(page, c, false))
    expect(full).not.toContain('Current view')
    const cur = text(await exportSvg(page, c, true))
    expect(cur).toContain('Current view, not the full data range')
    expect(errors).toEqual([])
  })
}
