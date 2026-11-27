<script lang="ts">
  import { Plot, Line, Dot } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { paramLabel } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('profile_likelihood').then((x) => (t = x))
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const N = str(t, 'name'), G = num(t, 'grid_value'), D = num(t, 'delta'), SP = str(t, 'space'), ST = str(t, 'statistic')
    return Array.from({ length: t.rows }, (_, i) => ({ parameter: paramLabel(bundle, N[i]!), grid: G[i], delta: Number.isFinite(D[i]) ? D[i] : null, space: SP[i], statistic: ST[i] }))
  })
  const space = $derived([...new Set(rows.map((r) => r.space))].join(', '))
  const stat = $derived([...new Set(rows.map((r) => r.statistic))].join(', '))
  $effect(() => {
    report.rows = rows
    report.notes = [`x: grid in “${space}” and y: “${stat}”, as stated by the bundle. PhosKinTime’s profile grid is a linspace in raw softplus space and its delta is an MSE difference, not −2 log L (KNOWN_ISSUES N13), so no χ² threshold is drawn.`]
  })
</script>

{#if !t}<Loading />{:else}
  <Plot height={220} grid fx={{ label: '' }} x={{ label: `grid value (${space})` }} y={{ label: `Δ objective (${stat})` }}>
    <Line data={rows} x="grid" y="delta" fx="parameter" stroke="#d95f02" />
    <Dot data={rows} x="grid" y="delta" fx="parameter" symbol="times" stroke="#d95f02" r={3} />
  </Plot>
{/if}
