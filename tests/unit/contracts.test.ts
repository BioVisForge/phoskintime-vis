import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyContract, ContractError } from '../../src/lib/contracts/index'
import { FIX, haveFixtures } from './helpers'

const load = (n: string) => JSON.parse(readFileSync(join(FIX, `${n}.pkt/manifest.json`), 'utf8'))

describe.skipIf(!haveFixtures)('contracts and adapters', () => {
  it('adapts a valid 1.0 manifest into the internal model', () => {
    const r = applyContract(load('network'))
    expect(r.contract).toBe('1.0-draft')
    expect(r.draft).toBe(true)
    expect(r.meta.workflows).toEqual(['networkmodel'])
    expect(r.meta.parameters.length).toBe(200)
    expect(r.meta.knownIssuesOpen?.map((k) => k.id)).toContain('N17')
    expect(r.meta.layers.find((l) => l.id === 'rna')?.foldChangeBaseline?.time).toBe(4)
  })
  it('refuses an unsupported major with a clear message', () => {
    try {
      applyContract(load('future-major'))
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ContractError)
      expect((e as ContractError).kind).toBe('unsupported-version')
      expect((e as Error).message).toMatch(/Unsupported bundle schema 2\.0.*supports major version\(s\) 1/)
    }
  })
  it('accepts a newer minor with a notice', () => {
    const m = load('small-protwise')
    m.bundle_schema = '1.7'
    expect(applyContract(m).notices.join(' ')).toMatch(/newer than this viewer knows/)
  })
  it('rejects invalid manifests with details', () => {
    const m = load('small-protwise')
    delete m.producer
    m.files[0].sha256 = 'nothex'
    try {
      applyContract(m)
      expect.fail('should throw')
    } catch (e) {
      expect((e as ContractError).kind).toBe('invalid-manifest')
      expect((e as ContractError).details.join('\n')).toMatch(/producer/)
      expect((e as ContractError).details.join('\n')).toMatch(/files\/0\/sha256/)
    }
  })
  it('distinguishes absent known_issues_open from an empty list', () => {
    const m = load('small-protwise')
    delete m.known_issues_open
    expect(applyContract(m).meta.knownIssuesOpen).toBeNull()
    m.known_issues_open = []
    expect(applyContract(m).meta.knownIssuesOpen).toEqual([])
  })
  it('rejects a missing or malformed bundle_schema', () => {
    expect(() => applyContract({})).toThrow(/bundle_schema/)
    expect(() => applyContract({ bundle_schema: 'one' })).toThrow(/bundle_schema/)
  })
})
