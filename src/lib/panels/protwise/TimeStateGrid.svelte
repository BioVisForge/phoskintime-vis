<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, BoxY, Dot } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { boxStats } from '../../transforms/box'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  $effect(() => {
    bundle.table('perturbations').then((x) => {
      t = x
    })
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (P[i] === protein && Number.isFinite(V[i])) out.push({ state: S[i]!, time: String(T[i]), t: T[i], value: V[i] })
    return out.sort((a, b) => a.t - b.t)
  })
  const states = $derived([...new Set(rows.map((r) => r.state))])
  const nPer = $derived(rows.length ? Math.min(...[...Map.groupBy(rows, (r) => r.state + r.time).values()].map((g) => g.length)) : 0)
  $effect(() => {
    const out: Record<string, unknown>[] = []
    for (const [k, g] of Map.groupBy(rows, (r) => `${r.state}|${r.time}`)) {
      const [state, time] = k.split('|')
      out.push({ state, time: +time, ...boxStats(g.map((r) => r.value)), outliers: undefined })
    }
    report.rows = out
    report.notes = [`Replaces PhosKinTime's strip grid: one box per time point and state. Whiskers: Tukey 1.5 × IQR; points beyond are outliers. Quartiles: linear (numpy default). n = ${nPer} per box${nPer < 30 ? ', so every sample is overlaid as a point' : ''}. PhosKinTime keeps only states whose name matches [A-Za-z][0-9]?; this view keeps all states.`]
  })
</script>

{#if !t}<Loading />{:else}
  <Plot height={220} grid fy={{ label: '' }} fx={{ label: 'State' }} x={{ type: 'band', label: 'Time (min), categorical as in PhosKinTime', domain: [...new Set(rows.map((r) => r.time))] }} y={{ label: 'Model FC' }}>
    <BoxY data={rows.filter((r) => r.state === states[0] || true)} x="time" y="value" fx="state" fill="#a6c3e0" tickMedian={{ stroke: 'var(--pkv-ink)', strokeWidth: 2 }} />
    {#if nPer < 30}<Dot data={rows} x="time" y="value" fx="state" r={1.2} fill="var(--pkv-ink)" opacity={0.5} />{/if}
  </Plot>
{/if}
