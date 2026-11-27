/**
 * For generator scripts only: when an export does not fit its width, apply the dialog's fixes in
 * order of least change (shorter labels, fewer ticks, then scale) until the download starts.
 * Every applied fix is stated in the exported caption. Returns the fixes used.
 */
export async function confirmFit(page, download) {
  const used = []
  let done = false
  download.then(() => (done = true), () => (done = true))
  const warning = page.locator('[data-testid=fit-warning]')
  const run = page.locator('[data-testid=export-run]')
  while (!done) {
    // the warning is only actionable once the attempt has finished (buttons enabled)
    if ((await warning.isVisible()) && (await run.isEnabled())) {
      let clicked = false
      for (const f of ['shorten', 'fewer-ticks', 'scale']) {
        const b = page.locator(`[data-testid=fit-${f}]`)
        if (!used.includes(f) && (await b.count())) {
          used.push(f)
          await b.click()
          clicked = true
          break
        }
      }
      if (!clicked) throw new Error('export does not fit and no fix is left')
    }
    await page.waitForTimeout(250)
  }
  return used
}
