import { describe, expect, it } from 'vitest'
import { alignParameters, alignTrajectories, compareMetrics, issueDiff, sortDeltas } from '../../src/lib/transforms/compare'

describe('comparison alignment', () => {
  const A = [{ name: 'p1', value: 1 }, { name: 'p2', value: 2 }, { name: 'p3', value: 0 }]
  it('aligned by position when order hashes match', () => {
    const r = alignParameters(A, [{ name: 'p1', value: 2 }, { name: 'p2', value: 1 }, { name: 'p3', value: 5 }], 'h', 'h')
    expect(r.mode).toBe('aligned')
    expect(r.pairs[0]).toMatchObject({ delta: 1, ratio: 2, log2ratio: 1 })
    expect(r.pairs[2].ratio).toBeNull() // a = 0
  })
  it('falls back to by-name when hashes match but names do not', () => {
    const r = alignParameters(A, [{ name: 'p2', value: 2 }, { name: 'p1', value: 1 }, { name: 'p3', value: 0 }], 'h', 'h')
    expect(r.mode).toBe('by-name')
    expect(r.reason).toMatch(/names differ/)
  })
  it('by name with unmatched rows listed on both sides', () => {
    const r = alignParameters(A, [{ name: 'p2', value: 4 }, { name: 'p9', value: 1 }], 'h1', 'h2')
    expect(r.mode).toBe('by-name')
    expect(r.pairs.map((p) => p.name)).toEqual(['p2'])
    expect(r.onlyA).toEqual(['p1', 'p3'])
    expect(r.onlyB).toEqual(['p9'])
  })
  it('sorts by |log2 ratio|', () => {
    const r = alignParameters(A, [{ name: 'p1', value: 8 }, { name: 'p2', value: 1 }, { name: 'p3', value: 1 }], 'h', 'h')
    expect(sortDeltas(r.pairs).map((p) => p.name)).toEqual(['p1', 'p2', 'p3'])
  })
  it('trajectories paired by state and exact time', () => {
    const a = [{ state: 's', layer: 'L', protein: 'P', time: 0, value: 1 }, { state: 's', layer: 'L', protein: 'P', time: 1, value: 2 }, { state: 'x', layer: 'L', protein: 'P', time: 0, value: 1 }]
    const b = [{ state: 's', layer: 'L', protein: 'P', time: 1, value: 3 }, { state: 'y', layer: 'L', protein: 'P', time: 0, value: 1 }]
    const r = alignTrajectories(a, b)
    expect(r.pairs).toEqual([{ state: 's', layer: 'L', protein: 'P', time: 1, a: 2, b: 3, delta: 1 }])
    expect(r.onlyA).toEqual(['x'])
    expect(r.onlyB).toEqual(['y'])
    expect(r.timesOnlyA).toBe(1)
  })
  it('metrics side by side including one-sided rows', () => {
    const r = compareMetrics([{ layer: null, protein: null, metric: 'mse', value: 1 }], [{ layer: null, protein: null, metric: 'mse', value: 0.5 }, { layer: 'rna', protein: null, metric: 'mse', value: 2 }])
    expect(r[0].delta).toBe(-0.5)
    expect(r[1]).toMatchObject({ inA: false, inB: true })
  })
  it('known-issue difference', () => {
    expect(issueDiff(['N5', 'N7', 'N1'], ['N1'])).toMatchObject({ onlyA: ['N5', 'N7'], onlyB: [], both: ['N1'] })
    expect(issueDiff(null, ['N1']).available).toBe(false)
  })
})
