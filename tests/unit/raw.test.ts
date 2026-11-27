import { describe, expect, it } from 'vitest'
import { LoadedBundle } from '../../src/lib/model/bundle'
import { num, str } from '../../src/lib/transforms/table'
import { rawSeries, type RawColumns } from '../../src/lib/derive/raw'
import { fixtureSource, haveFixtures } from './helpers'

/** the raw-lines arrays as AllTrajectories built them before rawSeries (string comparator) */
function oldRaw(flat: RawColumns, l: string) {
  const idx: number[] = []
  for (let i = 0; i < flat.T.length; i++) if (flat.L[i] === l) idx.push(i)
  const key = (i: number) => flat.S[i]! + '\u0000' + flat.SID[i]
  idx.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : flat.T[a] - flat.T[b]))
  const starts: number[] = []
  idx.forEach((i, k) => (k === 0 || key(i) !== key(idx[k - 1])) && starts.push(k))
  return { xs: Float64Array.from(idx, (i) => flat.T[i]), ys: Float64Array.from(idx, (i) => flat.E[i]), starts: Int32Array.from(starts) }
}

describe.skipIf(!haveFixtures)('rawSeries', () => {
  it('gives the same arrays as the string-comparator sort (network fixture, every layer)', async () => {
    const t = await (await LoadedBundle.open(fixtureSource('network'))).table('trajectories')
    const flat = { L: str(t, 'layer'), S: str(t, 'state'), SID: str(t, 'sample_id'), T: num(t, 'time'), E: num(t, 'value_pred') }
    for (const l of new Set(flat.L)) {
      const a = rawSeries(flat, l!)
      const b = oldRaw(flat, l!)
      expect(a.starts).toEqual(b.starts)
      expect(a.xs).toEqual(b.xs)
      expect(Array.from(a.ys, String)).toEqual(Array.from(b.ys, String))
    }
  })
  it('ties and an empty layer', () => {
    const flat = { L: ['a', 'a', 'a', 'a'], S: ['s2', 's1', 's2', 's1'], SID: ['x', 'x', 'x', 'x'], T: Float64Array.from([1, 2, 1, 0]), E: Float64Array.from([10, 20, 30, NaN]) }
    expect(rawSeries(flat, 'a')).toEqual(oldRaw(flat, 'a'))
    expect(rawSeries(flat, 'none').xs.length).toBe(0)
  })
})
