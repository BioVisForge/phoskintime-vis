/** Small numeric helpers. Conventions match NumPy defaults unless stated. */

export function finite(xs: ArrayLike<number>): number[] {
  const out: number[] = []
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) out.push(xs[i])
  return out
}

/** Linear (type 7) quantile on sorted data, same as numpy.quantile(method='linear') and d3.quantile. */
export function quantileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length
  if (!n) return NaN
  if (n === 1) return sorted[0]
  const h = (n - 1) * p
  const lo = Math.floor(h)
  const hi = Math.min(lo + 1, n - 1)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

export function quantile(xs: ArrayLike<number>, p: number): number {
  const s = finite(xs).sort((a, b) => a - b)
  return quantileSorted(s, p)
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i]
  return xs.length ? s / xs.length : NaN
}

/** Standard deviation; ddof=0 is numpy's default (population). Two-pass for accuracy. */
export function std(xs: ArrayLike<number>, ddof = 0): number {
  const n = xs.length
  if (n - ddof <= 0) return NaN
  const m = mean(xs)
  let s = 0
  for (let i = 0; i < n; i++) s += (xs[i] - m) ** 2
  return Math.sqrt(s / (n - ddof))
}

export function median(xs: ArrayLike<number>): number {
  return quantile(xs, 0.5)
}

/** Pearson correlation. */
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxy / Math.sqrt(sxx * syy)
}

/** Ordinary least squares, as scipy.stats.linregress (slope, intercept, rvalue). */
export function linregress(x: ArrayLike<number>, y: ArrayLike<number>): { slope: number; intercept: number; r: number; n: number } {
  const n = x.length
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const slope = sxy / sxx
  let r = sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
  r = Math.max(-1, Math.min(1, r)) // linregress clips r to [-1, 1]
  return { slope, intercept: my - slope * mx, r, n }
}
