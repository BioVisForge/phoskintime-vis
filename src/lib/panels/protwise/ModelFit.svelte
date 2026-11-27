<script lang="ts">
  import { Plot, Line, Dot } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { trajRows, proteins, type TrajRow } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let protein = $state('')
  $effect(() => {
    bundle.table('trajectories').then((x) => {
      t = x
      protein = proteins(x)[0]
    })
  })
  const rows = $derived(t ? trajRows(t, { protein, best: true }) : [])
  // plot_model_fit: cutoff_idx = 8 on the protein time grid (plotting.py:220). RNA observations are
  // split at their own index 3, which falls on the same 16/30 min boundary with the shipped grids.
  const cut = $derived.by(() => {
    const grid = [...new Set(rows.filter((r) => r.layer !== 'rna').map((r) => r.time))].sort((a, b) => a - b)
    return grid.length > 8 ? grid[8] : Infinity
  })
  const parts = $derived([
    { name: `t < ${cut} min (indices 0–7)`, rows: rows.filter((r) => r.time < cut) },
    { name: `t ≥ ${cut} min (index 8 on)`, rows: rows.filter((r) => r.time >= cut) },
  ])
  // sharey=True as in plot_model_fit (plotting.py:221)
  const ydom = $derived.by(() => {
    const v = rows.flatMap((r) => [r.obs, r.pred]).filter((x): x is number => x !== null)
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1]
  })
  $effect(() => {
    report.rows = rows as unknown as Record<string, unknown>[]
  })
</script>

{#if !t}<Loading />{:else}
  <label>Protein <select bind:value={protein}>{#each proteins(t) as p}<option value={p}>{p}</option>{/each}</select></label>
  <div class="two">
    {#each parts as part, i}
      <Plot height={300} grid x={{ label: `Time (min), ${part.name}` }} y={{ label: 'Fold change: model solid, data dashed', domain: ydom }} color={{ legend: i === 1 }}>
        <Line data={part.rows as TrajRow[]} x="time" y="pred" z="state" stroke="state" strokeWidth={1.4} />
        <Line data={part.rows as TrajRow[]} x="time" y="obs" z="state" stroke="state" strokeDasharray="4 3" strokeWidth={0.8} />
        <Dot data={part.rows.filter((r) => r.obs !== null) as TrajRow[]} x="time" y="obs" stroke="state" symbol="square" r={3} />
      </Plot>
    {/each}
  </div>
{/if}

<style>.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } label { font-size: 0.85rem; }</style>
