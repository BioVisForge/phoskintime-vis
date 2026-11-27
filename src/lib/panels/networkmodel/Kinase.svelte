<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Line } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let overlay = $state(ps.get('overlay', false))
  $effect(() => ps.set('overlay', overlay))
  $effect(() => {
    bundle.table('kinase_activity').then((x) => (t = x))
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const K = str(t, 'kinase'), T = num(t, 'time'), V = num(t, 'value'), R = str(t, 'representation')
    return Array.from({ length: t.rows }, (_, i) => ({ kinase: K[i]!, time: T[i], value: Number.isFinite(V[i]) ? V[i] : null, rep: R[i]! }))
  })
  const reps = $derived(new Set(rows.map((r) => r.rep)))
  const hasStep = $derived(reps.has('rhs_step'))
  const main = $derived(hasStep ? 'rhs_step' : 'export_linear')
  // export_kinase_activities: top 10 kinases by "AUC" = plain sum of values (not a trapezoid)
  const top = $derived.by(() => {
    const s = new Map<string, number>()
    for (const r of rows) if (r.rep === main && r.value !== null) s.set(r.kinase, (s.get(r.kinase) ?? 0) + r.value)
    return [...s.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
  })
  const shown = $derived(rows.filter((r) => top.includes(r.kinase) && (r.rep === main || (overlay && r.rep === 'export_linear'))))
  $effect(() => {
    report.rows = shown
    report.notes = hasStep
      ? ['Drawn as the RHS uses it: a right-continuous step on the kinase grid (backend.py:293-299, searchsorted(side="right") − 1, clamped to the first and last value). Toggle to overlay the linearly interpolated export (dashed), which differs between knots (KNOWN_ISSUES N17).']
      : [`This bundle only has the linearly interpolated export (“export_linear”): ${bundle.missingReason('kinase_activity') ?? 'no rhs_step representation present.'} The model’s RHS uses a right-continuous step on the kinase grid instead (KNOWN_ISSUES N17), so the shape between knots shown here is not what the model integrates.`]
  })
</script>

{#if !t}<Loading />{:else}
  {#if hasStep && reps.has('export_linear')}<label><input type="checkbox" bind:checked={overlay} /> overlay the interpolated export (N17)</label>{/if}
  <Plot height={300} grid x={{ label: 'Time (min)' }} y={{ label: 'Activity (a.u.), top 10 by plain sum' }} color={{ legend: true }}>
    <Line data={shown.filter((r) => r.rep === main)} x="time" y="value" z="kinase" stroke="kinase" curve={main === 'rhs_step' ? 'step-after' : 'linear'} strokeWidth={1.5} />
    {#if overlay}<Line data={shown.filter((r) => r.rep === 'export_linear')} x="time" y="value" z="kinase" stroke="kinase" strokeDasharray="3 3" strokeOpacity={0.7} />{/if}
  </Plot>
{/if}
