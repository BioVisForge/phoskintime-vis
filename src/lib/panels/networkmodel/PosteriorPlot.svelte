<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, Line, RectY, RuleX } from '../../plot'
  import type { PanelProps } from '../types'
  import { loadPosterior } from './posterior'
  import { posteriorColumn, credible } from '../../derive/trajectories'
  import { paramLabel, histogram } from '../common'
  import { npyIndex } from '../../io/npy'
  import Loading from '../Loading.svelte'

  let { bundle, report, kind }: PanelProps & { kind: 'trace' | 'density' } = $props()
  const ps = usePanelState(untrack(() => bundle))
  let post = $state.raw<Awaited<ReturnType<typeof loadPosterior>> | null>(null)
  let j = $state(ps.get('j', 0))
  $effect(() => ps.set('j', j))
  $effect(() => {
    loadPosterior(bundle).then((p) => (post = p))
  })
  const trace = $derived.by(() => {
    if (!post) return []
    const [C, D] = post.arr.shape
    const out = []
    for (let c = 0; c < C; c++) for (let d = 0; d < D; d++) out.push({ chain: `chain ${c}`, draw: d, index: c * D + d, value: Number(post.arr.data[npyIndex(post.arr, [c, d, j])]) })
    return out
  })
  const col = $derived(post ? posteriorColumn(post.arr, j) : new Float64Array())
  const hist = $derived(histogram(Array.from(col), 15))
  const s = $derived(credible(col))
  $effect(() => {
    report.rows = kind === 'trace' ? trace : hist
    report.notes = [
      ...(post?.mismatch ? [post.mismatch] : []),
      kind === 'trace'
        ? 'Draw value against sample index with chains concatenated, as _plot_posterior draws it; chains are coloured here (PhosKinTime does not separate them).'
        : '15-bin histogram as _plot_posterior draws its “density” (it is a histogram, not a KDE). Dashed lines: 5 %, 50 % and 95 % quantiles.',
    ]
  })
</script>

{#if !post}<Loading />{:else}
  <label>Parameter <select bind:value={j}>{#each post.names as n, i}<option value={i}>{paramLabel(bundle, n)}</option>{/each}</select></label>
  {#if kind === 'trace'}
    <Plot height={240} grid x={{ label: 'Sample index (chains concatenated)' }} y={{ label: paramLabel(bundle, post.names[j]) }} color={{ legend: true }}>
      <Line data={trace} x="index" y="value" z="chain" stroke="chain" strokeWidth={0.7} />
    </Plot>
  {:else}
    <Plot height={240} grid x={{ label: paramLabel(bundle, post.names[j]) }} y={{ label: 'frequency' }}>
      <RectY data={hist} x1="x1" x2="x2" y1={0} y2="count" fill="#7aa6d6" stroke="white" />
      <RuleX data={[s.q05, s.q50, s.q95]} stroke="var(--pkv-ink)" strokeDasharray="4 3" />
    </Plot>
  {/if}
{/if}
