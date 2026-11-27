/**
 * Fast layers are on by default. Off with `?fast=0` in the page URL (before the hash) or
 * `globalThis.__PKV_FAST__ = false` before the app starts: every mark then goes through
 * SveltePlot, as before. The visual parity tests compare both.
 */
export function fastLayersEnabled(): boolean {
  const g = globalThis as { __PKV_FAST__?: boolean; location?: Location }
  if (g.__PKV_FAST__ === false) return false
  try {
    return new URLSearchParams(g.location?.search ?? '').get('fast') !== '0'
  } catch {
    return true
  }
}
