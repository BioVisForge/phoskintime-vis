<script lang="ts">
  import { Plot, Line, AreaY } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { envelopes } from '../../transforms/envelope'
  import { proteins, layerLabel, TIME_TICKS } from '../common'
  import { app, pick } from '../../ui/state.svelte'
  import Loading from '../Loading.svelte'
  import FastLines from '../shared/FastLines.svelte'
  import { rawSeries } from '../../derive/raw'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? proteins(t) : []))
  $effect(() => {
    bundle.table('trajectories').then((x) => {
      t = x
    })
  })
  // every (state, sample) series, as flat arrays for speed
  const flat = $derived.by(() => {
    if (!t) return null
    return { L: str(t, 'layer'), P: str(t, 'protein'), S: str(t, 'state'), SID: str(t, 'sample_id'), T: num(t, 'time'), E: num(t, 'value_pred') }
  })
  const layers = $derived(flat ? [...new Set(flat.L)] as string[] : [])
  const nSeries = $derived(flat ? new Set(flat.S.map((s, i) => s + '\u0000' + flat!.SID[i])).size : 0)
  const bands = $derived.by(() => {
    if (!flat) return []
    // quantiles across all series of a layer at each exact stored time point
    return envelopes(flat.L, flat.T, flat.E).map((e) => ({ ...e, panel: layerLabel(bundle, e.key) }))
  })
  // raw mode: per layer, typed arrays of all series (sorted by series, then time)
  const raw = $derived.by(() => {
    if (!flat || !app.rawLines) return []
    return layers.map((l) => {
      const { xs, ys, starts } = rawSeries(flat!, l)
      const fin = Array.from(ys).filter(Number.isFinite)
      return { layer: l, panel: layerLabel(bundle, l), xs, ys, starts, ydom: [Math.min(...fin), Math.max(...fin)], xdom: [Math.min(...xs), Math.max(...xs)] }
    })
  })
  const hi = $derived.by(() => {
    if (!flat) return []
    const out = []
    for (let i = 0; i < flat.T.length; i++) if (flat.P[i] === protein && flat.SID[i] === 'best') out.push({ panel: layerLabel(bundle, flat.L[i]!), z: flat.S[i]!, time: flat.T[i], v: flat.E[i] })
    return out
  })
  $effect(() => {
    report.rows = bands as unknown as Record<string, unknown>[]
    report.notes = [`${nSeries.toLocaleString()} predicted series (states × samples). Default: 1–99 % and 5–95 % bands with the median, per layer and exact time point. Turn on “raw lines (canvas)” in the top bar to draw every series on canvas (P6); the selected gene is drawn last, in red.`]
  })
</script>

{#if !flat}<Loading />{:else}
  {#if app.rawLines}
    <div class="three">
      {#each raw as r}
        <Plot zoom height={280} grid title={r.panel} x={{ type: 'symlog', ticks: TIME_TICKS, domain: r.xdom, label: 'Time (min), symlog' }} y={{ domain: r.ydom, label: 'Predicted FC' }}>
          <FastLines xs={r.xs} ys={r.ys} starts={r.starts} />
          <Line data={hi.filter((h) => h.panel === r.panel)} x="time" y="v" z="z" stroke="#d62728" strokeWidth={1.8} />
        </Plot>
      {/each}
    </div>
  {:else}
    <Plot height={280} grid fx={{ label: '', domain: layers.map((l) => layerLabel(bundle, l)) }} x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Predicted FC' }}>
      <AreaY data={bands} x="time" y1="q01" y2="q99" fx="panel" fill="#a9c4e4" fillOpacity={0.35} />
      <AreaY data={bands} x="time" y1="q05" y2="q95" fx="panel" fill="#6f9bd1" fillOpacity={0.45} />
      <Line data={bands} x="time" y="q50" fx="panel" stroke="#1f4e8c" strokeWidth={1.5} />
      <Line data={hi} x="time" y="v" z="z" fx="panel" stroke="#d62728" strokeWidth={1.8} />
    </Plot>
  {/if}
{/if}
<style>.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }</style>
