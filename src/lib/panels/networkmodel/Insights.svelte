<script lang="ts">
  import { Plot, RectY, BarX } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { trajRows, histogram } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let W = $state.raw<import('../../model/types').NpyArray | null>(null)
  let layer = $state('')
  const wName = $derived(bundle.meta.files.find((f) => f.kind === 'array' && f.array?.name?.startsWith('matrix_'))?.array?.name ?? null)
  $effect(() => {
    Promise.all([bundle.table('trajectories'), wName ? bundle.array(wName) : Promise.resolve(null)]).then(([a, b]) => {
      t = a
      W = b
    })
  })
  // run_trajectory_feature_export: amplitude = max − min of the best-fit trajectory, top 30 per layer
  const amps = $derived.by(() => {
    if (!t) return []
    const by = new Map<string, { state: string; layer: string; v: number[] }>()
    for (const r of trajRows(t, { best: true })) {
      if (r.pred === null) continue
      const e = by.get(r.state) ?? by.set(r.state, { state: r.state, layer: r.layer, v: [] }).get(r.state)!
      e.v.push(r.pred)
    }
    return [...by.values()].map((e) => ({ state: e.state, layer: e.layer, amplitude: Math.max(...e.v) - Math.min(...e.v) }))
  })
  const layers = $derived([...new Set(amps.map((a) => a.layer))])
  const L = $derived(layers.includes(layer) ? layer : layers[0])
  const top = $derived(amps.filter((a) => a.layer === L).sort((a, b) => b.amplitude - a.amplitude).slice(0, 30))
  // run_network_diagnostics: in-degree per row (non-zeros) and out-degree per column of W
  const deg = $derived.by(() => {
    if (!W || W.shape.length !== 2) return null
    const [R, C] = W.shape
    const rowNz = new Array(R).fill(0), colNz = new Array(C).fill(0)
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (Number(W.data[W.fortranOrder ? j * R + i : i * C + j]) !== 0) { rowNz[i]++; colNz[j]++ }
    const bins = (n: number) => Math.min(30, Math.max(5, Math.floor(Math.sqrt(n))))
    return { rows: histogram(rowNz, bins(R)), cols: histogram(colNz, bins(C)) }
  })
  $effect(() => {
    report.rows = top
    report.notes = [`Network degree histograms of ${wName ?? 'the network matrix'} (non-zeros per row and per column) and the top 30 best-fit amplitudes (max − min) per layer, as Insights.run_network_diagnostics and run_trajectory_feature_export.`]
  })
</script>

{#if !t}<Loading />{:else}
  <div class="three">
    {#if deg}
      <Plot height={200} grid title="row in-degree (non-zeros per row)" x={{ label: 'in-degree' }} y={{ label: 'rows' }}><RectY data={deg.rows} x1="x1" x2="x2" y1={0} y2="count" fill="#74a9cf" stroke="white" /></Plot>
      <Plot height={200} grid title="column out-degree (non-zeros per column)" x={{ label: 'out-degree' }} y={{ label: 'columns' }}><RectY data={deg.cols} x1="x1" x2="x2" y1={0} y2="count" fill="#fd8d3c" stroke="white" /></Plot>
    {:else}<p>No network matrix in this bundle.</p>{/if}
  </div>
  <label>Layer <select value={L} onchange={(e) => (layer = e.currentTarget.value)}>{#each layers as l}<option value={l}>{l}</option>{/each}</select></label>
  <Plot height={Math.max(160, 14 * top.length + 50)} marginLeft={110} grid x={{ label: 'amplitude (max − min of predicted FC)' }} y={{ label: '', domain: top.map((a) => a.state) }}>
    <BarX data={top} x="amplitude" y="state" fill="#6a51a3" />
  </Plot>
{/if}
<style>.three { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }</style>
