/**
 * Run comparison (run A = before, run B = after). Pure functions, unit- and parity-tested.
 *
 * Alignment rule: when both bundles declare the same order hash, rows are paired by position
 * ("aligned"), and the names at each position are checked. Otherwise rows are paired by name
 * ("by-name") and rows present in only one run are listed, never silently dropped.
 */

export type NamedValue = {
  name: string
  value: number
  group?: string | null
  label?: string | null
  unit?: string | null
}

export type ParamDelta = {
  name: string
  group: string | null
  label: string | null
  unit: string | null
  a: number
  b: number
  delta: number
  /** b / a; null when a is 0 or either side is null. */
  ratio: number | null
  log2ratio: number | null
}

export interface Alignment<T> {
  mode: 'aligned' | 'by-name'
  reason: string
  pairs: T[]
  onlyA: string[]
  onlyB: string[]
}

export function alignParameters(a: NamedValue[], b: NamedValue[], shaA: string, shaB: string): Alignment<ParamDelta> {
  let mode: 'aligned' | 'by-name' = 'by-name'
  let reason = 'parameter_order_sha256 differs: paired by name.'
  if (shaA === shaB) {
    if (a.length === b.length && a.every((x, i) => x.name === b[i].name)) {
      mode = 'aligned'
      reason = 'Same parameter_order_sha256: paired by position (names checked).'
    } else {
      reason = 'Same parameter_order_sha256 but names differ by position: paired by name instead.'
    }
  }
  const mk = (x: NamedValue, y: NamedValue): ParamDelta => {
    const ok = Number.isFinite(x.value) && Number.isFinite(y.value)
    const ratio = ok && x.value !== 0 ? y.value / x.value : null
    return {
      name: x.name,
      group: x.group ?? y.group ?? null,
      label: x.label ?? y.label ?? null,
      unit: x.unit ?? y.unit ?? null,
      a: x.value,
      b: y.value,
      delta: ok ? y.value - x.value : NaN,
      ratio,
      log2ratio: ratio !== null && ratio > 0 ? Math.log2(ratio) : null,
    }
  }
  if (mode === 'aligned') return { mode, reason, pairs: a.map((x, i) => mk(x, b[i])), onlyA: [], onlyB: [] }
  const mb = new Map(b.map((x) => [x.name, x]))
  const ma = new Set(a.map((x) => x.name))
  const pairs: ParamDelta[] = []
  for (const x of a) {
    const y = mb.get(x.name)
    if (y) pairs.push(mk(x, y))
  }
  return { mode, reason, pairs, onlyA: a.filter((x) => !mb.has(x.name)).map((x) => x.name), onlyB: b.filter((x) => !ma.has(x.name)).map((x) => x.name) }
}

/** Sort deltas by |log2 ratio| (falling back to |delta|), largest first; nulls last. */
export function sortDeltas(p: ParamDelta[]): ParamDelta[] {
  const key = (d: ParamDelta) => (d.log2ratio !== null ? Math.abs(d.log2ratio) : Number.isFinite(d.delta) ? Math.abs(d.delta) : -1)
  return [...p].sort((x, y) => key(y) - key(x) || (x.name < y.name ? -1 : 1))
}

export type TrajPoint = {
  state: string
  layer: string
  protein: string
  time: number
  value: number
}

export type TrajDelta = {
  state: string
  layer: string
  protein: string
  time: number
  a: number
  b: number
  delta: number
}

/** Pair predicted trajectories by (state, exact time). States present in only one run are listed. */
export function alignTrajectories(a: TrajPoint[], b: TrajPoint[]): Alignment<TrajDelta> & { timesOnlyA: number; timesOnlyB: number } {
  const key = (p: TrajPoint) => `${p.state}\u0000${p.time}`
  const mb = new Map(b.map((p) => [key(p), p]))
  const ka = new Set(a.map(key))
  const statesA = new Set(a.map((p) => p.state))
  const statesB = new Set(b.map((p) => p.state))
  const pairs: TrajDelta[] = []
  let timesOnlyA = 0
  for (const p of a) {
    const q = mb.get(key(p))
    if (!q) {
      if (statesB.has(p.state)) timesOnlyA++
      continue
    }
    pairs.push({ state: p.state, layer: p.layer, protein: p.protein, time: p.time, a: p.value, b: q.value, delta: Number.isFinite(p.value) && Number.isFinite(q.value) ? q.value - p.value : NaN })
  }
  const timesOnlyB = b.filter((q) => !ka.has(key(q)) && statesA.has(q.state)).length
  return {
    mode: 'by-name',
    reason: 'Trajectories paired by (state, time).',
    pairs,
    onlyA: [...statesA].filter((s) => !statesB.has(s)),
    onlyB: [...statesB].filter((s) => !statesA.has(s)),
    timesOnlyA,
    timesOnlyB,
  }
}

export type MetricRow = {
  layer: string | null
  protein: string | null
  metric: string
  value: number
}

export function compareMetrics(a: MetricRow[], b: MetricRow[]) {
  const key = (m: MetricRow) => `${m.layer ?? ''}\u0000${m.protein ?? ''}\u0000${m.metric}`
  const mb = new Map(b.map((m) => [key(m), m]))
  const ka = new Set(a.map(key))
  const out = a.map((m) => {
    const o = mb.get(key(m))
    const bv = o ? o.value : NaN
    return { layer: m.layer, protein: m.protein, metric: m.metric, a: m.value, b: bv, delta: Number.isFinite(bv) && Number.isFinite(m.value) ? bv - m.value : NaN, inB: !!o, inA: true }
  })
  for (const m of b) if (!ka.has(key(m))) out.push({ layer: m.layer, protein: m.protein, metric: m.metric, a: NaN, b: m.value, delta: NaN, inB: true, inA: false })
  return out
}

/** Which known-issue IDs differ between runs (null list = manifest field absent). */
export function issueDiff(a: string[] | null, b: string[] | null) {
  if (a === null || b === null) return { available: false as const, onlyA: [], onlyB: [], both: [] }
  const sa = new Set(a)
  const sb = new Set(b)
  return {
    available: true as const,
    onlyA: a.filter((x) => !sb.has(x)),
    onlyB: b.filter((x) => !sa.has(x)),
    both: a.filter((x) => sb.has(x)),
  }
}
