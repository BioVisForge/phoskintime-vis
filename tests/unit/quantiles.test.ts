import { describe, expect, it } from 'vitest'
import { finite, quantileSorted, quantile, quantiles, sortedFinite } from '../../src/lib/transforms/stats'

/** the implementation before sortedFinite: comparator sort of the finite values */
const oldSorted = (xs: ArrayLike<number>) => finite(xs).sort((a, b) => a - b)
const bits = (xs: ArrayLike<number>) => Array.from(xs, (v) => (Object.is(v, -0) ? '-0' : String(v)))

describe('sortedFinite / quantiles: bitwise identical to the comparator sort', () => {
  const cases: number[][] = [
    [],
    [1],
    [3, 1, 2, 2, 1],
    [0, -0, 1, -0, 0, -1],
    [-0, 0],
    [NaN, 5, Infinity, -Infinity, 2, null as unknown as number],
  ]
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1
  for (let k = 0; k < 20; k++) cases.push(Array.from({ length: 1 + k * 97 }, () => Math.round(rnd() * 50) / 10 * (rnd() > 0 ? 1 : -1)))
  it.each(cases.map((c, i) => [i, c]))('case %i', (_, xs) => {
    expect(bits(sortedFinite(xs))).toEqual(bits(oldSorted(xs)))
    const ps = [0, 0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 1]
    const old = ps.map((p) => quantileSorted(oldSorted(xs), p))
    expect(bits(quantiles(xs, ps))).toEqual(bits(old))
    expect(bits(ps.map((p) => quantile(xs, p)))).toEqual(bits(old))
  })
})
