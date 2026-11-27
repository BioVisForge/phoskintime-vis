<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Dot, Line, Text } from '../../plot'
  import PixelArrows from '../../plot/PixelArrows.svelte'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { finiteDifferenceArrows } from '../../transforms/envelope'
  import Loading from '../Loading.svelte'

  let { bundle, report, method }: PanelProps & { method: 'pca' | 'tsne' } = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('embeddings').then((x) => {
      t = x
    })
  })
  const pts = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), M = str(t, 'method'), T = num(t, 'time'), X = num(t, 'x'), Y = num(t, 'y')
    const EX = t.columns.explained_variance_x ? num(t, 'explained_variance_x') : null
    const EY = t.columns.explained_variance_y ? num(t, 'explained_variance_y') : null
    const out = []
    for (let i = 0; i < t.rows; i++)
      if (M[i] === method && P[i] === protein) out.push({ time: T[i], x: X[i], y: Y[i], evx: EX?.[i] ?? NaN, evy: EY?.[i] ?? NaN })
    return out.sort((a, b) => a.time - b.time).map((p, k) => ({ ...p, index: k + 1 }))
  })
  const arrows = $derived(finiteDifferenceArrows(pts.map((p) => p.time), pts.map((p) => p.x), pts.map((p) => p.y)))
  const proteinsFor = $derived(t ? [...new Set(str(t, 'protein').filter((p, i) => str(t!, 'method')[i] === method))].filter(Boolean) as string[] : [])
  const protein = $derived(pick(app.ctx.protein, proteinsFor))
  const ax = (k: 'x' | 'y') => {
    const ev = pts[0]?.[k === 'x' ? 'evx' : 'evy']
    const base = method === 'pca' ? (k === 'x' ? 'PC1' : 'PC2') : k === 'x' ? 't-SNE 1' : 't-SNE 2'
    return Number.isFinite(ev) ? `${base} (${(ev * 100).toFixed(1)} %)` : base
  }
  $effect(() => {
    report.rows = pts
    report.notes = [
      method === 'pca'
        ? 'PhosKinTime draws a 3-D PCA with a cubic-spline path; this shows PC1/PC2 with straight segments between stored time points (no spline: a spline would invent intermediate states).'
        : 't-SNE coordinates as stored in the bundle (PhosKinTime: perplexity min(5, n−1), random_state 42). The path uses straight segments, not a spline.',
      'Arrows: finite differences between consecutive stored time points, drawn at segment midpoints. They show the direction of time along this path; they are not a flow field.',
    ]
  })
</script>

{#if !t}<Loading />{:else}
  <Plot zoom="main" height={360} grid inset={14} x={{ label: ax('x') }} y={{ label: ax('y') }} color={{ legend: true, label: 'Time (min)', type: 'log' }}>
    <Line data={pts} x="x" y="y" stroke="#c33" strokeOpacity={0.35} />
    <PixelArrows data={arrows.map((a) => ({ ...a, x0: a.x - a.dx / 2, y0: a.y - a.dy / 2, x1: a.x + a.dx / 2, y1: a.y + a.dy / 2 }))} length={14} stroke="#444" />
    <Dot data={pts} x="x" y="y" fill={(d: any) => Math.max(d.time, 0.1)} stroke="var(--pkv-ink)" r={5} title={(d: any) => `t = ${d.time} min`} />
    <Text data={pts} x="x" y="y" text="index" dy={-10} fontSize={9} />
  </Plot>
{/if}
