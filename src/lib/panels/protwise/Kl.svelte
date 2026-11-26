<script lang="ts">
  import { Plot, BarX, RuleX } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { klFromTrajectories } from '../../derive/trajectories'
  import { KL_THRESHOLD } from '../../transforms/kl'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('trajectories').then((x) => (t = x))
  })
  const k = $derived(t ? klFromTrajectories(t) : null)
  $effect(() => {
    if (!k) return
    report.rows = k.byGene
    const dropped = k.rows.reduce((s, r) => s + r.dropped, 0)
    report.notes = [`KL(observed ‖ estimated) per site with rows normalised by their sum, natural log (scipy.stats.entropy), averaged per gene; red where > ${KL_THRESHOLD}.` + (dropped ? ` ${dropped} null time points were skipped (pairwise complete); PhosKinTime's rows have no nulls.` : '')]
  })
</script>

{#if !k}<Loading />{:else}
  <Plot height={Math.max(140, 22 * k.byGene.length + 50)} marginLeft={90} grid x={{ label: 'KL divergence (nats)' }} y={{ label: 'Protein', domain: k.byGene.map((g) => g.gene) }} color={{ legend: true, domain: [`≤ ${KL_THRESHOLD}`, `> ${KL_THRESHOLD}`], range: ['dodgerblue', 'lightcoral'] }}>
    <BarX data={k.byGene} x="kl" y="gene" fill={(d: any) => (d.flagged ? `> ${KL_THRESHOLD}` : `≤ ${KL_THRESHOLD}`)} />
    <RuleX x={KL_THRESHOLD} stroke="#a33" strokeDasharray="4 3" />
  </Plot>
{/if}
