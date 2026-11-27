/**
 * Raw-lines arrays for one layer: every (state, sample) series, rows sorted by series key
 * (state + NUL + sample_id, compared as strings) and then by time, flattened for FastLines.
 */
export interface RawColumns {
  L: (string | null)[]
  S: (string | null)[]
  SID: (string | null)[]
  T: Float64Array
  E: Float64Array
}

export function rawSeries(flat: RawColumns, layer: string): { xs: Float64Array; ys: Float64Array; starts: Int32Array } {
  const idx: number[] = []
  for (let i = 0; i < flat.T.length; i++) if (flat.L[i] === layer) idx.push(i)
  // rank the distinct keys once (same string order as comparing the keys), then sort rows by
  // (rank, time): the order of sorting by the key strings, without two strings per comparison
  const keyOf = new Map<string, number>()
  const kid = new Int32Array(flat.T.length)
  for (const i of idx) {
    const k = flat.S[i]! + '\u0000' + flat.SID[i]
    let id = keyOf.get(k)
    if (id === undefined) keyOf.set(k, (id = keyOf.size))
    kid[i] = id
  }
  const keys = [...keyOf.keys()]
  const order = keys.map((_, j) => j).sort((a, b) => (keys[a] < keys[b] ? -1 : keys[a] > keys[b] ? 1 : 0))
  const rank = new Int32Array(keys.length)
  order.forEach((j, r) => (rank[j] = r))
  idx.sort((a, b) => rank[kid[a]] - rank[kid[b]] || flat.T[a] - flat.T[b])
  const starts: number[] = []
  idx.forEach((i, k) => (k === 0 || kid[i] !== kid[idx[k - 1]]) && starts.push(k))
  return { xs: Float64Array.from(idx, (i) => flat.T[i]), ys: Float64Array.from(idx, (i) => flat.E[i]), starts: Int32Array.from(starts) }
}
