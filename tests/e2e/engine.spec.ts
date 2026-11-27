import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { APP, FIX, openZip, waitVerified } from './helpers'

let srv: ChildProcess
test.beforeAll(async ({ browserName: _b }, info) => {
  const port = 8790 + info.workerIndex
  srv = spawn('node', ['scripts/mock-engine.mjs', '--port', String(port), FIX('small-protwise.pkt')], { stdio: 'pipe' })
  await new Promise<void>((res) => srv.stdout!.on('data', (d) => String(d).includes('mock-pktengine') && res()))
  process.env.MOCK_PORT = String(port)
})
test.afterAll(() => srv?.kill())

test('what-if (feature flag, mock engine): connect, verify, simulate, labelled output', async ({ page }) => {
  await page.goto(APP + '?engine=mock')
  await openZip(page, 'small-protwise')
  await waitVerified(page)
  await page.getByRole('link', { name: /Open What-if \(mock engine/ }).click()
  await page.fill('[data-testid=engine-url]', `http://127.0.0.1:${process.env.MOCK_PORT}`)
  await page.click('[data-testid=engine-connect]')
  await expect(page.locator('[data-testid=engine-info]')).toContainText('mock-pktengine')
  await expect(page.locator('[data-testid=engine-verify]')).toHaveAttribute('data-reproduces', 'true')
  await page.locator('input[type=range]').first().fill('0.9')
  await page.click('[data-testid=engine-run]')
  await expect(page.getByText('Engine output from mock-pktengine 0.0.0-mock')).toBeVisible()
  // the what-if plot pans and zooms like every plot with dot marks (docs/pan-zoom.md)
  const w = page.locator('.pkv-zoomwrap[data-zoom-key="main"]').first()
  await w.locator('[data-testid=zoom-in]').click()
  await expect(w).toHaveAttribute('data-zoomed', 'true')
  await w.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('0')
  await expect(w).toHaveAttribute('data-zoomed', 'false')
})

test('what-if is hidden without the feature flag', async ({ page }) => {
  await page.goto(APP)
  await expect(page.getByText(/What-if/)).toHaveCount(0)
})
