import { describe, expect, it } from 'vitest'
import { EngineHttpSource } from '../../src/lib/sources/engine'
import { availability } from '../../src/lib/panels/availability'
import { LoadedBundle } from '../../src/lib/model/bundle'
import { fixtureSource, haveFixtures } from './helpers'
import type { PanelDef } from '../../src/lib/panels/types'

const def = (over: Partial<PanelDef>): PanelDef =>
  ({ id: 'x', title: 'x', workflow: 'any', section: 's', requires: [], minSchema: '1.0', parity: null, coverage: 'viewer-extra', patterns: [], description: '', component: null as never, ...over }) as PanelDef

describe.skipIf(!haveFixtures)('panel availability is driven by bundle contents', () => {
  it('enables when tables and columns exist, otherwise quotes the manifest reason', async () => {
    const b = await LoadedBundle.open(fixtureSource('partial'))
    expect(availability(def({ requires: [{ table: 'trajectories', columns: ['time'] }] }), b).ok).toBe(true)
    const na = availability(def({ requires: [{ table: 'sensitivity' }] }), b)
    expect(na.ok).toBe(false)
    expect(na.reason).toMatch(/^Manifest: “Spec fixture 'partial'/)
    expect(availability(def({ requires: [{ table: 'trajectories', columns: ['nope'] }] }), b).reason).toMatch(/lacks column\(s\): nope/)
    expect(availability(def({ requires: [{ table: 'pareto' }] }), b).reason).toMatch(/no reason given/)
    expect(availability(def({ workflow: 'networkmodel' }), b).reason).toMatch(/Not a networkmodel bundle/)
    expect(availability(def({ minSchema: '1.1' }), b).reason).toMatch(/Needs bundle schema 1.1/)
  })
})

describe('engine connector', () => {
  it('accepts only loopback URLs', () => {
    expect(new EngineHttpSource('http://127.0.0.1:8765/x').url).toBe('http://127.0.0.1:8765')
    expect(() => new EngineHttpSource('http://example.org:8765')).toThrow(/this machine/)
  })
})
