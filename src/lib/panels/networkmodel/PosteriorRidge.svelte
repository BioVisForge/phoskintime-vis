<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import type { PanelProps } from '../types'
  import { loadPosterior } from './posterior'
  import { posteriorColumn } from '../../derive/trajectories'
  import { paramLabel } from '../common'
  import Ridgeline from '../shared/Ridgeline.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let post = $state.raw<Awaited<ReturnType<typeof loadPosterior>> | null>(null)
  let batch = $state(ps.get('batch', 0))
  $effect(() => ps.set('batch', batch))
  let mode = $state<'normalised' | 'raw-log' | 'raw'>(ps.get('mode', 'normalised'))
  $effect(() => ps.set('mode', mode))
  $effect(() => {
    loadPosterior(bundle).then((p) => (post = p))
  })
  const N = 25 // max_params_per_fig
  const nb = $derived(post ? Math.ceil(post.names.length / N) : 0)
  const series = $derived(post ? post.names.slice(batch * N, batch * N + N).map((n, k) => ({ name: paramLabel(bundle, n), values: posteriorColumn(post!.arr, batch * N + k) })) : [])
  $effect(() => {
    report.rows = series.map((s) => ({ parameter: s.name, n: s.values.length }))
    report.notes = ['Replaces _plot_ridgeline_parameter_distributions. Same KDE (Gaussian, Silverman bandwidth, 256 points over min − 10 % … max + 10 %, peak-normalised). As PhosKinTime does, the grid is clipped to each posterior’s own min–max (np.clip, no reflection), so no density is drawn below the smallest draw. Bar: 5–95 % interval. Neutral fill: colour encodes nothing.']
  })
</script>

{#if !post}<Loading />{:else}
  <label>Batch <select bind:value={batch}>{#each Array.from({ length: nb }, (_, i) => i) as i}<option value={i}>{i * N + 1}–{Math.min((i + 1) * N, post.names.length)}</option>{/each}</select></label>
  <label>x scale <select bind:value={mode}><option value="normalised">per-parameter (as PhosKinTime)</option><option value="raw-log">shared, log</option><option value="raw">shared, linear</option></select></label>
  <Ridgeline {series} {mode} />
{/if}
