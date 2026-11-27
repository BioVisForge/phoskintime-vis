<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Line, AreaY, DifferenceY, Dot } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { str } from '../../transforms/table'
  import { envelopes } from '../../transforms/envelope'
  import { stateFor, stateMeta, trajRows, proteins, TIME_TICKS } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? proteins(t) : []))
  let st = $state(ps.get('st', ''))
  $effect(() => ps.set('st', st))
  $effect(() => {
    bundle.table('trajectories').then((x) => {
      t = x
    })
  })
  const rows = $derived(t ? trajRows(t, { protein }) : [])
  const states = $derived([...new Set(rows.map((r) => r.state))])
  const S = $derived(stateFor(states, stateMeta(rows), app.ctx, st))
  const ppc = $derived(rows.filter((r) => r.state === S && r.sample !== 'best'))
  const best = $derived(rows.filter((r) => r.state === S && r.sample === 'best'))
  const env = $derived(envelopes(ppc.map((r) => r.state), ppc.map((r) => r.time), ppc.map((r) => (r.pred === null ? NaN : r.pred))))
  const diff = $derived.by(() => {
    const m = new Map(env.map((e) => [e.time, e.q50]))
    return best.filter((b) => m.has(b.time) && b.pred !== null).map((b) => ({ time: b.time, fit: b.pred!, median: m.get(b.time)! }))
  })
  const nSamples = $derived(new Set(ppc.map((r) => r.sample)).size)
  $effect(() => {
    report.rows = env.map((e) => ({ ...e, fit: best.find((b) => b.time === e.time)?.pred ?? null }))
    report.notes = [
      `Viewer extra: PhosKinTime writes no predictive trajectories (posterior_predictive.csv holds only the scalar objective). Bands are 1–99 % and 5–95 % over the ${nSamples} non-best samples stored in this bundle. Difference (P5): y1 = fitted trajectory, y2 = predictive median; red where the median is above the fit, blue where below. Both are continuous model series on the same grid. Observations are points only (no area).`,
    ]
  })
</script>

{#if !t}<Loading />{:else}
  {#if !t || !str(t, 'sample_id').some((s) => s !== 'best')}
    <p>No posterior-predictive samples (sample_id ≠ “best”) in this bundle.</p>
  {:else}
    <label>State <select value={S} onchange={(e) => (st = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
    <Plot zoom="main" height={280} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'FC' }}>
      <AreaY data={env} x="time" y1="q01" y2="q99" fill="#c6dbef" fillOpacity={0.6} />
      <AreaY data={env} x="time" y1="q05" y2="q95" fill="#9ecae1" fillOpacity={0.7} />
      <DifferenceY data={diff} x="time" y1="fit" y2="median" positiveFill="#d6604d" negativeFill="#4393c3" fillOpacity={0.5} />
      <Line data={diff} x="time" y="median" stroke="#08519c" strokeDasharray="5 3" />
      <Line data={diff} x="time" y="fit" stroke="var(--pkv-ink)" strokeWidth={1.6} />
      <Dot data={best.filter((r) => r.obs !== null)} x="time" y="obs" fill="#e6550d" r={3} />
    </Plot>
    <p class="legend">black: fitted (best) · dashed blue: predictive median · bands: 5–95 % and 1–99 % · orange points: observations</p>
  {/if}
{/if}
<style>.legend { font-size: 0.75rem; color: var(--pkv-ink-2); margin: 0; }</style>
