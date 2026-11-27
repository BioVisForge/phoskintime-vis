<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Line, RectY } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { histogram, symlogTicks } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  $effect(() => {
    bundle.table('steady_state').then((x) => {
      t = x
    })
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value'), D = t.columns.dydt_abs ? num(t, 'dydt_abs') : null
    return Array.from({ length: t.rows }, (_, i) => ({ protein: P[i]!, state: S[i]!, time: T[i], value: Number.isFinite(V[i]) ? V[i] : null, dydt: D && Number.isFinite(D[i]) ? D[i] : null }))
  })
  const sel = $derived(rows.filter((r) => r.protein === protein))
  const tmax = $derived(Math.max(...rows.map((r) => r.time)))
  const lastT = $derived(tmax)
  const dy = $derived(histogram(rows.filter((r) => r.time === lastT && r.dydt !== null).map((r) => Math.log10(Math.max(r.dydt!, 1e-300))), 100))
  $effect(() => {
    report.rows = rows
    report.notes = [`Per-protein dynamics until steady state (x is symlog with linthresh 10 when t > 100, as plot_steady_state_all). Right: histogram (100 bins) of log10 |dy/dt| at the last time point. PhosKinTime computes |dy/dt| with the legacy numba RHS, which differs from the JAX RHS used for fitting (KNOWN_ISSUES N10), so treat it as indicative.`]
  })
</script>

{#if !t}<Loading />{:else}
  <div class="two">
    <Plot height={240} grid x={{ type: tmax > 100 ? 'symlog' : 'linear', constant: 10, ...(tmax > 100 ? { ticks: symlogTicks(tmax) } : {}), label: 'Time (min)' }} y={{ label: 'Conc (a.u.)' }} color={{ legend: true }}>
      <Line data={sel} x="time" y="value" z="state" stroke="state" />
    </Plot>
    <Plot height={240} grid x={{ label: `log10 |dy/dt| at t = ${lastT}` }} y={{ label: 'states' }}>
      <RectY data={dy} x1="x1" x2="x2" y1={0} y2="count" fill="#888" />
    </Plot>
  </div>
{/if}
<style>.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }</style>
