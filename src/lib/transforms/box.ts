import { finite, quantileSorted } from './stats'

/**
 * Tukey box statistics as SveltePlot's BoxY draws them (marks/helpers/Box.svelte, v0.14.2):
 * quartiles by linear (type 7) quantile = numpy default; whiskers at the most extreme data inside
 * [q1 - 1.5 IQR, q3 + 1.5 IQR]; points outside are outliers.
 */
export function boxStats(values: ArrayLike<number>) {
  const s = finite(values).sort((a, b) => a - b)
  const q1 = quantileSorted(s, 0.25)
  const med = quantileSorted(s, 0.5)
  const q3 = quantileSorted(s, 0.75)
  const iqr = q3 - q1
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  const inside = s.filter((v) => v >= lo && v <= hi)
  return {
    n: s.length,
    q1,
    median: med,
    q3,
    whiskerLow: inside.length ? inside[0] : NaN,
    whiskerHigh: inside.length ? inside[inside.length - 1] : NaN,
    outliers: s.filter((v) => v < lo || v > hi),
  }
}
