<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Line, Dot } from '../../plot'
  import PixelArrows from '../../plot/PixelArrows.svelte'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { finiteDifferenceArrows } from '../../transforms/envelope'
  import { stateFor, stateMeta, trajRows } from '../common'
  import { app, pick } from '../../ui/state.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let tr = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  let sx = $state(ps.get('sx', ''))
  $effect(() => ps.set('sx', sx))
  let sy = $state(ps.get('sy', ''))
  $effect(() => ps.set('sy', sy))
  $effect(() => {
    Promise.all([bundle.table('perturbations'), bundle.table('trajectories')]).then(([x, y]) => {
      t = x
      tr = y
    })
  })
  const rows = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), K = str(t, 'perturbation'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (P[i] === protein) out.push({ k: K[i]!, s: S[i]!, time: T[i], v: V[i] })
    return out
  })
  const states = $derived([...new Set(rows.map((r) => r.s))])
  const X = $derived(states.includes(sx) ? sx : states[0])
  // Y follows the global psite when it names a state of this protein
  const Y0 = $derived(tr ? stateFor(states.filter((s) => s !== X), stateMeta(trajRows(tr, { protein, best: true })), app.ctx, sy) : sy)
  const Y = $derived(states.includes(Y0) ? Y0 : (states[1] ?? states[0]))
  const paths = $derived.by(() => {
    const m = new Map<string, { k: string; time: number; x?: number; y?: number }>()
    for (const r of rows) {
      if (r.s !== X && r.s !== Y) continue
      const key = `${r.k}|${r.time}`
      const e = m.get(key) ?? { k: r.k, time: r.time }
      if (r.s === X) e.x = r.v
      if (r.s === Y) e.y = r.v
      m.set(key, e)
    }
    return [...m.values()].filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y)).sort((a, b) => a.time - b.time)
  })
  const best = $derived.by(() => {
    if (!tr) return []
    const b = trajRows(tr, { protein, best: true })
    const bx = new Map(b.filter((r) => r.state === X).map((r) => [r.time, r.pred]))
    return b.filter((r) => r.state === Y && bx.get(r.time) != null && r.pred != null).map((r) => ({ time: r.time, x: bx.get(r.time)!, y: r.pred! })).sort((a, b) => a.time - b.time)
  })
  const arrows = $derived(finiteDifferenceArrows(best.map((p) => p.time), best.map((p) => p.x), best.map((p) => p.y)))
  $effect(() => {
    report.rows = paths
    report.notes = ['Each perturbation sample is a path of state X against state Y over its stored time points. Arrows (P11) show the best fit’s direction of time from finite differences between consecutive stored points; they are not a flow field. A true flow field needs the engine (Milestone 2).']
  })
</script>

{#if !t}<Loading />{:else}
  <label>X <select value={X} onchange={(e) => (sx = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
  <label>Y <select value={Y} onchange={(e) => (sy = e.currentTarget.value)}>{#each states as s}<option value={s}>{s}</option>{/each}</select></label>
  <Plot zoom="main" height={360} grid inset={10} x={{ label: `${X} (model FC)` }} y={{ label: `${Y} (model FC)` }}>
    <Line canvas={app.rawLines} data={paths} x="x" y="y" z="k" stroke="#8aa" strokeOpacity={0.45} strokeWidth={0.6} />
    <Line data={best} x="x" y="y" stroke="var(--pkv-ink)" strokeWidth={1.6} />
    <PixelArrows data={arrows.map((a) => ({ ...a, x0: a.x - a.dx / 2, y0: a.y - a.dy / 2, x1: a.x + a.dx / 2, y1: a.y + a.dy / 2 }))} length={12} stroke="#c33" />
    <Dot data={best.slice(0, 1)} x="x" y="y" fill="var(--pkv-ink)" r={4} title="t0" />
  </Plot>
{/if}
