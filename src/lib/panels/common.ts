import type { LoadedBundle } from '../model/bundle'
import type { Table } from '../model/types'
import { num, str } from '../transforms/table'
import { bestRows } from '../derive/trajectories'
import { timed } from '../perf/spans'

export const PKT_COMMIT = 'e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b'

/** Manifest label for a parameter, or the raw name when the label is missing (N8). */
export function paramLabel(b: LoadedBundle, name: string): string {
  const p = b.meta.parameters.find((x) => x.name === name)
  return p?.label ? `${p.label} (${name})` : name
}

export function groupLabel(b: LoadedBundle, id: string | null): string {
  if (!id) return '(no group)'
  const g = b.meta.parameterGroups.find((x) => x.id === id)
  return g?.label ? `${g.label} [${id}]` : id
}

export function layerLabel(b: LoadedBundle, id: string): string {
  return b.meta.layers.find((l) => l.id === id)?.label ?? id
}

export function layerUnit(b: LoadedBundle, id: string): string {
  return b.meta.layers.find((l) => l.id === id)?.unit ?? ''
}

export function colUnit(t: Table, col: string): string {
  const u = t.columns[col]?.unit
  return u ? ` (${u})` : ''
}

export type TrajRow = {
  layer: string
  protein: string
  psite: string | null
  state: string
  sample: string
  time: number
  obs: number | null
  pred: number | null
}

function trajRows_(t: Table, opts: { protein?: string; best?: boolean } = {}): TrajRow[] {
  const L = str(t, 'layer'), P = str(t, 'protein'), S = str(t, 'psite'), ST = str(t, 'state'), SID = str(t, 'sample_id')
  const T = num(t, 'time'), O = num(t, 'value_obs'), E = num(t, 'value_pred')
  const idx = opts.best ? bestRows(t) : Int32Array.from({ length: t.rows }, (_, i) => i)
  const out: TrajRow[] = []
  for (const i of idx) {
    if (opts.protein && P[i] !== opts.protein) continue
    out.push({ layer: L[i]!, protein: P[i]!, psite: S[i], state: ST[i]!, sample: SID[i]!, time: T[i], obs: Number.isFinite(O[i]) ? O[i] : null, pred: Number.isFinite(E[i]) ? E[i] : null })
  }
  return out
}

export function proteins(t: Table): string[] {
  return [...new Set(str(t, 'protein').filter((x): x is string => !!x))].sort()
}

export const fmt = (v: number, d = 3) => (Number.isFinite(v) ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(d - 1) : v.toFixed(d)) : 'n/a')

/** Histogram with numpy-style equal-width bins over [min, max] (last bin closed). */
export function histogram(values: number[], bins: number) {
  const v = values.filter(Number.isFinite)
  if (!v.length) return []
  let lo = Math.min(...v), hi = Math.max(...v)
  if (lo === hi) { lo -= 0.5; hi += 0.5 }
  const w = (hi - lo) / bins
  const counts = new Array(bins).fill(0)
  for (const x of v) counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++
  return counts.map((c, i) => ({ x1: lo + i * w, x2: lo + (i + 1) * w, count: c }))
}

/** Explicit ticks for symlog time axes (automatic symlog ticks can come out negative). */
export const TIME_TICKS = [0, 1, 10, 100, 1000]
/** TIME_TICKS continued by decades up to tmax (long steady-state runs). */
export function symlogTicks(tmax: number): number[] {
  const out = [...TIME_TICKS]
  while (out[out.length - 1] * 10 <= tmax) out.push(out[out.length - 1] * 10)
  return out.filter((t) => t <= Math.max(tmax, 1))
}

/** Marks with more elements than this draw on canvas (addendum rule; also avoids a Svelte runtime cost that grows with the number of SVG elements). */
export const CANVAS_MIN = 1000
/** A brush selection is applied when the pointer pauses this long (the rectangle itself follows at once). */
export const BRUSH_SETTLE_MS = 120

/**
 * State chosen for a panel: the global psite (or layer) when it names one of `states`, else the
 * panel's own choice, else the first. `meta` maps state -> {psite, layer} (from trajectories).
 */
export function stateFor(states: string[], meta: Map<string, { psite: string | null; layer: string }>, ctx: { psite: string | null; layer: string | null }, local: string): string {
  if (ctx.psite) {
    const s = states.find((x) => meta.get(x)?.psite === ctx.psite)
    if (s) return s
  }
  if (ctx.layer && !ctx.psite) {
    const s = states.find((x) => meta.get(x)?.layer === ctx.layer)
    if (s && !states.includes(local)) return s
  }
  return states.includes(local) ? local : (states[0] ?? '')
}

export function stateMeta(rows: { state: string; psite: string | null; layer: string }[]) {
  return new Map(rows.map((r) => [r.state, { psite: r.psite, layer: r.layer }]))
}

export const trajRows = timed('shaping', 'trajRows', trajRows_)
