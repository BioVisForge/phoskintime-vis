<script lang="ts">
  import { Plot, Line, Dot, normalizeParallelX } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { trajRows, proteins } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let protein = $state('')
  let mode = $state<'raw' | 'extent'>('raw')
  $effect(() => {
    bundle.table('trajectories').then((x) => {
      t = x
      protein = proteins(x)[0]
    })
  })
  // plot_parallel: one polyline per time point across the states (pandas parallel_coordinates, raw values)
  const rows = $derived(t ? trajRows(t, { protein, best: true }).filter((r) => r.pred !== null).map((r) => ({ state: r.state, time: r.time, value: r.pred as number, raw: r.pred as number })) : [])
  const plotted = $derived(mode === 'raw' ? { data: rows, x: 'value', y: 'state', z: 'time' } : normalizeParallelX({ data: rows, x: 'value', y: 'state', z: 'time' }, 'extent'))
  $effect(() => {
    report.rows = rows
    report.notes = ['Axes are horizontal here (one row per state); PhosKinTime draws them vertically. Segments are straight. “extent” rescales each state to its own min–max; tooltips show the raw value.']
  })
</script>

{#if !t}<Loading />{:else}
  <label>Protein <select bind:value={protein}>{#each proteins(t) as p}<option value={p}>{p}</option>{/each}</select></label>
  <label>Scale <select bind:value={mode}><option value="raw">raw values (as PhosKinTime)</option><option value="extent">per-state extent</option></select></label>
  <Plot height={Math.max(200, 50 * new Set(rows.map((r) => r.state)).size)} grid inset={10} x={{ label: mode === 'raw' ? 'Predicted fold change' : 'Normalised to state extent' }} y={{ label: 'State' }} color={{ legend: true, label: 'Time (min)', type: 'log' }}>
    <Line {...plotted as any} stroke={(d: any) => Math.max(d.time, 0.1)} strokeOpacity={0.6} />
    <Dot {...plotted as any} fill={(d: any) => Math.max(d.time, 0.1)} r={2.5} title={(d: any) => `${d.state} t=${d.time}: ${d.raw}`} />
  </Plot>
{/if}
