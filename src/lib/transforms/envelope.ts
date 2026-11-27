import { quantileSorted } from './stats'
import { timed } from '../perf/spans'

export type Envelope = {
  key: string
  time: number
  n: number
  min: number
  max: number
  q01: number
  q05: number
  q50: number
  q95: number
  q99: number
}

/**
 * Per exact time point (no time binning: PhosKinTime grids are irregular) summaries across
 * samples: min/max and linear quantiles 1/5/50/95/99 % (the networkmodel sensitivity cloud's
 * `_summarize_band` quantiles). Nulls are skipped.
 */
function envelopes_(keys: ArrayLike<string | null>, times: ArrayLike<number>, values: ArrayLike<number>): Envelope[] {
  const groups = new Map<string, { key: string; time: number; v: number[] }>()
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) continue
    const key = String(keys[i])
    const g = `${key}\u0000${times[i]}`
    let e = groups.get(g)
    if (!e) groups.set(g, (e = { key, time: times[i], v: [] }))
    e.v.push(v)
  }
  const out: Envelope[] = []
  for (const { key, time, v } of groups.values()) {
    v.sort((a, b) => a - b)
    out.push({
      key,
      time,
      n: v.length,
      min: v[0],
      max: v[v.length - 1],
      q01: quantileSorted(v, 0.01),
      q05: quantileSorted(v, 0.05),
      q50: quantileSorted(v, 0.5),
      q95: quantileSorted(v, 0.95),
      q99: quantileSorted(v, 0.99),
    })
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.time - b.time))
}

/**
 * Direction-of-time arrows from finite differences between consecutive stored points (sorted by
 * time). These are not a flow field: nothing is interpolated between trajectories.
 */
export function finiteDifferenceArrows(t: number[], x: number[], y: number[]) {
  const idx = t.map((_, i) => i).filter((i) => Number.isFinite(x[i]) && Number.isFinite(y[i])).sort((a, b) => t[a] - t[b])
  const out: { t0: number; t1: number; x: number; y: number; dx: number; dy: number; length: number; angleDeg: number }[] = []
  for (let k = 0; k + 1 < idx.length; k++) {
    const i = idx[k]
    const j = idx[k + 1]
    const dx = x[j] - x[i]
    const dy = y[j] - y[i]
    // midpoint anchor; rotate is clockwise from north as in the Vector mark (atan2(u, v))
    out.push({ t0: t[i], t1: t[j], x: (x[i] + x[j]) / 2, y: (y[i] + y[j]) / 2, dx, dy, length: Math.hypot(dx, dy), angleDeg: (Math.atan2(dx, dy) * 180) / Math.PI })
  }
  return out
}

/**
 * Right-continuous step function as networkmodel's RHS evaluates kinase activity
 * (backend.py:293-299: idx = searchsorted(grid, t, 'right') - 1, clipped to [0, n-1]).
 */
export function stepEval(grid: number[], values: number[], t: number): number {
  let lo = 0
  let hi = grid.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (grid[mid] <= t) lo = mid + 1
    else hi = mid
  }
  const idx = Math.min(Math.max(lo - 1, 0), grid.length - 1)
  return values[idx]
}

export const envelopes = timed('transform', 'envelopes', envelopes_)
