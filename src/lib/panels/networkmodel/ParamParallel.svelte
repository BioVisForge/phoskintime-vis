<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Line, Dot, normalizeParallelX } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { loadPosterior } from './posterior'
  import { npyIndex } from '../../io/npy'
  import { num, str } from '../../transforms/table'
  import { paramLabel, CANVAS_MIN } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let post = $state.raw<Awaited<ReturnType<typeof loadPosterior>> | null>(null)
  let pt = $state.raw<Table | null>(null)
  let group = $state(ps.get('group', ''))
  $effect(() => ps.set('group', group))
  let norm = $state<'bounds' | 'extent' | 'log'>(ps.get('norm', 'bounds'))
  $effect(() => ps.set('norm', norm))
  $effect(() => {
    Promise.all([loadPosterior(bundle), bundle.table('parameters')]).then(([p, t]) => {
      post = p
      pt = t
    })
  })
  const bounds = $derived.by(() => {
    const m = new Map<string, { lo: number; hi: number }>()
    if (!pt) return m
    const N = str(pt, 'name'), LO = num(pt, 'lower'), HI = num(pt, 'upper')
    for (let i = 0; i < pt.rows; i++) m.set(N[i]!, { lo: LO[i], hi: HI[i] })
    return m
  })
  const groups = $derived([...new Set(bundle.meta.parameters.map((p) => p.group).filter(Boolean))] as string[])
  const g = $derived(groups.includes(group) ? group : groups[0])
  const rows = $derived.by(() => {
    if (!post) return []
    const js = post.names.map((n, j) => ({ n, j })).filter(({ n }) => bundle.meta.parameters.find((p) => p.name === n)?.group === g).slice(0, 12)
    const [C, D] = post.arr.shape
    const out = []
    for (let c = 0; c < C; c++)
      for (let d = 0; d < D; d += 10) // every 10th draw: 200 polylines for 4 × 500
        for (const { n, j } of js) {
          const raw = Number(post.arr.data[npyIndex(post.arr, [c, d, j])])
          const b = bounds.get(n)
          const lo = b?.lo ?? NaN, hi = b?.hi ?? NaN
          const v = norm === 'bounds' ? (Number.isFinite(lo) && Number.isFinite(hi) ? (Math.log(raw) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : NaN) : norm === 'log' ? Math.log10(raw) : raw
          out.push({ draw: `${c}-${d}`, chain: `chain ${c}`, parameter: paramLabel(bundle, n), value: v, raw, lo, hi })
        }
    return out
  })
  const plotted = $derived(norm === 'extent' ? normalizeParallelX({ data: rows, x: 'value', y: 'parameter', z: 'draw' }, 'extent') : { data: rows, x: 'value', y: 'parameter', z: 'draw' })
  $effect(() => {
    report.rows = rows
    report.notes = [
      'Posterior draws (every 10th) as polylines across the parameters of one group (P7, straight segments). “bounds”: position between the parameter’s lower and upper bound from the parameters table, on a log scale since these are positive rates (0 = lower bound, 1 = upper bound), so draws that sit near a bound stand out. “extent”: each axis scaled to its own min–max. Tooltips give raw values.',
    ]
  })
</script>

{#if !post}<Loading />{:else}
  <label>Group <select value={g} onchange={(e) => (group = e.currentTarget.value)}>{#each groups as x}<option value={x}>{x}</option>{/each}</select></label>
  <label>Axis <select bind:value={norm}><option value="bounds">bounds-normalised (log)</option><option value="extent">extent</option><option value="log">log10 raw</option></select></label>
  <Plot height={Math.max(200, 34 * new Set(rows.map((r) => r.parameter)).size + 60)} marginLeft={190} grid inset={8} x={{ label: norm === 'bounds' ? 'log position between lower (0) and upper (1) bound' : norm === 'extent' ? 'normalised to extent' : 'log10 value', domain: norm === 'bounds' ? [0, 1] : undefined }} y={{ label: '' }} color={{ legend: true }}>
    <Line {...plotted as any} stroke="chain" strokeOpacity={0.25} strokeWidth={0.7} />
    <Dot canvas={rows.length > CANVAS_MIN} {...plotted as any} fill="chain" r={1.2} title={(d: any) => `${d.parameter}: ${d.raw.toPrecision(4)} (bounds ${d.lo} … ${d.hi})`} />
  </Plot>
{/if}
