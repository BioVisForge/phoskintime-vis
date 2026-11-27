<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Line, Dot } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { trajRows, proteins, layerLabel } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? proteins(t) : []))
  $effect(() => {
    bundle.table('trajectories').then((x) => {
      t = x
    })
  })
  const rows = $derived(t ? trajRows(t, { protein, best: true }).map((r) => ({ ...r, panel: layerLabel(bundle, r.layer), series: r.psite ?? r.layer })) : [])
  $effect(() => {
    report.rows = rows
    report.notes = ['save_gene_timeseries_plots: three panels sharing y. Observations are lighter squares and predictions solid lines. Site colours here are stable across runs (PhosKinTime uses hash(psite) % 10, which changes between runs).']
  })
</script>

{#if !t}<Loading />{:else}
  <Plot zoom="main" height={260} grid fx={{ label: '', domain: bundle.meta.layers.length ? ['protein', 'rna', 'phospho'].map((l) => layerLabel(bundle, l)) : undefined }} x={{ label: 'Time (min)' }} y={{ label: 'FC' }} color={{ legend: true }}>
    <Line data={rows} x="time" y="obs" z="state" fx="panel" stroke="series" strokeOpacity={0.35} />
    <Dot data={rows.filter((r) => r.obs !== null)} x="time" y="obs" fx="panel" stroke="series" symbol="square" r={3} opacity={0.5} />
    <Line data={rows} x="time" y="pred" z="state" fx="panel" stroke="series" strokeWidth={2} />
  </Plot>
{/if}
