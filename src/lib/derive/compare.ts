import type { LoadedBundle } from '../model/bundle'
import { num, str } from '../transforms/table'
import { alignParameters, alignTrajectories, compareMetrics, issueDiff, type NamedValue, type TrajPoint } from '../transforms/compare'
import { bestRows, gofByLayer, gofPoints } from './trajectories'
import { timed } from '../perf/spans'

export async function parameterValues(b: LoadedBundle): Promise<NamedValue[]> {
  const t = await b.table('parameters')
  const sid = str(t, 'sample_id')
  const target = sid.includes('best') ? 'best' : sid[0]
  const N = str(t, 'name')
  const V = num(t, 'value')
  const meta = new Map(b.meta.parameters.map((p) => [p.name, p]))
  const out: NamedValue[] = []
  for (let i = 0; i < t.rows; i++) {
    if (sid[i] !== target) continue
    const m = meta.get(N[i]!)
    out.push({ name: N[i]!, value: V[i], group: m?.group ?? null, label: m?.label ?? null, unit: m?.unit ?? null })
  }
  return out
}

async function bestTrajectory_(b: LoadedBundle): Promise<TrajPoint[]> {
  const t = await b.table('trajectories')
  const idx = bestRows(t)
  const ST = str(t, 'state')
  const L = str(t, 'layer')
  const P = str(t, 'protein')
  const T = num(t, 'time')
  const E = num(t, 'value_pred')
  return Array.from(idx, (i) => ({ state: ST[i]!, layer: L[i]!, protein: P[i]!, time: T[i], value: E[i] }))
}

/** Everything comparison mode shows and exports, for run A (before) vs run B (after). */
export async function compareRuns(a: LoadedBundle, b: LoadedBundle) {
  const [pa, pb] = await Promise.all([parameterValues(a), parameterValues(b)])
  const params = alignParameters(pa, pb, a.meta.parameterOrderSha256, b.meta.parameterOrderSha256)
  const [ta, tb] = await Promise.all([bestTrajectory(a), bestTrajectory(b)])
  const traj = alignTrajectories(ta, tb)
  const statesAligned = a.meta.stateOrderSha256 === b.meta.stateOrderSha256
  const [ga, gb] = await Promise.all([a.table('trajectories'), b.table('trajectories')])
  const gofA = gofByLayer(gofPoints(ga))
  const gofB = gofByLayer(gofPoints(gb))
  let metrics: ReturnType<typeof compareMetrics> = []
  if (a.hasTable('metrics') && b.hasTable('metrics')) {
    const read = async (x: LoadedBundle) => {
      const t = await x.table('metrics')
      const L = str(t, 'layer')
      const P = str(t, 'protein')
      const M = str(t, 'metric')
      const V = num(t, 'value')
      return Array.from({ length: t.rows }, (_, i) => ({ layer: L[i], protein: P[i], metric: M[i]!, value: V[i] }))
    }
    metrics = compareMetrics(await read(a), await read(b))
  }
  const ids = (x: LoadedBundle) => (x.meta.knownIssuesOpen ? x.meta.knownIssuesOpen.map((k) => k.id) : null)
  return {
    params,
    traj,
    statesAligned,
    gof: { a: gofA, b: gofB },
    metrics,
    issues: issueDiff(ids(a), ids(b)),
    provenance: {
      a: { label: a.label, bundleId: a.meta.bundleId, commit: a.meta.gitCommit, config: a.meta.configSha256, version: a.meta.phoskintimeVersion, verify: a.verifyState },
      b: { label: b.label, bundleId: b.meta.bundleId, commit: b.meta.gitCommit, config: b.meta.configSha256, version: b.meta.phoskintimeVersion, verify: b.verifyState },
      sameConfig: a.meta.configSha256 === b.meta.configSha256,
      sameCommit: a.meta.gitCommit === b.meta.gitCommit,
    },
  }
}

export type Comparison = Awaited<ReturnType<typeof compareRuns>>

export const bestTrajectory = timed('shaping', 'bestTrajectory', bestTrajectory_)
