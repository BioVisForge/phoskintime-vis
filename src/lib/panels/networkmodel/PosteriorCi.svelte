<script lang="ts">
  import { Plot, Dot, RuleY } from 'svelteplot'
  import type { PanelProps } from '../types'
  import { loadPosterior } from './posterior'
  import { posteriorColumn, credible } from '../../derive/trajectories'
  import { paramLabel, groupLabel } from '../common'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let post = $state.raw<Awaited<ReturnType<typeof loadPosterior>> | null>(null)
  let group = $state('')
  let log = $state(true)
  $effect(() => {
    loadPosterior(bundle).then((p) => (post = p))
  })
  const all = $derived(post ? post.names.map((n, j) => ({ name: n, label: paramLabel(bundle, n), group: bundle.meta.parameters.find((p) => p.name === n)?.group ?? null, ...credible(posteriorColumn(post!.arr, j)) })) : [])
  const groups = $derived([...new Set(all.map((r) => r.group))])
  const g = $derived(groups.includes(group) ? group : groups[0])
  const rows = $derived(all.filter((r) => r.group === g))
  $effect(() => {
    report.rows = all
    report.notes = ['Posterior median with the 5 %–95 % interval (a 90 % equal-tailed interval: np.quantile 0.05 / 0.95 as in BayesianInference.py). Quantile-based; never a box plot.']
  })
</script>

{#if !post}<Loading />{:else}
  <label>Group <select value={g} onchange={(e) => (group = e.currentTarget.value)}>{#each groups as x}<option value={x}>{groupLabel(bundle, x)}</option>{/each}</select></label>
  <label><input type="checkbox" bind:checked={log} /> log x</label>
  <Plot height={Math.max(160, 14 * rows.length + 60)} marginLeft={190} grid x={{ type: log ? 'log' : 'linear', label: 'posterior median and 90 % interval' }} y={{ label: '', domain: rows.map((r) => r.label) }}>
    <RuleY data={rows} y="label" x1="q05" x2="q95" stroke="#333" />
    <Dot data={rows} x="q50" y="label" fill="#1f77b4" r={3} title={(d: any) => `${d.label}: median ${d.q50.toPrecision(4)} [${d.q05.toPrecision(4)}, ${d.q95.toPrecision(4)}]`} />
  </Plot>
{/if}
