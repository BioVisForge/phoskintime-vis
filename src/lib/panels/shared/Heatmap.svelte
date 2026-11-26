<script lang="ts">
  import { Plot, Raster } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { trajRows } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let layer = $state('')
  let max = $state(60)
  $effect(() => {
    bundle.table('trajectories').then((x) => (t = x))
  })
  const all = $derived(t ? trajRows(t, { best: true }) : [])
  const layers = $derived([...new Set(all.map((r) => r.layer))])
  const L = $derived(layers.includes(layer) ? layer : layers[0])
  const times = $derived([...new Set(all.map((r) => r.time))].sort((a, b) => a - b))
  const states = $derived([...new Set(all.filter((r) => r.layer === L).map((r) => r.state))].slice(0, max))
  // dense regular grid: column = time index, row = state index; value = log2(pred)
  const cells = $derived.by(() => {
    const si = new Map(states.map((s, i) => [s, i]))
    const ti = new Map(times.map((x, i) => [x, i]))
    return all.filter((r) => r.layer === L && si.has(r.state) && r.pred !== null && r.pred > 0).map((r) => ({ col: ti.get(r.time)!, row: si.get(r.state)!, state: r.state, time: r.time, log2fc: Math.log2(r.pred!) }))
  })
  const lim = $derived(Math.max(1e-9, ...cells.map((c) => Math.abs(c.log2fc))))
  $effect(() => {
    report.rows = cells
    report.notes = ['log2 of the predicted fold change on the stored time × state grid. Each cell is one stored value: interpolate = "none" and no blur, so nothing between grid points is invented. Columns are time-point indices, so spacing is not proportional to time.']
  })
</script>

{#if !t}<Loading />{:else}
  <label>Layer <select value={L} onchange={(e) => (layer = e.currentTarget.value)}>{#each layers as l}<option value={l}>{l}</option>{/each}</select></label>
  <label>States shown <input type="number" min="5" max="400" bind:value={max} style="width:5em" /></label>
  <Plot height={Math.min(700, 10 * states.length + 80)} x={{ label: `Time-point index (0 = ${times[0]} … ${times.length - 1} = ${times.at(-1)} min)`, domain: [-0.5, times.length - 0.5] }} y={{ label: 'State index', domain: [states.length - 0.5, -0.5] }} color={{ type: 'diverging', scheme: 'rdbu', domain: [-lim, lim], legend: true, label: 'log2 FC', reverse: true }}>
    <Raster data={cells} x="col" y="row" fill="log2fc" interpolate="none" imageRendering="pixelated" x1={-0.5} x2={times.length - 0.5} y1={-0.5} y2={states.length - 0.5} width={times.length} height={states.length} />
  </Plot>
{/if}
