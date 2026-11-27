<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Dot, Brush, Rect } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import Selection from '../shared/Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let ox = $state(ps.get('ox', ''))
  $effect(() => ps.set('ox', ox))
  let oy = $state(ps.get('oy', ''))
  $effect(() => ps.set('oy', oy))
  let brush = $state({ enabled: false } as { enabled: boolean; x1?: number; x2?: number; y1?: number; y2?: number })
  $effect(() => {
    bundle.table('pareto').then((x) => (t = x))
  })
  const wide = $derived.by(() => {
    if (!t) return { objs: [] as string[], rows: [] as Record<string, any>[] }
    const S = num(t, 'solution'), O = str(t, 'objective'), V = num(t, 'value'), SEL = t.columns.selected.values as (boolean | null)[]
    const m = new Map<number, Record<string, any>>()
    const objs: string[] = []
    for (let i = 0; i < t.rows; i++) {
      if (!objs.includes(O[i]!)) objs.push(O[i]!)
      const r = m.get(S[i]) ?? { solution: S[i], selected: !!SEL[i] }
      r[O[i]!] = V[i]
      m.set(S[i], r)
    }
    return { objs, rows: [...m.values()] }
  })
  const X = $derived(wide.objs.includes(ox) ? ox : wide.objs[0])
  const Y = $derived(wide.objs.includes(oy) ? oy : wide.objs[1] ?? wide.objs[0])
  const inB = (r: Record<string, any>) => brush.enabled && r[X] >= brush.x1! && r[X] <= brush.x2! && r[Y] >= brush.y1! && r[Y] <= brush.y2!
  const chosen = $derived(wide.rows.filter(inB).map((r) => String(r.solution)))
  $effect(() => {
    report.rows = wide.rows
    report.notes = ['Viewer extra: PhosKinTime exports the Pareto front to Excel but draws no plot of it (closest: the dashboard’s scalar-objective scatter). Black ring: the picked solution. Brush to choose solutions to compare; the selection is exportable.']
  })
</script>

{#if !t}<Loading />{:else}
  <label>x <select value={X} onchange={(e) => (ox = e.currentTarget.value)}>{#each wide.objs as o}<option value={o}>{o}</option>{/each}</select></label>
  <label>y <select value={Y} onchange={(e) => (oy = e.currentTarget.value)}>{#each wide.objs as o}<option value={o}>{o}</option>{/each}</select></label>
  <Plot zoom="main" height={320} grid inset={8} x={{ label: X }} y={{ label: Y }}>
    <Dot data={wide.rows} x={X} y={Y} r={4} fill={(d: any) => (inB(d) ? '#d62728' : '#6a8caf')} />
    <Dot data={wide.rows.filter((r) => r.selected)} x={X} y={Y} r={8} stroke="var(--pkv-ink)" strokeWidth={2} />
    {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
    <Brush bind:brush constrainToDomain stroke={false} />
  </Plot>
  <Selection ids={chosen} label="solutions selected" name="pareto_selection" />
{/if}
