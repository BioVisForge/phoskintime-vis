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
  return quantileSorted(sortedFinite(xs), p)
}

/**
 * The finite values in ascending order: the same array `finite(xs).sort((a, b) => a - b)` gives,
 * element for element, including the order of -0 and +0 (equal for the comparator, so a stable
 * sort keeps them in input order; a typed-array sort puts -0 first, so the zero block is
 * rewritten in input order). About 10× faster than the comparator sort.
 */
export function sortedFinite(xs: ArrayLike<number>): Float64Array {
  const f = finite(xs)
  const s = Float64Array.from(f).sort()
  let zeros = 0
  let neg = false
  for (const v of f)
    if (v === 0) {
      zeros++
      if (Object.is(v, -0)) neg = true
    }
  if (neg && zeros) {
    const at = s.indexOf(0) // -0 === 0
    let k = at
    for (const v of f) if (v === 0) s[k++] = v
  }
  return s
}

/** Several linear quantiles of the same values, sorting once. */
export function quantiles(xs: ArrayLike<number>, ps: number[]): number[] {
  const s = sortedFinite(xs)
  return ps.map((p) => quantileSorted(s, p))
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
