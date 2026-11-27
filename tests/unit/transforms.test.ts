import { describe, expect, it } from 'vitest'
import { quantile, std, linregress, median } from '../../src/lib/transforms/stats'
import { robustSigma, networkGof, protwiseGofOffsets, Z95 } from '../../src/lib/transforms/gof'
import { entropyKL, klRow, klByGene } from '../../src/lib/transforms/kl'
import { smoothDensity1d, ridgeNormalised, linspace } from '../../src/lib/transforms/kde'
import { boxStats } from '../../src/lib/transforms/box'
import { envelopes, finiteDifferenceArrows, stepEval } from '../../src/lib/transforms/envelope'
import { toCsv } from '../../src/lib/transforms/table'

describe('stats', () => {
  it('type-7 quantiles match numpy linear', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 15)
    expect(quantile([5], 0.9)).toBe(5)
    expect(quantile([NaN, 3, 1], 0.5)).toBe(2) // nulls skipped
  })
  it('std ddof and median', () => {
    expect(std([1, 2, 3, 4], 0)).toBeCloseTo(Math.sqrt(1.25), 15)
    expect(std([1, 2, 3, 4], 1)).toBeCloseTo(Math.sqrt(5 / 3), 15)
    expect(median([3, 1, 2])).toBe(2)
  })
  it('linregress', () => {
    const r = linregress([0, 1, 2], [1, 3, 5])
    expect(r.slope).toBeCloseTo(2, 14)
    expect(r.intercept).toBeCloseTo(1, 14)
    expect(r.r).toBeCloseTo(1, 14)
  })
})

describe('GOF', () => {
  it('robust sigma falls back to std below 10 residuals and when MAD is 0', () => {
    expect(robustSigma([1, -1])).toBe(1)
    const flat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5]
    expect(robustSigma(flat)).toBeCloseTo(std(flat, 0), 14)
    expect(robustSigma([0, 0])).toBe(1e-12)
  })
  it('drops pairs with a null side; RMSE about identity; R² = r²', () => {
    const g = networkGof([1, 2, NaN, 4], [1.1, 1.9, 3, NaN])
    expect(g.n).toBe(2)
    expect(g.rmse).toBeCloseTo(0.1, 12)
    expect(g.r2).toBeCloseTo(1, 12)
    expect(g.d95).toBeCloseTo(Z95 * g.sigma, 15)
  })
  it('protwise offsets use std of observations', () => {
    expect(protwiseGofOffsets([1, 2, 3, NaN]).std).toBeCloseTo(std([1, 2, 3], 0), 15)
  })
})

describe('KL', () => {
  it('entropy semantics', () => {
    expect(entropyKL([1, 1], [1, 1])).toBe(0)
    expect(entropyKL([1, 0], [0.5, 0.5])).toBeCloseTo(Math.log(2), 15)
    expect(entropyKL([0.5, 0.5], [1, 0])).toBe(Infinity)
  })
  it('pairwise-complete rows and per-gene mean with > 0.03 flag', () => {
    const r = klRow('G', 'S1', [1, NaN, 2], [1, 5, 2])
    expect(r.points).toBe(2)
    expect(r.dropped).toBe(1)
    expect(r.kl).toBeCloseTo(0, 15)
    const g = klByGene([{ gene: 'G', site: 'a', kl: 0.02, points: 3, dropped: 0 }, { gene: 'G', site: 'b', kl: 0.05, points: 3, dropped: 0 }])
    expect(g[0].kl).toBeCloseTo(0.035, 15)
    expect(g[0].flagged).toBe(true)
  })
})

describe('KDE', () => {
  it('linspace endpoints and grid', () => {
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
  it('peak-normalised density on a padded grid', () => {
    const { x, density } = smoothDensity1d([0, 1, 2, 3, 4])
    expect(x.length).toBe(256)
    expect(x[0]).toBeCloseTo(-0.4, 14)
    expect(Math.max(...density)).toBeCloseTo(1, 15)
  })
  it('degenerate inputs', () => {
    expect(smoothDensity1d([]).x).toEqual([0, 1])
    expect(smoothDensity1d([2, 2, 2]).x[0]).toBeCloseTo(1.9, 12)
  })
  it('ridge clips normalised grid to [0,1] as PhosKinTime does', () => {
    const r = ridgeNormalised([1, 2, 3, 10])
    expect(Math.min(...r.xNorm)).toBe(0)
    expect(Math.max(...r.xNorm)).toBe(1)
  })
})

describe('box, envelopes, arrows, step', () => {
  it('Tukey box', () => {
    const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 100])
    expect(b.q1).toBe(3)
    expect(b.q3).toBe(7)
    expect(b.whiskerHigh).toBe(8)
    expect(b.outliers).toEqual([100])
  })
  it('envelopes group by exact time and skip nulls', () => {
    const e = envelopes(['a', 'a', 'a', 'a'], [0.5, 0.5, 0.75, 0.75], [1, 3, NaN, 2])
    expect(e).toHaveLength(2)
    expect(e[0]).toMatchObject({ time: 0.5, n: 2, min: 1, max: 3, q50: 2 })
    expect(e[1].n).toBe(1)
  })
  it('finite-difference arrows between consecutive stored points', () => {
    const a = finiteDifferenceArrows([2, 0, 1], [2, 0, 1], [0, 0, 1])
    expect(a).toHaveLength(2)
    expect(a[0]).toMatchObject({ t0: 0, t1: 1, dx: 1, dy: 1 })
    expect(a[0].angleDeg).toBeCloseTo(45, 12)
  })
  it('right-continuous step as the RHS uses it', () => {
    const g = [0, 1, 2]
    const v = [10, 20, 30]
    expect(stepEval(g, v, -1)).toBe(10)
    expect(stepEval(g, v, 0.999)).toBe(10)
    expect(stepEval(g, v, 1)).toBe(20)
    expect(stepEval(g, v, 5)).toBe(30)
  })
  it('CSV quoting and nulls', () => {
    expect(toCsv([{ a: 'x,y', b: null, c: 1.5 }])).toBe('a,b,c\n"x,y",,1.5\n')
  })
})
