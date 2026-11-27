import { describe, expect, it } from 'vitest'
import { LoadedBundle } from '../../src/lib/model/bundle'
import { BundleZipSource } from '../../src/lib/sources/zip'
import { MemorySource } from '../../src/lib/sources/memory'
import { num, str, rows } from '../../src/lib/transforms/table'
import { fixtureSource, fixtureZip, haveFixtures } from './helpers'

describe.skipIf(!haveFixtures)('sources, loading, sha256 verification, nulls', () => {
  it('opens folder and zip forms of the same bundle identically', async () => {
    const a = await LoadedBundle.open(fixtureSource('small-protwise'))
    const b = await LoadedBundle.open(new BundleZipSource('small-protwise.pkt.zip', fixtureZip('small-protwise')))
    expect(a.meta.bundleId).toBe(b.meta.bundleId)
    expect((await a.verify()).every((c) => c.ok)).toBe(true)
    expect((await b.verify()).every((c) => c.ok)).toBe(true)
    expect(a.verifyState).toBe('verified')
    expect(a.unlisted).toEqual([])
  })
  it('detects a tampered file', async () => {
    const t = await LoadedBundle.open(fixtureSource('tampered'))
    const checks = await t.verify()
    expect(t.verifyState).toBe('mismatch')
    expect(checks.filter((c) => !c.ok).map((c) => c.path)).toEqual(['tables/metrics.parquet'])
  })
  it('reports a listed file that is absent as an error, and unlisted extras', async () => {
    const files: Record<string, Uint8Array> = {}
    const src = fixtureSource('small-protwise')
    for (const p of src.list()) if (p !== 'tables/metrics.parquet') files['x/' + p] = new Uint8Array(await src.read(p))
    files['x/tables/extra.parquet'] = new Uint8Array([1])
    const b = await LoadedBundle.open(new MemorySource('x', files))
    expect(b.unlisted).toEqual(['tables/extra.parquet'])
    await b.verify()
    expect(b.verifyState).toBe('error')
  })
  it('decodes Parquet with nulls as gaps, not zeros', async () => {
    const b = await LoadedBundle.open(fixtureSource('network'))
    const t = await b.table('trajectories')
    expect(t.rows).toBe(112000)
    const obs = num(t, 'value_obs')
    const layer = str(t, 'layer')
    // RNA is unobserved before t=4 in the fixtures
    const time = num(t, 'time')
    let nullsEarlyRna = 0
    for (let i = 0; i < t.rows; i++) if (layer[i] === 'rna' && time[i] < 4 && Number.isNaN(obs[i])) nullsEarlyRna++
    expect(nullsEarlyRna).toBeGreaterThan(0)
    expect(t.columns.value_obs.valid).toBeDefined()
    const r = rows(t, ['value_obs'], [0])[0]
    expect(r.value_obs).toBeNull()
    expect(str(t, 'psite')[0]).toBeNull()
    expect(t.columns.time.unit).toBe('min')
  })
  it('reads posterior draws (.npy) with the declared shape', async () => {
    const b = await LoadedBundle.open(fixtureSource('network'))
    const a = await b.array('posterior_draws')
    expect(a.shape).toEqual([4, 500, 200])
  })
  it('exposes manifest missing reasons', async () => {
    const b = await LoadedBundle.open(fixtureSource('partial'))
    expect(b.hasTable('sensitivity')).toBe(false)
    expect(b.missingReason('sensitivity')).toMatch(/deliberately left out/)
  })
})
