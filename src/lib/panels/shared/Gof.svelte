<script lang="ts">
  import { Plot, Dot, Line, RegressionY, Text, Brush, Rect, CustomMark } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { gofPoints, gofByLayer, protwiseOffsets, type GofPoint } from '../../derive/trajectories'
  import { layerLabel, fmt, trajRows, TIME_TICKS } from '../common'
  import Selection from './Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report, workflow }: PanelProps & { workflow: 'protwise' | 'networkmodel' } = $props()
  let t = $state.raw<Table | null>(null)
  let showReg = $state(false)
  let brush = $state({ enabled: false } as { enabled: boolean; x1?: number; x2?: number; y1?: number; y2?: number })
  $effect(() => {
    bundle.table('trajectories').then((x) => (t = x))
  })

  const pts = $derived.by(() => {
    if (!t) return [] as GofPoint[]
    const p = gofPoints(t)
    // protwise plot_gof works on the merged protein/psite rows (x1..x14)
    return workflow === 'protwise' ? p.filter((q) => q.layer !== 'rna') : p
  })
  const stats = $derived(gofByLayer(pts))
  const pw = $derived(t && workflow === 'protwise' ? protwiseOffsets(t) : null)
  const layers = $derived(Object.keys(stats.layers))
  const labelOf = (p: GofPoint) => (p.psite ? `${p.protein}|${p.psite}` : p.protein)

  function bandLines(lo: number, hi: number, d95: number, d99: number, facet?: string) {
    const L = (name: string, off: number) => [{ x: lo, y: lo + off, k: name, facet }, { x: hi, y: hi + off, k: name, facet }]
    return [...L('identity', 0), ...L('+95', d95), ...L('-95', -d95), ...L('+99', d99), ...L('-99', -d99)]
  }
  const overall = $derived(workflow === 'protwise' && pw ? { ...stats.overall, d95: pw.d95, d99: pw.d99 } : stats.overall)
  const flagged = $derived.by(() => {
    // networkmodel: up to 25 labels outside the 95 % band, most extreme first, each label once
    const out = pts.filter((p) => Math.abs(p.resid) >= overall.d95).sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid))
    const seen = new Set<string>()
    return out.filter((p) => (seen.has(labelOf(p)) ? false : (seen.add(labelOf(p)), true))).slice(0, 25).map((p) => ({ ...p, label: labelOf(p) }))
  })
  const facetLines = $derived(layers.flatMap((l) => bandLines(stats.layers[l].min, stats.layers[l].max, stats.layers[l].d95, stats.layers[l].d99, l)))
  const inB = (p: GofPoint) => brush.enabled && p.obs >= brush.x1! && p.obs <= brush.x2! && p.pred >= brush.y1! && p.pred <= brush.y2!
  const selected = $derived(pts.filter(inB))
  const selStates = $derived([...new Set(selected.map((p) => p.state))])
  const highlight = $derived.by(() => {
    if (!t || !selStates.length) return []
    const want = new Set(selStates.slice(0, 40))
    return trajRows(t, { best: true }).filter((r) => want.has(r.state))
  })
  $effect(() => {
    report.rows = pts.map((p) => ({ ...p, outside95: Math.abs(p.resid) >= overall.d95 }))
    report.notes = workflow === 'protwise'
      ? [`Bands: ±1.96 and ±2.576 × std of all observed values pooled over genes, sites and times (std = ${fmt(pw?.std ?? NaN, 4)}, ddof 0), as plot_gof computes them. That is the spread of the observations, not of the residuals.`]
      : ['σ = 1.4826·MAD of residuals (pred − obs); std when fewer than 10 residuals or MAD = 0; recomputed per layer. Bands ±1.959964σ and ±2.575829σ. R² = squared Pearson r (scipy linregress), as PhosKinTime reports it, not 1 − SSres/SStot. RMSE is about the identity line.']
  })
</script>

{#if !t}<Loading />{:else}
  <table class="stats" data-testid="gof-stats">
    <thead><tr><th>subset</th><th>n</th><th>R²</th><th>RMSE</th><th>σ</th><th>95 % band</th><th>99 % band</th></tr></thead>
    <tbody>
      {#each [['overall', overall], ...layers.map((l) => [layerLabel(bundle, l), stats.layers[l]])] as [name, s]}
        {@const x = s as typeof overall}
        <tr><td>{name}</td><td>{x.n}</td><td>{fmt(x.r2, 4)}</td><td>{fmt(x.rmse, 4)}</td><td>{workflow === 'protwise' && name === 'overall' ? `std(obs) ${fmt(pw?.std ?? NaN, 4)}` : fmt(x.sigma, 4)}</td><td>±{fmt(x.d95, 4)}</td><td>±{fmt(x.d99, 4)}</td></tr>
      {/each}
    </tbody>
  </table>
  <label><input type="checkbox" bind:checked={showReg} /> OLS regression line with 95 % confidence band (extra layer)</label>
  <div class="two">
    <div>
      <Plot height={380} grid inset={6} aspectRatio={1} title="Overall (brush to select points)" x={{ label: 'Observed' }} y={{ label: workflow === 'protwise' ? 'Fitted' : 'Predicted' }} color={{ legend: true }}>
        <Line data={bandLines(overall.min, overall.max, overall.d95, overall.d99)} x="x" y="y" z="k" stroke={(d: any) => (d.k === 'identity' ? '#555' : d.k.includes('95') ? '#d62728' : '#888')} strokeDasharray={(d: any) => (d.k === 'identity' ? 'none' : d.k.includes('95') ? '5 3' : '1 3')} />
        <Dot data={pts} x="obs" y="pred" fill="layer" r={2.5} opacity={0.55} stroke="black" strokeWidth={0.3} />
        <!-- P4: ring glyph for points beyond the 95 % band -->
        <CustomMark data={flagged} x="obs" y="pred">
          {#snippet mark({ record })}<circle cx={record.x} cy={record.y} r="6" fill="none" stroke="#d62728" stroke-width="1.5"><title>{record.datum.label}: residual {record.datum.resid.toFixed(3)}</title></circle>{/snippet}
        </CustomMark>
        <Text data={flagged} x="obs" y="pred" text="label" dy={-9} fontSize={8} />
        {#if showReg}<RegressionY data={pts} x="obs" y="pred" stroke="black" confidence={0.95} />{/if}
        {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
        <Brush bind:brush constrainToDomain stroke={false} />
      </Plot>
      <p class="legend">grey: identity · red dashed: 95 % band · grey dotted: 99 % band · red rings: outside 95 % (P4, up to 25 labelled)</p>
    </div>
    {#if workflow === 'networkmodel'}
      <Plot height={300} grid inset={6} fx={{ label: '' }} x={{ label: 'Observed' }} y={{ label: 'Predicted' }} color={{ legend: true }}>
        <Line data={facetLines} x="x" y="y" z="k" fx="facet" stroke={(d: any) => (d.k === 'identity' ? '#555' : d.k.includes('95') ? '#d62728' : '#888')} strokeDasharray={(d: any) => (d.k === 'identity' ? 'none' : d.k.includes('95') ? '5 3' : '1 3')} />
        <Dot data={pts} x="obs" y="pred" fx="layer" fill="layer" r={2} opacity={0.5} />
        {#if showReg}<RegressionY data={pts} x="obs" y="pred" fx="layer" stroke="black" confidence={0.95} />{/if}
      </Plot>
    {/if}
  </div>
  <Selection ids={selected.map((p) => `${labelOf(p)}@${p.time}`)} label="points in brush" name="gof_selection" />
  {#if highlight.length}
    <Plot height={240} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Best-fit FC of selected states' }} color={{ legend: true }}>
      <Line data={highlight} x="time" y="pred" z="state" stroke="state" strokeWidth={1.4} />
      <Dot data={highlight.filter((r) => r.obs !== null)} x="time" y="obs" stroke="state" r={2} />
    </Plot>
  {/if}
{/if}

<style>
  .two { display: grid; grid-template-columns: minmax(320px, 1fr) 1.4fr; gap: 8px; }
  .stats { font-size: 0.8rem; border-collapse: collapse; margin-bottom: 6px; }
  .stats td, .stats th { padding: 2px 8px; border-bottom: 1px solid #eee; text-align: right; }
  .stats td:first-child, .stats th:first-child { text-align: left; }
  .legend { font-size: 0.75rem; color: #555; margin: 0; }
</style>
