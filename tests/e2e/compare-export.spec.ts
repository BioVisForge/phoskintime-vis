import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { APP, openZip, waitVerified, watchErrors, shortId } from './helpers'
import { readPngInfo } from '../../src/lib/export/png'

test.skip(({ browserName }) => browserName !== 'chromium', 'export specs run in Chromium')
test.setTimeout(480_000)

/** sections and the number of PGFPlots axes their TikZ export holds (0: table only, no TikZ button) */
const SECTIONS: Record<string, number> = { provenance: 0, gof: 0, overlay: 1, 'delta-lines': 1, 'delta-raster': 1, params: 3 }
const [A8, B8] = [shortId('network'), shortId('network-after-fix')]
const IDS = `${A8}_vs_${B8}`
/** the side-by-side GOF table is wider than a single column: PNG, PDF and SVG warn at 85 mm */
const TOO_WIDE = new Set(['gof png', 'gof pdf', 'gof svg'])

test('comparison sections export as PNG, PDF, SVG, CSV and TikZ', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto(APP)
  await openZip(page, 'network', 'network-after-fix')
  await waitVerified(page)
  await page.click('[data-testid=tab-compare]')
  await expect(page.locator('[data-testid=compare-ready]')).toBeVisible({ timeout: 60_000 })
  expect(await page.locator('[data-compare-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-compare-section')))).toEqual(Object.keys(SECTIONS))
  for (const [id, axes] of Object.entries(SECTIONS)) {
    const section = page.locator(`[data-compare-section="${id}"]`)
    await expect(section.locator('[data-testid=cmp-export-tikz]')).toHaveCount(axes ? 1 : 0)
    for (const fmt of ['png', 'pdf', 'svg', 'csv', ...(axes ? ['tikz'] : [])]) {
      const what = `${id} ${fmt}`
      const download = page.waitForEvent('download', { timeout: 180_000 })
      await section.locator(`[data-testid=cmp-export-${fmt}]`).click()
      let mm = 85
      if (TOO_WIDE.has(what)) {
        await expect(page.locator('[data-testid=fit-warning]'), what).toContainText('Labels do not fit 85 mm', { timeout: 120_000 })
        await page.click('[data-testid=fit-next-preset]')
        mm = 114
      }
      const dl = await download
      expect(dl.suggestedFilename(), what).toMatch(new RegExp(`^compare-${id}_${IDS}_\\d{8}${fmt === 'tikz' ? '_tikz\\.zip' : `\\.${fmt}`}$`))
      const bytes = readFileSync((await dl.path())!)
      if (fmt === 'png') {
        const info = readPngInfo(new Uint8Array(bytes))
        expect(info.width, what).toBe(Math.round((mm / 25.4) * 600))
        expect(info.text.bundle_id, what).toContain(' vs ')
      } else if (fmt === 'pdf') {
        const doc = await PDFDocument.load(bytes)
        expect((doc.getPage(0).getWidth() / 72) * 25.4, what).toBeCloseTo(mm, 0)
        expect(doc.getSubject(), what).toContain(' vs ')
      } else if (fmt === 'svg') {
        expect(bytes.toString('utf8'), what).toMatch(new RegExp(`^<svg[^>]+width="${mm}mm"`))
      } else if (fmt === 'csv') {
        const lines = bytes.toString('utf8').split('\n')
        expect(lines[2], what).toMatch(new RegExp(`^# bundle_id: pkt-${A8}\\S* vs pkt-${B8}`))
        expect(lines.filter((l) => l && !l.startsWith('#')).length, what).toBeGreaterThan(1)
      } else {
        const files = unzipSync(new Uint8Array(bytes))
        const tex = strFromU8(files[`compare-${id}.tex`])
        // only this section's plots, not those of the whole comparison view
        expect(tex.match(/\\begin\{axis\}/g)?.length, what).toBe(axes)
        expect(Object.keys(files), what).toContain(`compare-${id}-standalone.tex`)
      }
    }
  }
  await expect(page.locator('[data-testid=fit-warning]')).toHaveCount(0)
  expect(errors, errors.join('\n')).toEqual([])
})
