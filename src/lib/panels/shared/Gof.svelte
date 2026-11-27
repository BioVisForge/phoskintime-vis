<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Dot, Line, RegressionY, Text, Brush, Rect, CustomMark } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { gofPoints, gofByLayer, protwiseOffsets, type GofPoint } from '../../derive/trajectories'
  import { layerLabel, fmt, trajRows, TIME_TICKS, CANVAS_MIN, BRUSH_SETTLE_MS } from '../common'
  import Selection from './Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report, workflow }: PanelProps & { workflow: 'protwise' | 'networkmodel' } = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let showReg = $state(ps.get('showReg', false))
  $effect(() => ps.set('showReg', showReg))
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
  // The brush rectangle follows the pointer; the selection (and its trajectories plot) follows
  // when the pointer pauses for BRUSH_SETTLE_MS, so brushing stays at the frame rate.
  let settled = $state.raw<typeof brush>({ enabled: false })
  $effect(() => {
    const b = { ...brush }
    if (!b.enabled) {
      settled = b
      return
    }
    const id = setTimeout(() => (settled = b), BRUSH_SETTLE_MS)
    return () => clearTimeout(id)
  })
  // the brush bounds are read once per update, not once per point
  const selected = $derived.by(() => {
    if (!settled.enabled) return []
    const { x1, x2, y1, y2 } = settled as Required<typeof brush>
    return pts.filter((p) => p.obs >= x1 && p.obs <= x2 && p.pred >= y1 && p.pred <= y2)
  })
  const selStates = $derived([...new Set(selected.map((p) => p.state))])
  // best-fit rows built once per table; each brush move only filters them
  const bestTraj = $derived(t ? trajRows(t, { best: true }) : [])
  const highlight = $derived.by(() => {
    if (!selStates.length) return []
    const want = new Set(selStates.slice(0, 40))
    return bestTraj.filter((r) => want.has(r.state))
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
  <p class="hint" data-export-skip>Brush the overall plot to select points and see their trajectories. Ctrl/⌘ + wheel zooms; “pan” drags the view.</p>
  <div class="two">
    <div>
      <Plot zoom="brush" height={380} grid inset={6} aspectRatio={1} title="Overall" x={{ label: 'Observed' }} y={{ label: workflow === 'protwise' ? 'Fitted' : 'Predicted' }} color={{ legend: true }}>
        <Line data={bandLines(overall.min, overall.max, overall.d95, overall.d99)} x="x" y="y" z="k" stroke={(d: any) => (d.k === 'identity' ? '#555' : d.k.includes('95') ? '#d62728' : '#888')} strokeDasharray={(d: any) => (d.k === 'identity' ? 'none' : d.k.includes('95') ? '5 3' : '1 3')} />
        <Dot canvas={pts.length > CANVAS_MIN} data={pts} x="obs" y="pred" fill="layer" r={2.5} opacity={0.55} stroke="var(--pkv-ink)" strokeWidth={0.3} />
        <!-- P4: ring glyph for points beyond the 95 % band -->
        <CustomMark glyph="ring" data={flagged} x="obs" y="pred">
          {#snippet mark({ record }: any)}<circle cx={record.x} cy={record.y} r="6" fill="none" stroke="#d62728" stroke-width="1.5"><title>{record.datum.label}: residual {record.datum.resid.toFixed(3)}</title></circle>{/snippet}
        </CustomMark>
        <!-- labels in the right half end at their point, so they stay inside the plot -->
        <Text data={flagged} x="obs" y="pred" text="label" dy={-9} fontSize={8} textAnchor={(d: any) => (d.obs > (overall.min + overall.max) / 2 ? 'end' : 'start')} />
        {#if showReg}<RegressionY data={pts} x="obs" y="pred" stroke="var(--pkv-ink)" confidence={0.95} />{/if}
        {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
        <Brush bind:brush constrainToDomain stroke={false} />
      </Plot>
      <p class="legend">grey: identity · red dashed: 95 % band · grey dotted: 99 % band · red rings: outside 95 % (P4, up to 25 labelled)</p>
    </div>
    {#if workflow === 'networkmodel'}
      <Plot height={300} grid inset={6} fx={{ label: '' }} x={{ label: 'Observed' }} y={{ label: 'Predicted' }} color={{ legend: true }}>
        <Line data={facetLines} x="x" y="y" z="k" fx="facet" stroke={(d: any) => (d.k === 'identity' ? '#555' : d.k.includes('95') ? '#d62728' : '#888')} strokeDasharray={(d: any) => (d.k === 'identity' ? 'none' : d.k.includes('95') ? '5 3' : '1 3')} />
        <Dot canvas={pts.length > CANVAS_MIN} data={pts} x="obs" y="pred" fx="layer" fill="layer" r={2} opacity={0.5} />
        {#if showReg}<RegressionY data={pts} x="obs" y="pred" fx="layer" stroke="var(--pkv-ink)" confidence={0.95} />{/if}
      </Plot>
    {/if}
  </div>
  <Selection ids={(limit?: number) => (limit === undefined ? selected : selected.slice(0, limit)).map((p) => `${labelOf(p)}@${p.time}`)} count={selected.length} label="points in brush" name="gof_selection" />
  {#if highlight.length}
    <Plot height={240} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Best-fit FC of selected states' }} color={{ legend: true }}>
      <Line data={highlight} x="time" y="pred" z="state" stroke="state" strokeWidth={1.4} />
      <Dot canvas data={highlight.filter((r) => r.obs !== null)} x="time" y="obs" stroke="state" r={2} />
    </Plot>
  {/if}
{/if}

<style>
  .two { display: grid; grid-template-columns: minmax(320px, 1fr) 1.4fr; gap: 8px; }
  .stats { font-size: 0.8rem; border-collapse: collapse; margin-bottom: 6px; }
  .stats td, .stats th { padding: 2px 0.45em; border-bottom: 1px solid #eee; text-align: right; }
  .stats td:first-child, .stats th:first-child { text-align: left; }
  .legend { font-size: 0.75rem; color: var(--pkv-ink-2); margin: 0; }
  .hint { font-size: 0.78rem; color: var(--pkv-ink-2); margin: 2px 0; }
</style>
