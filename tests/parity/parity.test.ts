/**
 * Parity: the viewer's numbers vs tests/reference/compute_reference.py (PhosKinTime's formulas,
 * re-implemented with numpy/scipy) on the spec fixtures. Tolerance rtol 1e-9 unless noted.
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { LoadedBundle } from '../../src/lib/model/bundle'
import { fixtureSource } from '../unit/helpers'
import { gofByLayer, gofPoints, protwiseOffsets, klFromTrajectories, predEnvelopes, posteriorColumn, credible } from '../../src/lib/derive/trajectories'
import { smoothDensity1d } from '../../src/lib/transforms/kde'
import { boxStats } from '../../src/lib/transforms/box'
import { linregress } from '../../src/lib/transforms/stats'
import { finiteDifferenceArrows } from '../../src/lib/transforms/envelope'
import { num, str } from '../../src/lib/transforms/table'
import { compareRuns } from '../../src/lib/derive/compare'

const REF = resolve(__dirname, '../reference/out/reference.json')
const ref = existsSync(REF) ? JSON.parse(readFileSync(REF, 'utf8')) : null
const RTOL = 1e-9
export const maxRel: Record<string, number> = {}

function close(name: string, actual: number, expected: number | null | string, rtol = RTOL, atol = 1e-12) {
  if (expected === null) return expect(Number.isNaN(actual)).toBe(true)
  if (expected === 'inf') return expect(actual).toBe(Infinity)
  const e = expected as number
  const err = Math.abs(actual - e)
  const rel = err / Math.max(Math.abs(e), 1e-300)
  maxRel[name] = Math.max(maxRel[name] ?? 0, Math.abs(e) > atol ? rel : 0)
  expect(err, `${name}: ${actual} vs ${e}`).toBeLessThanOrEqual(atol + rtol * Math.abs(e))
}

describe.skipIf(!ref)('parity with PhosKinTime formulas', () => {
  let net: LoadedBundle, fix: LoadedBundle, small: LoadedBundle, reord: LoadedBundle
  beforeAll(async () => {
    net = await LoadedBundle.open(fixtureSource('network'))
    fix = await LoadedBundle.open(fixtureSource('network-after-fix'))
    small = await LoadedBundle.open(fixtureSource('small-protwise'))
    reord = await LoadedBundle.open(fixtureSource('reordered-params'))
  })

  it('networkmodel GOF: robust σ, bands, R² (linregress r²), identity RMSE, overall and per layer', async () => {
    const g = gofByLayer(gofPoints(await net.table('trajectories')))
    for (const [k, s] of [['overall', g.overall], ...Object.entries(g.layers)] as const) {
      const r = ref.gof_network[k]
      expect(s.n).toBe(r.n)
      for (const f of ['sigma', 'd95', 'd99', 'r2', 'rmse', 'slope', 'intercept'] as const) close(`gof.${f}`, s[f], r[f])
    }
  })

  it('protwise GOF offsets', async () => {
    const o = protwiseOffsets(await small.table('trajectories'))
    close('protwise.std', o.std, ref.gof_protwise.std)
    close('protwise.d95', o.d95, ref.gof_protwise.d95)
    close('protwise.d99', o.d99, ref.gof_protwise.d99)
  })

  it('KL per site and per gene (natural log)', async () => {
    const k = klFromTrajectories(await small.table('trajectories'))
    expect(k.rows.length).toBe(ref.kl.rows.length)
    k.rows.forEach((r, i) => {
      expect(r.site).toBe(ref.kl.rows[i].state)
      expect(r.points).toBe(ref.kl.rows[i].points)
      close('kl.row', r.kl, ref.kl.rows[i].kl)
    })
    for (const g of k.byGene) close('kl.gene', g.kl, ref.kl.by_gene[g.gene])
  })

  it('min/max and quantile envelopes per exact time point', async () => {
    const e = predEnvelopes(await net.table('trajectories'), new Set(ref.envelopes.states))
    expect(e.length).toBe(ref.envelopes.rows.length)
    e.forEach((x, i) => {
      const r = ref.envelopes.rows[i]
      expect([x.key, x.n]).toEqual([r.key, r.n])
      for (const f of ['time', 'min', 'max', 'q01', 'q05', 'q50', 'q95', 'q99'] as const) close(`env.${f}`, x[f], r[f])
    })
  })

  it('posterior KDE (_smooth_density_1d) and 5/50/95 % summary', async () => {
    const a = await net.array('posterior_draws')
    for (const r of ref.kde) {
      const { x, density } = smoothDensity1d(posteriorColumn(a, r.param_index))
      x.forEach((v, i) => close('kde.x', v, r.x[i]))
      // KDE sums 2000 exponentials per grid point: summation-order rounding, still well below 1e-9
      density.forEach((v, i) => close('kde.density', v, r.density[i], RTOL, 1e-15))
    }
    for (const r of ref.credible) {
      const c = credible(posteriorColumn(a, r.param_index))
      for (const f of ['q05', 'q50', 'q95', 'mean', 'sd'] as const) close(`credible.${f}`, c[f], r[f])
    }
  })

  it('box statistics (Tukey, numpy linear quantiles)', async () => {
    const ms = await net.table('multistart')
    const check = (b: ReturnType<typeof boxStats>, r: any) => {
      expect(b.n).toBe(r.n)
      for (const f of ['q1', 'median', 'q3', 'whiskerLow', 'whiskerHigh'] as const) close(`box.${f}`, b[f], r[f])
      expect(b.outliers.length).toBe(r.outliers.length)
      b.outliers.forEach((v, i) => close('box.outlier', v, r.outliers[i]))
    }
    check(boxStats(num(ms, 'objective')), ref.box.multistart)
    const pts = gofPoints(await net.table('trajectories'))
    for (const l of ['rna', 'protein', 'phospho']) check(boxStats(pts.filter((p) => p.layer === l).map((p) => p.resid)), ref.box[`resid_${l}`])
  })

  it('OLS regression line vs scipy.stats.linregress', async () => {
    const pts = gofPoints(await net.table('trajectories'))
    for (const l of ['rna', 'protein', 'phospho']) {
      const s = pts.filter((p) => p.layer === l)
      const r = linregress(s.map((p) => p.obs), s.map((p) => p.pred))
      close('ols.slope', r.slope, ref.ols[l].slope)
      close('ols.intercept', r.intercept, ref.ols[l].intercept)
      close('ols.r', r.r, ref.ols[l].r)
    }
  })

  it('finite-difference arrows', async () => {
    const e = await small.table('embeddings')
    const P = str(e, 'protein')
    const M = str(e, 'method')
    const idx = [...Array(e.rows).keys()].filter((i) => P[i] === 'PROT1' && M[i] === 'pca')
    const t = num(e, 'time'), x = num(e, 'x'), y = num(e, 'y')
    const arr = finiteDifferenceArrows(idx.map((i) => t[i]), idx.map((i) => x[i]), idx.map((i) => y[i]))
    expect(arr.length).toBe(ref.arrows.length)
    arr.forEach((a, i) => {
      for (const f of ['t0', 't1', 'dx', 'dy', 'angleDeg'] as const) close(`arrow.${f}`, a[f], ref.arrows[i][f])
    })
  })

  it('comparison deltas (network vs network-after-fix) and by-name alignment (reordered)', async () => {
    const c = await compareRuns(net, fix)
    expect(c.params.mode).toBe('aligned')
    for (const p of c.params.pairs) {
      const r = ref.compare_params[p.name]
      close('cmp.delta', p.delta, r.delta)
      close('cmp.ratio', p.ratio!, r.ratio)
      close('cmp.log2ratio', p.log2ratio!, r.log2ratio)
    }
    const d = c.traj.pairs.filter((p) => Number.isFinite(p.delta))
    expect(d.length).toBe(ref.compare_traj.n)
    close('cmp.traj.sum', d.reduce((s, p) => s + p.delta, 0), ref.compare_traj.sum, 1e-9)
    close('cmp.traj.maxabs', Math.max(...d.map((p) => Math.abs(p.delta))), ref.compare_traj.max_abs)
    for (const l of ['rna', 'protein', 'phospho']) {
      close('cmp.gof.rmse', c.gof.a.layers[l].rmse, ref.compare_gof[l].a.rmse)
      close('cmp.gof.rmse', c.gof.b.layers[l].rmse, ref.compare_gof[l].b.rmse)
      close('cmp.gof.r2', c.gof.b.layers[l].r2, ref.compare_gof[l].b.r2)
    }
    expect(c.issues.onlyA.sort()).toEqual(['N17', 'N5', 'N7'])
    const r = await compareRuns(net, reord)
    expect(r.params.mode).toBe('by-name')
    expect(r.params.onlyA.sort()).toEqual(ref.compare_reordered.only_a)
    expect(r.params.onlyB.sort()).toEqual(ref.compare_reordered.only_b)
    expect(r.params.pairs.length).toBe(ref.compare_reordered.n_pairs)
  })

  it('writes the max relative errors', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    mkdirSync(resolve(__dirname, '../reference/out'), { recursive: true })
    writeFileSync(resolve(__dirname, '../reference/out/parity-max-errors.json'), JSON.stringify(maxRel, null, 2))
  })
})
