<script lang="ts">
  import { Plot, Line, Dot, DifferenceY, BarX, RuleX, RegressionY, BoxY, Raster, CustomMark } from 'svelteplot'
  import { app } from './state.svelte'
  import { compareRuns, type Comparison } from '../derive/compare'
  import { sortDeltas } from '../transforms/compare'
  import { trajRows, layerLabel, paramLabel, fmt, TIME_TICKS, type TrajRow } from '../panels/common'
  import type { LoadedBundle } from '../model/bundle'
  import Section from '../compare/Section.svelte'
  import { deltasCsv, reportHtml } from '../compare/report'
  import { download } from '../export/figure'

  let cmp = $state.raw<Comparison | null>(null)
  let error = $state<string | null>(null)
  let busy = $state(false)
  let state_ = $state('')
  let layer = $state('')
  let topN = $state(40)
  let trajA = $state.raw<TrajRow[]>([])
  let trajB = $state.raw<TrajRow[]>([])
  let others = $state.raw<{ label: string; rows: TrajRow[] }[]>([])
  let root: HTMLElement | undefined = $state()
  const A = $derived(app.byId(app.compareA))
  const B = $derived(app.byId(app.compareB))

  $effect(() => {
    const a = A, b = B
    cmp = null
    error = null
    if (!a || !b || a === b) return
    busy = true
    const extra = app.bundles.filter((x) => x !== a && x !== b && x.hasTable('trajectories'))
    Promise.all([compareRuns(a, b), a.table('trajectories'), b.table('trajectories'), ...extra.map((x) => x.table('trajectories'))])
      .then(([c, ta, tb, ...te]) => {
        cmp = c
        trajA = trajRows(ta, { best: true })
        trajB = trajRows(tb, { best: true })
        others = te.map((t, i) => ({ label: extra[i].label, rows: trajRows(t, { best: true }) }))
        ;(window as any).__compareReady = performance.now()
      })
      .catch((e) => (error = (e as Error).message))
      .finally(() => (busy = false))
  })

  const states = $derived(cmp ? [...new Set(cmp.traj.pairs.map((p) => p.state))] : [])
  // default: the state with the largest |Δ|
  const maxState = $derived(cmp ? [...cmp.traj.pairs].sort((x, y) => Math.abs(y.delta || 0) - Math.abs(x.delta || 0))[0]?.state ?? states[0] : '')
  const S = $derived(states.includes(state_) ? state_ : maxState)
  const layers = $derived(cmp ? [...new Set(cmp.traj.pairs.map((p) => p.layer))] : [])
  const L = $derived(layers.includes(layer) ? layer : layers[0])
  const overlay = $derived(cmp ? cmp.traj.pairs.filter((p) => p.state === S).sort((x, y) => x.time - y.time) : [])
  const obs = $derived(trajA.filter((r) => r.state === S && r.obs !== null))
  const otherLines = $derived(others.flatMap((o) => o.rows.filter((r) => r.state === S).map((r) => ({ ...r, run: o.label }))))
  const layerDeltas = $derived(cmp ? cmp.traj.pairs.filter((p) => p.layer === L) : [])
  const times = $derived([...new Set(layerDeltas.map((p) => p.time))].sort((a, b) => a - b))
  const lstates = $derived([...new Set(layerDeltas.map((p) => p.state))])
  const cells = $derived.by(() => {
    const si = new Map(lstates.map((s, i) => [s, i]))
    const ti = new Map(times.map((t, i) => [t, i]))
    return layerDeltas.filter((p) => Number.isFinite(p.delta)).map((p) => ({ col: ti.get(p.time)!, row: si.get(p.state)!, state: p.state, time: p.time, delta: p.delta }))
  })
  const lim = $derived(Math.max(1e-12, ...cells.map((c) => Math.abs(c.delta))))
  const sorted = $derived(cmp ? sortDeltas(cmp.params.pairs) : [])
  const topParams = $derived(sorted.slice(0, topN).map((p) => ({ ...p, label: A ? paramLabel(A, p.name) : p.name })))
  const logPairs = $derived(sorted.filter((p) => p.a > 0 && p.b > 0).map((p) => ({ ...p, group: p.group ?? '(none)', la: Math.log10(p.a), lb: Math.log10(p.b) })))
  const byGroup = $derived(sorted.filter((p) => p.log2ratio !== null).map((p) => ({ group: p.group ?? '(none)', log2ratio: p.log2ratio! })))
  const gofRows = $derived.by(() => {
    if (!cmp) return []
    const ls = ['overall', ...new Set([...Object.keys(cmp.gof.a.layers), ...Object.keys(cmp.gof.b.layers)])]
    return ls.map((l) => {
      const a = l === 'overall' ? cmp!.gof.a.overall : cmp!.gof.a.layers[l]
      const b = l === 'overall' ? cmp!.gof.b.overall : cmp!.gof.b.layers[l]
      return { subset: l === 'overall' ? 'overall' : A ? layerLabel(A, l) : l, n_a: a?.n, n_b: b?.n, r2_a: a?.r2, r2_b: b?.r2, d_r2: b && a ? b.r2 - a.r2 : NaN, rmse_a: a?.rmse, rmse_b: b?.rmse, d_rmse: b && a ? b.rmse - a.rmse : NaN, sigma_a: a?.sigma, sigma_b: b?.sigma }
    })
  })
  const gofLong = $derived(gofRows.flatMap((g) => [{ subset: g.subset, run: 'A', rmse: g.rmse_a ?? NaN }, { subset: g.subset, run: 'B', rmse: g.rmse_b ?? NaN }]))
  const short = (b: LoadedBundle | undefined) => (b ? `${b.label} (${b.meta.gitCommit.slice(0, 7)})` : '')

  function exportReport() {
    if (!cmp || !root) return
    download(`comparison_${cmp.provenance.a.bundleId}_vs_${cmp.provenance.b.bundleId}.html`, reportHtml(cmp, root), 'text/html')
    download(`comparison_${cmp.provenance.a.bundleId}_vs_${cmp.provenance.b.bundleId}_deltas.csv`, deltasCsv(cmp), 'text/csv')
  }
</script>

<div class="pick">
  {#if app.bundles.length < 2}
    <p data-testid="compare-need-two">Open at least two bundles to compare runs (for example a run before and after a PhosKinTime fix).</p>
  {:else}
    <label>A (before) <select data-testid="compare-a" value={app.compareA} onchange={(e) => (app.compareA = e.currentTarget.value)}>{#each app.bundles as b}<option value={b.meta.bundleId}>{b.label} · {b.meta.bundleId}</option>{/each}</select></label>
    <label>B (after) <select data-testid="compare-b" value={app.compareB} onchange={(e) => (app.compareB = e.currentTarget.value)}>{#each app.bundles as b}<option value={b.meta.bundleId}>{b.label} · {b.meta.bundleId}</option>{/each}</select></label>
    <button onclick={() => ([app.compareA, app.compareB] = [app.compareB, app.compareA])}>swap</button>
    {#if cmp}<button class="primary" data-testid="export-report" onclick={exportReport}>Export comparison report (HTML + CSV)</button>{/if}
    {#if busy}<span class="dim">comparing…</span>{/if}
  {/if}
</div>
{#if error}<div class="err">{error}</div>{/if}
{#if A && B && A === B}<p>Choose two different bundles.</p>{/if}

{#if cmp && A && B}
  <div bind:this={root} data-testid="compare-ready">
    <Section id="provenance" title="Provenance and compatibility" patterns={['P4']} rows={[{ run: 'A', ...cmp.provenance.a }, { run: 'B', ...cmp.provenance.b }]}>
      <table class="prov">
        <thead><tr><th></th><th>A (before)</th><th>B (after)</th></tr></thead>
        <tbody>
          <tr><th>bundle</th><td>{cmp.provenance.a.label} <code>{cmp.provenance.a.bundleId}</code></td><td>{cmp.provenance.b.label} <code>{cmp.provenance.b.bundleId}</code></td></tr>
          <tr><th>sha256</th><td class="st-{A.verifyState}">{A.verifyState}</td><td class="st-{B.verifyState}">{B.verifyState}</td></tr>
          <tr><th>PhosKinTime</th><td>{cmp.provenance.a.version}</td><td>{cmp.provenance.b.version}</td></tr>
          <tr><th>commit</th><td><code>{cmp.provenance.a.commit.slice(0, 10)}</code></td><td><code>{cmp.provenance.b.commit.slice(0, 10)}</code> {cmp.provenance.sameCommit ? '(same)' : ''}</td></tr>
          <tr><th>config sha256</th><td><code>{cmp.provenance.a.config.slice(0, 12)}</code></td><td><code>{cmp.provenance.b.config.slice(0, 12)}</code> <b class:diff={!cmp.provenance.sameConfig}>{cmp.provenance.sameConfig ? 'same' : 'differs'}</b></td></tr>
          <tr><th>model</th><td>{A.meta.modelId} / {A.meta.modelVariant}</td><td>{B.meta.modelId} / {B.meta.modelVariant}</td></tr>
          <tr><th>fold-change baseline</th><td>{A.meta.layers.map((l) => `${l.id}: t=${l.foldChangeBaseline?.time ?? '?'}`).join(', ')}</td><td>{B.meta.layers.map((l) => `${l.id}: t=${l.foldChangeBaseline?.time ?? '?'}${l.foldChangeBaseline?.note ? ` (${l.foldChangeBaseline.note})` : ''}`).join(', ')}</td></tr>
          <tr><th>parameters</th><td colspan="2" data-testid="param-alignment" data-mode={cmp.params.mode}><b>{cmp.params.mode}</b>: {cmp.params.reason} {cmp.params.pairs.length} paired; only in A: {cmp.params.onlyA.join(', ') || 'none'}; only in B: {cmp.params.onlyB.join(', ') || 'none'}.</td></tr>
          <tr><th>states</th><td colspan="2">{cmp.statesAligned ? 'Same state_order_sha256.' : 'state_order_sha256 differs: paired by state name.'} Only in A: {cmp.traj.onlyA.join(', ') || 'none'}; only in B: {cmp.traj.onlyB.join(', ') || 'none'}.</td></tr>
        </tbody>
      </table>
      {#if cmp.issues.available}
        <div class="issues" data-testid="issue-diff">
          <span>Known issues open in A only (fixed by B?): {#each cmp.issues.onlyA as i}<span class="glyph fixed">✓ {i}</span>{:else}none{/each}</span>
          <span>open in B only: {#each cmp.issues.onlyB as i}<span class="glyph new">! {i}</span>{:else}none{/each}</span>
          <span>open in both: {#each cmp.issues.both as i}<span class="glyph open">● {i}</span>{:else}none{/each}</span>
        </div>
        <!-- P4: per-run issue glyphs -->
        <Plot height={110} marginLeft={60} x={{ type: 'band', label: 'KNOWN_ISSUES id', domain: [...new Set([...cmp.issues.onlyA, ...cmp.issues.both, ...cmp.issues.onlyB])] }} y={{ type: 'band', domain: ['A', 'B'], label: '' }}>
          <CustomMark data={[...cmp.issues.onlyA.map((i) => ({ id: i, run: 'A' })), ...cmp.issues.both.flatMap((i) => [{ id: i, run: 'A' }, { id: i, run: 'B' }]), ...cmp.issues.onlyB.map((i) => ({ id: i, run: 'B' }))]} x="id" y="run">
            {#snippet mark({ record })}<g transform={`translate(${record.x}, ${record.y})`}><path d="M0,-7L7,6L-7,6Z" fill="#e8a400" stroke="#7a5600" /><title>{record.datum.id} open when run {record.datum.run} was produced</title></g>{/snippet}
          </CustomMark>
        </Plot>
        <p class="dim">Triangle: issue open at the producing commit. An issue open in A but not in B was probably fixed between the runs.</p>
      {:else}
        <p class="dim">At least one bundle does not record known_issues_open.</p>
      {/if}
    </Section>

    <Section id="gof" title="Goodness of fit per layer, side by side" rows={gofRows} note="Same definitions as the GOF panel (robust σ, R² = squared Pearson r, RMSE about identity), computed on each run's best fit.">
      <table class="prov" data-testid="gof-compare">
        <thead><tr><th>subset</th><th>n A</th><th>n B</th><th>R² A</th><th>R² B</th><th>ΔR²</th><th>RMSE A</th><th>RMSE B</th><th>ΔRMSE</th></tr></thead>
        <tbody>{#each gofRows as g}<tr><td>{g.subset}</td><td>{g.n_a}</td><td>{g.n_b}</td><td>{fmt(g.r2_a ?? NaN, 4)}</td><td>{fmt(g.r2_b ?? NaN, 4)}</td><td class:neg={g.d_r2 < 0} class:pos={g.d_r2 > 0}>{fmt(g.d_r2, 4)}</td><td>{fmt(g.rmse_a ?? NaN, 4)}</td><td>{fmt(g.rmse_b ?? NaN, 4)}</td><td class:neg={g.d_rmse > 0} class:pos={g.d_rmse < 0}>{fmt(g.d_rmse, 4)}</td></tr>{/each}</tbody>
      </table>
      <Plot height={160} marginLeft={100} grid x={{ label: 'RMSE (best fit)' }} y={{ label: '', domain: gofRows.map((g) => g.subset) }} color={{ legend: true, domain: ['A', 'B'], range: ['#9aa4b5', '#1f4e8c'] }}>
        <Dot data={gofLong} x="rmse" y="subset" fill="run" r={5} />
      </Plot>
      {#if cmp.metrics.length}
        <table class="prov small">
          <thead><tr><th>metric</th><th>layer</th><th>protein</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
          <tbody>{#each cmp.metrics.filter((m) => !m.protein) as m}<tr><td>{m.metric}</td><td>{m.layer ?? '—'}</td><td>{m.protein ?? '—'}</td><td>{fmt(m.a, 4)}</td><td>{fmt(m.b, 4)}</td><td>{fmt(m.delta, 4)}</td></tr>{/each}</tbody>
        </table>
      {/if}
    </Section>

    <Section id="overlay" title="Trajectory overlay, A vs B" patterns={['P5', 'P6']} rows={overlay} note={`y1 = A (grey), y2 = B (black). Red where B > A, blue where B < A. Both are best-fit model series on the same time grid. Observations (orange) are points only. Other open runs are thin coloured lines. Default state: the one with the largest |B − A|.`}>
      <label>State <select data-testid="compare-state" value={S} onchange={(e) => (state_ = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
      <Plot height={300} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Predicted FC' }} color={{ legend: others.length > 0 }}>
        <DifferenceY data={overlay} x="time" y1="a" y2="b" positiveFill="#d6604d" negativeFill="#4393c3" fillOpacity={0.4} />
        {#if otherLines.length}<Line data={otherLines} x="time" y="pred" z="run" stroke="run" strokeWidth={1} />{/if}
        <Line data={overlay} x="time" y="a" stroke="#888" strokeWidth={1.6} strokeDasharray="5 3" />
        <Line data={overlay} x="time" y="b" stroke="black" strokeWidth={1.8} />
        <Dot data={obs} x="time" y="obs" fill="#e6550d" r={3} />
      </Plot>
    </Section>

    <Section id="delta-lines" title="Per-state difference over time (B − A)" patterns={['P6']} rows={layerDeltas}>
      <label>Layer <select value={L} onchange={(e) => (layer = e.currentTarget.value)}>{#each layers as l}<option value={l}>{A ? layerLabel(A, l) : l}</option>{/each}</select></label>
      <Plot height={260} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Δ predicted FC (B − A)' }}>
        <Line canvas={app.rawLines} data={layerDeltas.filter((p) => p.state !== S)} x="time" y="delta" z="state" stroke="#9aa3ad" strokeOpacity={0.35} strokeWidth={0.7} />
        <Line data={layerDeltas.filter((p) => p.state === S)} x="time" y="delta" stroke="#d62728" strokeWidth={2} />
      </Plot>
    </Section>

    <Section id="delta-raster" title="Δ heatmap, state × time (B − A)" patterns={['P8']} rows={cells} note="Diverging scale centred at 0. Each cell is one stored grid value: no interpolation, no blur. Columns are time-point indices.">
      <Plot height={Math.min(640, 3 * lstates.length + 80)} x={{ label: `Time-point index (0 = ${times[0]} … ${times.length - 1} = ${times.at(-1)} min)`, domain: [-0.5, times.length - 0.5] }} y={{ label: `State index (${lstates.length} states)`, domain: [lstates.length - 0.5, -0.5] }} color={{ type: 'diverging', scheme: 'rdbu', domain: [-lim, lim], legend: true, label: 'Δ FC (B − A)', reverse: true }}>
        <Raster data={cells} x="col" y="row" fill="delta" interpolate="none" imageRendering="pixelated" x1={-0.5} x2={times.length - 0.5} y1={-0.5} y2={lstates.length - 0.5} width={times.length} height={lstates.length} />
      </Plot>
    </Section>

    <Section id="params" title="Parameter changes" patterns={['P9', 'P2']} rows={sorted as unknown as Record<string, unknown>[]} note="Sorted by |log2(B/A)|. Labels and groups come from the manifest of A (raw names where a label is missing). The scatter has the identity line and an OLS line (95 % band) on log10 values.">
      <label>Show top <input type="number" min="5" max="200" bind:value={topN} style="width:5em" /></label>
      <div class="two">
        <Plot height={Math.max(200, 14 * topParams.length + 60)} marginLeft={230} grid x={{ label: 'log2(B / A)' }} y={{ label: '', domain: topParams.map((p) => p.label) }}>
          <BarX data={topParams.filter((p) => p.log2ratio !== null)} x="log2ratio" y="label" fill={(d: any) => (d.log2ratio > 0 ? '#d6604d' : '#4393c3')} />
          <RuleX x={0} stroke="black" />
        </Plot>
        <div>
          <Plot height={300} grid inset={6} x={{ label: 'log10 A value' }} y={{ label: 'log10 B value' }} color={{ legend: true }}>
            <Line data={(() => { const v = logPairs.flatMap((p) => [p.la, p.lb]); return [{ x: Math.min(...v), y: Math.min(...v) }, { x: Math.max(...v), y: Math.max(...v) }] })()} x="x" y="y" stroke="#666" strokeDasharray="4 3" />
            <Dot data={logPairs} x="la" y="lb" r={2.5} fill="group" opacity={0.7} title={(d: any) => `${d.name}: ${d.a.toPrecision(4)} → ${d.b.toPrecision(4)}`} />
            <RegressionY data={logPairs} x="la" y="lb" stroke="black" confidence={0.95} />
          </Plot>
          <Plot height={200} grid x={{ type: 'band', label: 'group' }} y={{ label: 'log2(B / A)' }}>
            <BoxY data={byGroup} x="group" y="log2ratio" fill="#c6d9ec" tickMedian={{ stroke: 'black', strokeWidth: 2 }} />
          </Plot>
          <p class="dim">Box: Tukey 1.5 × IQR whiskers, spread of the parameter change within each group.</p>
        </div>
      </div>
    </Section>
  </div>
{/if}

<style>
  .pick { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 10px 0; font-size: 0.9rem; }
  .primary { background: #1d2a44; color: #fff; }
  .prov { border-collapse: collapse; font-size: 0.82rem; margin: 4px 0 8px; }
  .prov th, .prov td { border-bottom: 1px solid #eee; padding: 2px 8px; text-align: left; }
  .small { font-size: 0.76rem; }
  .diff { color: #b35c00; }
  .neg { color: #b00; } .pos { color: #1a7f37; }
  .issues { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; }
  .glyph { padding: 0 6px; border-radius: 8px; margin: 0 2px; }
  .fixed { background: #d8f2df; } .new { background: #fbd5d5; } .open { background: #fff3cd; }
  .dim { color: #666; font-size: 0.8rem; }
  .err { background: #fdecec; padding: 6px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .st-verified { color: #1a7f37; } .st-mismatch, .st-error { color: #b00; }
</style>
