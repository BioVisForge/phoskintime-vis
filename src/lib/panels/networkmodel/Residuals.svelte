<script lang="ts">
  import { Plot, Dot, RuleY, BoxY } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { gofPoints } from '../../derive/trajectories'
  import { mean } from '../../transforms/stats'
  import { layerLabel, fmt, TIME_TICKS, CANVAS_MIN } from '../common'
  import Ridgeline from '../shared/Ridgeline.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('trajectories').then((x) => (t = x))
  })
  const pts = $derived(t ? gofPoints(t).map((p) => ({ ...p, panel: layerLabel(bundle, p.layer) })) : [])
  const layers = $derived([...new Set(pts.map((p) => p.panel))])
  const summ = $derived(layers.map((l) => {
    const r = pts.filter((p) => p.panel === l).map((p) => p.resid)
    return { panel: l, bias: mean(r), rmse: Math.sqrt(mean(r.map((x) => x * x))), n: r.length }
  }))
  $effect(() => {
    report.rows = pts
    report.notes = ['Residual = predicted − observed at the observed time points (export_residuals). Boxes: Tukey 1.5 × IQR whiskers. Ridges: KDE of residuals per layer, same estimator as the posterior ridgeline.']
  })
</script>

{#if !t}<Loading />{:else}
  <p class="summ">{#each summ as s}<span><b>{s.panel}</b>: Bias {fmt(s.bias, 4)}, RMSE {fmt(s.rmse, 4)} (n={s.n})</span>{/each}</p>
  <Plot zoom="main" height={240} grid fx={{ label: '' }} x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Residual (pred − obs)' }}>
    <Dot canvas={pts.length > CANVAS_MIN} data={pts} x="time" y="resid" fx="panel" r={1.6} fill="#555" opacity={0.45} />
    <RuleY y={0} stroke="red" strokeDasharray="4 3" />
  </Plot>
  <div class="two">
    <Plot height={240} grid x={{ type: 'band', label: '' }} y={{ label: 'Residual' }}>
      <BoxY data={pts} x="panel" y="resid" fill="#bcd4ec" tickMedian={{ stroke: 'var(--pkv-ink)', strokeWidth: 2 }} />
      <RuleY y={0} stroke="red" strokeDasharray="4 3" />
    </Plot>
    <Ridgeline series={layers.map((l) => ({ name: l, values: pts.filter((p) => p.panel === l).map((p) => p.resid) }))} mode="raw" height={240} />
  </div>
{/if}
<style>.summ { display: flex; gap: 18px; font-size: 0.82rem; margin: 2px 0; flex-wrap: wrap; } .two { display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px; }</style>
