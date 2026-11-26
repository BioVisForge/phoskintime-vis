<script lang="ts">
  import { Plot, RectY } from '../../plot'
  import type { PanelProps } from '../types'
  import { parameterValues } from '../../derive/compare'
  import { groupLabel, histogram } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let params = $state.raw<Awaited<ReturnType<typeof parameterValues>> | null>(null)
  $effect(() => {
    parameterValues(bundle).then((p) => (params = p))
  })
  // Insights._hist: bins = min(30, max(5, int(sqrt(n)))), one figure per parameter group
  const groups = $derived(params ? [...new Set(params.map((p) => p.group ?? null))] : [])
  const hists = $derived(
    groups.map((g) => {
      const v = params!.filter((p) => (p.group ?? null) === g).map((p) => p.value)
      const bins = Math.min(30, Math.max(5, Math.floor(Math.sqrt(v.length))))
      return { group: g, n: v.length, unit: bundle.meta.parameterGroups.find((x) => x.id === g)?.unit ?? null, h: histogram(v, bins) }
    }),
  )
  $effect(() => {
    report.rows = hists.flatMap((h) => h.h.map((b) => ({ group: h.group, ...b })))
    report.notes = ['Best-fit values per parameter group, as Insights.run_parameter_diagnostics draws them (bins = min(30, max(5, ⌊√n⌋))). Group names, labels and units come from the manifest; missing labels show the raw group id.']
  })
</script>

{#if !params}<Loading />{:else}
  <div class="grid">
    {#each hists as h}
      <Plot height={180} width={300} grid title={`${groupLabel(bundle, h.group)} (n=${h.n})`} x={{ label: `value${h.unit ? ` (${h.unit})` : ' (unit not given)'}` }} y={{ label: 'count' }}>
        <RectY data={h.h} x1="x1" x2="x2" y1={0} y2="count" fill="#6baed6" stroke="white" />
      </Plot>
    {/each}
  </div>
{/if}
<style>.grid { display: flex; flex-wrap: wrap; gap: 6px; }</style>
