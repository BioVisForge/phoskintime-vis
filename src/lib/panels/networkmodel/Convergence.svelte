<script lang="ts">
  import { Plot, Line, RuleX } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { envelopes } from '../../transforms/envelope'
  import { app } from '../../ui/state.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('convergence').then((x) => (t = x))
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const R = str(t, 'run'), I = num(t, 'iteration'), O = num(t, 'objective')
    return Array.from({ length: t.rows }, (_, i) => ({ run: R[i]!, iteration: I[i], objective: Number.isFinite(O[i]) ? O[i] : null }))
  })
  const env = $derived(envelopes(rows.map(() => 'all'), rows.map((r) => r.iteration), rows.map((r) => r.objective ?? NaN)))
  $effect(() => {
    report.rows = env as unknown as Record<string, unknown>[]
    report.notes = ['Objective per iteration for every start (log y). P10: per-iteration best and worst across starts as min–max rules, grouped by the exact iteration. PhosKinTime’s process_convergence_history has no callers at the recorded commit and assumes three objective columns, so this follows its intent (log-scale best value per generation).']
  })
</script>

{#if !t}<Loading />{:else}
  <Plot height={280} grid x={{ label: 'Iteration' }} y={{ type: 'log', label: 'Objective (log)' }}>
    <RuleX data={env.filter((_, i) => i % 2 === 0)} x="time" y1="min" y2="max" stroke="#f0b4b4" strokeWidth={1} />
    <Line canvas={app.rawLines} data={rows} x="iteration" y="objective" z="run" stroke="#8aa0b8" strokeOpacity={0.6} strokeWidth={0.8} />
    <Line data={env} x="time" y="min" stroke="#b30000" strokeWidth={1.6} />
  </Plot>
  <p class="legend">grey: each start · red line: best across starts · pink rules: min–max across starts per iteration</p>
{/if}
<style>.legend { font-size: 0.75rem; color: #555; margin: 0; }</style>
