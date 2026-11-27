<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Line, Dot } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { paramLabel, TIME_TICKS } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  $effect(() => {
    bundle.table('parameter_profiles').then((x) => {
      t = x
    })
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), N = str(t, 'parameter'), PV = num(t, 'parameter_value'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (P[i] === protein) out.push({ parameter: paramLabel(bundle, N[i]!), pv: PV[i], state: S[i], time: T[i], value: Number.isFinite(V[i]) ? V[i] : null })
    return out
  })
  $effect(() => {
    report.rows = rows
    report.notes = ['Model output of one state as one parameter is varied (colour = parameter value). PhosKinTime’s plot_profiles has no callers at the recorded commit and plots rates against time from a different input, so this is only a partial counterpart.']
  })
</script>

{#if !t}<Loading />{:else}
  <Plot zoom="main" height={260} grid fx={{ label: '' }} x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Model FC' }} color={{ legend: true, label: 'parameter value', scheme: 'viridis' }}>
    <Line data={rows} x="time" y="value" z="pv" fx="parameter" stroke="pv" />
    <Dot data={rows} x="time" y="value" fx="parameter" fill="pv" r={1.5} />
  </Plot>
{/if}
