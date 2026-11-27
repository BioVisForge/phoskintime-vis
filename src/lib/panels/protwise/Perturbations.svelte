<script lang="ts">
  import { Plot, Line, RuleX, AreaY } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { envelopes } from '../../transforms/envelope'
  import { trajRows, TIME_TICKS } from '../common'
  import { app } from '../../ui/state.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let tr = $state.raw<Table | null>(null)
  let protein = $state('')
  let state_ = $state('')
  $effect(() => {
    Promise.all([bundle.table('perturbations'), bundle.table('trajectories')]).then(([x, y]) => {
      t = x
      tr = y
      protein = str(x, 'protein')[0] ?? ''
    })
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), K = str(t, 'perturbation'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (P[i] === protein) out.push({ perturbation: K[i]!, state: S[i]!, time: T[i], value: Number.isFinite(V[i]) ? V[i] : null })
    return out
  })
  const states = $derived([...new Set(rows.map((r) => r.state))])
  const st = $derived(states.includes(state_) ? state_ : states[0])
  const sel = $derived(rows.filter((r) => r.state === st))
  const env = $derived(envelopes(sel.map((r) => r.state), sel.map((r) => r.time), sel.map((r) => (r.value === null ? NaN : r.value))))
  const best = $derived(tr ? trajRows(tr, { protein, best: true }).filter((r) => r.state === st) : [])
  $effect(() => {
    report.rows = env as unknown as Record<string, unknown>[]
    report.notes = [
      `${new Set(sel.map((r) => r.perturbation)).size} perturbation samples. Default view: 5–95 % band and median per exact time point, with min/max rules (P10; min/max alone overstate spread). Toggle “raw lines” in the top bar to draw every sample (canvas) with the best fit highlighted on top (P6).`,
    ]
  })
</script>

{#if !t}<Loading />{:else}
  <label>Protein <select bind:value={protein}>{#each [...new Set(str(t, 'protein'))] as p}<option value={p}>{p}</option>{/each}</select></label>
  <label>State <select value={st} onchange={(e) => (state_ = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
  <Plot height={300} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Model FC' }}>
    {#if app.rawLines}
      <Line canvas data={sel} x="time" y="value" z="perturbation" stroke="#9aa" strokeOpacity={0.35} />
    {:else}
      <AreaY data={env} x="time" y1="q05" y2="q95" fill="#7a9cc6" fillOpacity={0.35} />
      <Line data={env} x="time" y="q50" stroke="#2c5a95" strokeDasharray="5 3" />
    {/if}
    <!-- P10: min / max rules per exact stored time point (grouped by exact time, never binX intervals) -->
    <RuleX data={env} x="time" y1="min" y2="max" stroke="#c44" strokeWidth={1.2} />
    <Line data={best} x="time" y="pred" stroke="black" strokeWidth={2} />
  </Plot>
  <p class="legend">black: best fit · blue band: 5–95 % · dashed blue: median · red rules: min–max across samples at each stored time</p>
{/if}
<style>.legend { font-size: 0.78rem; color: #555; margin: 0; }</style>
