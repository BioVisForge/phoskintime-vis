<script lang="ts">
  import { Plot, RectY, Dot, BoxY, Brush, Rect, Line } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num } from '../../transforms/table'
  import { histogram } from '../common'
  import Selection from '../shared/Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  let brush = $state({ enabled: false } as { enabled: boolean; x1?: number; x2?: number; y1?: number; y2?: number })
  $effect(() => {
    bundle.table('multistart').then((x) => (t = x))
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const S = num(t, 'start'), O = num(t, 'objective'), SEL = t.columns.selected.values as (boolean | null)[], C = t.columns.converged.values as (boolean | null)[]
    const r = Array.from({ length: t.rows }, (_, i) => ({ start: S[i], objective: O[i], selected: !!SEL[i], converged: !!C[i], all: 'all starts' })).filter((x) => Number.isFinite(x.objective))
    return r.sort((a, b) => a.objective - b.objective).map((x, k) => ({ ...x, rank: k + 1 }))
  })
  // _plot_multistart: histogram bins = max(1, min(10, n))
  const hist = $derived(histogram(rows.map((r) => r.objective), Math.max(1, Math.min(10, rows.length))))
  const inB = (r: { rank: number; objective: number }) => brush.enabled && r.rank >= brush.x1! && r.rank <= brush.x2! && r.objective >= brush.y1! && r.objective <= brush.y2!
  const chosen = $derived(rows.filter(inB).map((r) => String(r.start)))
  $effect(() => {
    report.rows = rows
    report.notes = [`Histogram (bins = max(1, min(10, n))) and ranked objective as _plot_multistart. Box: Tukey 1.5 × IQR; n = ${rows.length}${rows.length < 30 ? ', so every start is overlaid as a point' : ''}. Brush the ranked plot to choose starts.`]
  })
</script>

{#if !t}<Loading />{:else}
  <div class="three">
    <Plot height={240} grid x={{ label: 'final objective' }} y={{ label: 'starts' }}>
      <RectY data={hist} x1="x1" x2="x2" y1={0} y2="count" fill="#9ecae1" stroke="white" />
    </Plot>
    <Plot zoom="ranked" height={240} grid inset={8} x={{ label: 'rank' }} y={{ label: 'final objective' }}>
      <Line data={rows} x="rank" y="objective" stroke="#999" />
      <Dot data={rows} x="rank" y="objective" r={4} fill={(d: any) => (inB(d) ? '#d62728' : d.selected ? 'var(--pkv-ink)' : '#3182bd')} />
      {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
      <Brush bind:brush constrainToDomain stroke={false} />
    </Plot>
    <Plot zoom="distribution" height={240} grid x={{ type: 'band', label: '' }} y={{ label: 'final objective' }}>
      <BoxY data={rows} x="all" y="objective" fill="#c7dcef" tickMedian={{ stroke: 'var(--pkv-ink)', strokeWidth: 2 }} />
      {#if rows.length < 30}<Dot data={rows} x="all" y="objective" r={2.5} fill="var(--pkv-ink)" opacity={0.6} />{/if}
    </Plot>
  </div>
  <Selection ids={chosen} label="starts selected" name="multistart_selection" />
{/if}
<style>.three { display: grid; grid-template-columns: 1fr 1fr 0.6fr; gap: 8px; }</style>
