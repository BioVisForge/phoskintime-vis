import type { NpyArray, Table } from '../model/types'
import { num, str } from '../transforms/table'
import { networkGof, protwiseGofOffsets, type GofStats } from '../transforms/gof'
import { klRow, klByGene, type KlRow } from '../transforms/kl'
import { envelopes } from '../transforms/envelope'
import { quantile, mean, std } from '../transforms/stats'
import { npyIndex } from '../io/npy'

/** Row indices of the best-fit sample ('best' if present, otherwise the first sample_id). */
export function bestRows(t: Table): Int32Array {
  const sid = str(t, 'sample_id')
  const target = sid.includes('best') ? 'best' : sid[0]
  const out: number[] = []
  for (let i = 0; i < t.rows; i++) if (sid[i] === target) out.push(i)
  return Int32Array.from(out)
}

export interface GofPoint {
  layer: string
  protein: string
  psite: string | null
  state: string
  time: number
  obs: number
  pred: number
  resid: number
}

/** Observed/predicted pairs of the best fit; pairs with a null side are not points (gaps). */
export function gofPoints(t: Table): GofPoint[] {
  const idx = bestRows(t)
  const L = str(t, 'layer')
  const P = str(t, 'protein')
  const S = str(t, 'psite')
  const ST = str(t, 'state')
  const T = num(t, 'time')
  const O = num(t, 'value_obs')
  const E = num(t, 'value_pred')
  const out: GofPoint[] = []
  for (const i of idx) {
    if (!Number.isFinite(O[i]) || !Number.isFinite(E[i])) continue
    out.push({ layer: L[i]!, protein: P[i]!, psite: S[i], state: ST[i]!, time: T[i], obs: O[i], pred: E[i], resid: E[i] - O[i] })
  }
  return out
}

export function gofByLayer(points: GofPoint[]): { overall: GofStats; layers: Record<string, GofStats> } {
  const overall = networkGof(points.map((p) => p.obs), points.map((p) => p.pred))
  const layers: Record<string, GofStats> = {}
  for (const l of [...new Set(points.map((p) => p.layer))]) {
    const s = points.filter((p) => p.layer === l)
    layers[l] = networkGof(s.map((p) => p.obs), s.map((p) => p.pred))
  }
  return { overall, layers }
}

/** protwise GOF band offsets over the protein + phospho layers (the merged x1..x14 rows). */
export function protwiseOffsets(t: Table, layers = ['protein', 'phospho']) {
  const idx = bestRows(t)
  const L = str(t, 'layer')
  const O = num(t, 'value_obs')
  const v: number[] = []
  for (const i of idx) if (layers.includes(L[i]!) && Number.isFinite(O[i])) v.push(O[i])
  return protwiseGofOffsets(v)
}

export function klFromTrajectories(t: Table, layers = ['protein', 'phospho']): { rows: KlRow[]; byGene: ReturnType<typeof klByGene> } {
  const idx = bestRows(t)
  const L = str(t, 'layer')
  const P = str(t, 'protein')
  const ST = str(t, 'state')
  const T = num(t, 'time')
  const O = num(t, 'value_obs')
  const E = num(t, 'value_pred')
  const groups = new Map<string, { gene: string; state: string; pts: [number, number, number][] }>()
  for (const i of idx) {
    if (!layers.includes(L[i]!)) continue
    const k = `${P[i]}\u0000${ST[i]}`
    let g = groups.get(k)
    if (!g) groups.set(k, (g = { gene: P[i]!, state: ST[i]!, pts: [] }))
    g.pts.push([T[i], O[i], E[i]])
  }
  const rows = [...groups.values()]
    .sort((a, b) => (a.gene + '\u0000' + a.state < b.gene + '\u0000' + b.state ? -1 : 1))
    .map((g) => {
      g.pts.sort((a, b) => a[0] - b[0])
      return klRow(g.gene, g.state, g.pts.map((p) => p[1]), g.pts.map((p) => p[2]))
    })
  return { rows, byGene: klByGene(rows) }
}

/** Envelopes of value_pred across samples per (state, exact time). */
export function predEnvelopes(t: Table, states?: Set<string>) {
  const ST = str(t, 'state')
  const T = num(t, 'time')
  const E = num(t, 'value_pred')
  if (!states) return envelopes(ST, T, E)
  const k: string[] = []
  const tt: number[] = []
  const vv: number[] = []
  for (let i = 0; i < t.rows; i++)
    if (states.has(ST[i]!)) {
      k.push(ST[i]!)
      tt.push(T[i])
      vv.push(E[i])
    }
  return envelopes(k, tt, vv)
}

/** All draws (chains concatenated, as PhosKinTime's summary does) of parameter column j. */
export function posteriorColumn(a: NpyArray, j: number): Float64Array {
  const [C, D] = a.shape
  const out = new Float64Array(C * D)
  for (let c = 0; c < C; c++) for (let d = 0; d < D; d++) out[c * D + d] = Number(a.data[npyIndex(a, [c, d, j])])
  return out
}

/** BayesianInference.py summary: mean, sd (ddof 0), 5/50/95 % quantiles (a 90 % interval). */
export function credible(values: ArrayLike<number>) {
  return { mean: mean(values), sd: std(values, 0), q05: quantile(values, 0.05), q50: quantile(values, 0.5), q95: quantile(values, 0.95) }
}
