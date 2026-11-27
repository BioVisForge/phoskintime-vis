<script lang="ts">
  import { Plot, Line, DifferenceY, Dot } from '../plot'
  import { app } from './state.svelte'
  import { EngineHttpSource } from '../sources/engine'
  import type { EngineInfo, SimResult, VerifyResult } from '../engine/types'
  import { trajRows, paramLabel, groupLabel, TIME_TICKS, proteins, type TrajRow } from '../panels/common'
  import { parameterValues } from '../derive/compare'
  import type { Table } from '../model/types'
  import { num, str, toCsv } from '../transforms/table'
  import { download } from '../export/figure'

  let url = $state('http://127.0.0.1:8765')
  let engine = $state.raw<EngineHttpSource | null>(null)
  let info = $state.raw<EngineInfo | null>(null)
  let verify = $state.raw<VerifyResult | null>(null)
  let err = $state<string | null>(null)
  let result = $state.raw<SimResult | null>(null)
  let base = $state.raw<TrajRow[]>([])
  let params = $state.raw<{ name: string; value: number; group: string | null; lo: number; hi: number }[]>([])
  let protein = $state('')
  let stateSel = $state('')
  let overrides = $state<Record<string, number>>({})
  let kos = $state<Record<string, boolean>>({})
  let running = $state(false)
  const b = $derived(app.active)

  async function connect() {
    err = null
    info = null
    verify = null
    result = null
    try {
      engine = new EngineHttpSource(url)
      info = await engine.health()
      if (b) verify = await engine.verify(b.meta.bundleId)
    } catch (e) {
      err = `Could not reach an engine at ${url}: ${(e as Error).message}`
    }
  }

  $effect(() => {
    const bb = b
    if (!bb || !bb.hasTable('trajectories') || !bb.hasTable('parameters')) return
    Promise.all([bb.table('trajectories'), parameterValues(bb), bb.table('parameters')]).then(([t, pv, pt]: [Table, Awaited<ReturnType<typeof parameterValues>>, Table]) => {
      base = trajRows(t, { best: true })
      const N = str(pt, 'name'), LO = num(pt, 'lower'), HI = num(pt, 'upper')
      const bounds = new Map(N.map((n, i) => [n, [LO[i], HI[i]]]))
      params = pv.map((p) => ({ name: p.name, value: p.value, group: p.group ?? null, lo: bounds.get(p.name)?.[0] ?? p.value / 10, hi: bounds.get(p.name)?.[1] ?? p.value * 10 }))
      protein = proteins(t)[0]
    })
  })

  const pParams = $derived(params.filter((p) => p.name.includes(`[${protein}]`) || p.name.includes(`_${protein}`) || p.name.endsWith(protein)))
  const groups = $derived([...new Set(pParams.map((p) => p.group))])
  const states = $derived([...new Set(base.filter((r) => r.protein === protein).map((r) => r.state))])
  const S = $derived(states.includes(stateSel) ? stateSel : states[0])
  const can = (op: 'set_parameter' | 'knockout') => !!info?.capabilities.whatifOps.includes(op)

  async function run() {
    if (!engine || !b) return
    running = true
    err = null
    try {
      result = await engine.simulate({ bundleId: b.meta.bundleId, parameters: $state.snapshot(overrides), knockouts: Object.entries(kos).filter(([, v]) => v).map(([id]) => ({ target: 'protein', id })) })
    } catch (e) {
      err = (e as Error).message
    } finally {
      running = false
    }
  }

  const pairs = $derived.by(() => {
    if (!result) return []
    const sim = new Map(result.rows.filter((r) => r.state === S).map((r) => [r.time, r.value]))
    return base.filter((r) => r.state === S && r.pred !== null && sim.get(r.time) != null).map((r) => ({ time: r.time, baseline: r.pred!, engine: sim.get(r.time)!, delta: sim.get(r.time)! - r.pred! }))
  })
  // log-scale slider position <-> value inside [lower, upper]
  const toPos = (p: { lo: number; hi: number }, v: number) => (Math.log(v) - Math.log(p.lo)) / (Math.log(p.hi) - Math.log(p.lo))
  const fromPos = (p: { lo: number; hi: number }, x: number) => Math.exp(Math.log(p.lo) + x * (Math.log(p.hi) - Math.log(p.lo)))

  function exportScenario() {
    if (!b || !info) return
    const scenario = { bundle_id: b.meta.bundleId, engine: info.engine, engine_version: info.version, engine_commit: info.commit, parameters: $state.snapshot(overrides), knockouts: Object.keys(kos).filter((k) => kos[k]), created: new Date().toISOString() }
    download(`scenario_${b.meta.bundleId}.json`, JSON.stringify(scenario, null, 2), 'application/json')
    if (result) download(`scenario_${b.meta.bundleId}_result.csv`, toCsv(result.rows as unknown as Record<string, unknown>[]), 'text/csv')
  }
</script>

<div class="flag">Feature flag <code>?engine=mock</code>: Milestone 2 preview. PhosKinTime has no <code>pktengine</code> yet; this view talks to <code>scripts/mock-engine.mjs</code>, whose numbers are <b>not</b> model simulations. No SBML engine is offered (KNOWN_ISSUES N10 unresolved).</div>
<div class="row">
  <label>Engine URL (this machine only) <input bind:value={url} size="28" data-testid="engine-url" /></label>
  <button onclick={connect} data-testid="engine-connect">Connect</button>
</div>
{#if err}<div class="err">{err}</div>{/if}
{#if info}
  <div class="engine" data-testid="engine-info">
    <b>{info.engine}</b> {info.version} · commit <code>{info.commit}</code> · API {info.apiVersion ?? '?'} · {info.status}
    · ops: {info.capabilities.whatifOps.join(', ') || 'none'} · variants: {info.capabilities.modelVariants.join(', ')} · formats: {info.capabilities.outputFormats.join(', ')}
  </div>
  {#if verify}
    <div class="verify" class:ok={verify.reproduces} data-testid="engine-verify" data-reproduces={verify.reproduces}>
      /verify: {verify.reproduces ? '✔ engine reproduces this bundle' : '✖ engine does NOT reproduce this bundle'} (max |Δ| {verify.maxAbsDiff.toExponential(2)} over {verify.nCompared} values, tolerance {verify.tolerance}). {verify.note ?? ''}
    </div>
  {/if}
  {#if !b}<p>Open a bundle first.</p>{:else}
    <div class="row">
      <label>Protein <select value={protein} onchange={(e) => (protein = e.currentTarget.value)}>{#each [...new Set(base.map((r) => r.protein))] as p}<option value={p}>{p}</option>{/each}</select></label>
      <label>State <select value={S} onchange={(e) => (stateSel = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
      {#if can('knockout') && info.capabilities.knockoutTargets.includes('protein')}<label><input type="checkbox" bind:checked={kos[protein]} /> knock out {protein}</label>{/if}
      <button onclick={run} disabled={running || !info.capabilities.simulate} data-testid="engine-run">{running ? 'simulating…' : 'Simulate'}</button>
      <button onclick={() => { overrides = {}; kos = {} }}>reset</button>
      <button onclick={exportScenario}>export scenario</button>
    </div>
    {#if can('set_parameter')}
      {#each groups as g}
        <fieldset><legend>{b ? groupLabel(b, g) : g}</legend>
          {#each pParams.filter((p) => p.group === g) as p}
            {@const v = overrides[p.name] ?? p.value}
            <label class="slider">{b ? paramLabel(b, p.name) : p.name}
              <input type="range" min="0" max="1" step="0.001" value={toPos(p, v)} oninput={(e) => (overrides[p.name] = fromPos(p, +e.currentTarget.value))} />
              <code>{v.toPrecision(3)}</code> <span class="dim">[{p.lo}, {p.hi}] fit {p.value.toPrecision(3)}</span>
            </label>
          {/each}
        </fieldset>
      {/each}
    {/if}
    {#if result}
      <p class="label">Engine output from <b>{result.engine} {result.version}</b>: not a stored result of this bundle.</p>
      <div class="two">
        <Plot height={260} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: `${S} FC` }}>
          <DifferenceY data={pairs} x="time" y1="baseline" y2="engine" positiveFill="#d6604d" negativeFill="#4393c3" fillOpacity={0.4} />
          <Line data={pairs} x="time" y="baseline" stroke="#888" strokeDasharray="5 3" />
          <Line data={pairs} x="time" y="engine" stroke="var(--pkv-ink)" />
        </Plot>
        <Plot zoom="main" height={260} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Δ (engine − stored baseline)' }}>
          <Line data={pairs} x="time" y="delta" stroke="#d62728" />
          <Dot data={pairs} x="time" y="delta" fill="#d62728" r={2} />
        </Plot>
      </div>
      <p class="dim">y1 = stored best fit (grey dashed), y2 = engine scenario (black); red where the scenario is higher.</p>
    {/if}
  {/if}
{/if}

<style>
  .flag { background: var(--pkv-accent-soft); border: 1px solid var(--pkv-accent); padding: 6px 10px; border-radius: 4px; font-size: 0.85rem; margin: 8px 0; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 6px 0; font-size: 0.88rem; }
  .engine { background: var(--pkv-surface); border: 1px solid var(--pkv-border); padding: 6px 10px; font-size: 0.85rem; }
  .verify { background: var(--pkv-bad-bg); color: var(--pkv-bad-ink); padding: 4px 10px; margin: 4px 0; font-size: 0.85rem; } .verify.ok { background: var(--pkv-ok-bg); color: var(--pkv-ok-ink); }
  .err { background: var(--pkv-bad-bg); color: var(--pkv-bad-ink); padding: 6px; }
  fieldset { border: 1px solid #dde; margin: 6px 0; font-size: 0.82rem; }
  .slider { display: grid; grid-template-columns: 260px 220px 70px auto; gap: 6px; align-items: center; }
  .dim { color: var(--pkv-ink-2); font-size: 0.78rem; }
  .label { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); padding: 4px 8px; font-size: 0.85rem; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
