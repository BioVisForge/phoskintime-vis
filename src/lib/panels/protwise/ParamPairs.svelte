<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { app, pick } from '../../ui/state.svelte'
  import { Plot, Dot, RegressionY, Brush, Line, Rect } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { pearson } from '../../transforms/stats'
  import { paramLabel, TIME_TICKS } from '../common'
  import Selection from '../shared/Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let pt = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  let focus = $state(ps.get('focus', 0))
  $effect(() => ps.set('focus', focus))
  let brush = $state({ enabled: false } as { enabled: boolean; x1?: number; x2?: number; y1?: number; y2?: number })
  $effect(() => {
    Promise.all([bundle.table('perturbation_samples'), bundle.hasTable('perturbations') ? bundle.table('perturbations') : Promise.resolve(null)]).then(([x, y]) => {
      t = x
      pt = y
    })
  })
  const wide = $derived.by(() => {
    if (!t) return { params: [] as string[], rows: [] as Record<string, any>[] }
    const P = str(t, 'protein'), K = str(t, 'perturbation'), N = str(t, 'parameter'), V = num(t, 'value'), R = num(t, 'rmse')
    const m = new Map<string, Record<string, any>>()
    const params: string[] = []
    for (let i = 0; i < t.rows; i++) {
      if (P[i] !== protein) continue
      if (!params.includes(N[i]!)) params.push(N[i]!)
      const r = m.get(K[i]!) ?? { perturbation: K[i], rmse: R[i] }
      r[N[i]!] = V[i]
      m.set(K[i]!, r)
    }
    return { params, rows: [...m.values()] }
  })
  // plot_top_param_pairs: every pair, Pearson |r| in the title, seaborn regplot(ci=95)
  const pairs = $derived(wide.params.flatMap((a, i) => wide.params.slice(i + 1).map((b) => ({ a, b, r: Math.abs(pearson(wide.rows.map((r) => r[a]), wide.rows.map((r) => r[b]))) }))))
  const f = $derived(pairs[Math.min(focus, pairs.length - 1)])
  const inBrush = (r: Record<string, any>) => brush.enabled && f && r[f.a] >= brush.x1! && r[f.a] <= brush.x2! && r[f.b] >= brush.y1! && r[f.b] <= brush.y2!
  const selected = $derived(f ? wide.rows.filter(inBrush).map((r) => r.perturbation as string) : [])
  const selTraj = $derived.by(() => {
    if (!pt || !selected.length) return []
    const P = str(pt, 'protein'), K = str(pt, 'perturbation'), S = str(pt, 'state'), T = num(pt, 'time'), V = num(pt, 'value')
    const want = new Set(selected)
    const out = []
    for (let i = 0; i < pt.rows; i++) if (P[i] === protein && want.has(K[i]!)) out.push({ perturbation: K[i], state: S[i], time: T[i], value: V[i] })
    return out
  })
  $effect(() => {
    report.rows = wide.rows
    report.notes = ['Regression: OLS line with an analytic 95 % confidence band (confidence = 0.95 set explicitly; SveltePlot’s default is 0.99). PhosKinTime’s seaborn regplot draws a bootstrap 95 % band, so band widths can differ slightly; the line itself matches scipy.stats.linregress. Each pair has its own axes because parameters have different scales.']
  })
</script>

{#if !t}<Loading />{:else}
  <div class="grid">
    {#each pairs as p, i}
      <div class="cell" class:on={i === focus} role="button" tabindex="0" aria-pressed={i === focus} aria-label={`Focus pair ${p.a} vs ${p.b}`} onclick={() => { focus = i; brush = { enabled: false } }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus = i; brush = { enabled: false } } }}>
        <Plot height={170} width={220} grid inset={6} title={`|r| = ${p.r.toFixed(2)}`} x={{ label: paramLabel(bundle, p.a) }} y={{ label: paramLabel(bundle, p.b) }}>
          <Dot data={wide.rows} x={p.a} y={p.b} r={2} fill="#3b6fd8" opacity={0.7} />
          <RegressionY data={wide.rows} x={p.a} y={p.b} stroke="red" confidence={0.95} />
        </Plot>
      </div>
    {/each}
  </div>
  {#if f}
    <p class="hint" data-export-skip>Brush the plot below to select perturbation samples and show their trajectories (P3).</p>
    <div class="two">
      <Plot height={300} grid inset={6} x={{ label: paramLabel(bundle, f.a) }} y={{ label: paramLabel(bundle, f.b) }}>
        <Dot data={wide.rows} x={f.a} y={f.b} r={3} fill={(d: any) => (inBrush(d) ? '#d62728' : '#999')} />
        {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
        <Brush bind:brush constrainToDomain stroke={false} />
      </Plot>
      {#if selTraj.length}
      <Plot height={300} grid x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Model FC of selected samples' }} color={{ legend: true }}>
        <Line data={selTraj} x="time" y="value" z={(d: any) => d.perturbation + d.state} stroke="state" strokeOpacity={0.6} />
      </Plot>
      {:else}<p class="hint" data-export-skip>No samples selected: drag a box on the left plot.</p>{/if}
    </div>
    <Selection ids={selected} label="perturbation samples selected" name={`perturbations_${protein}`} />
  {/if}
{/if}

<style>
  .grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .cell { padding: 0; border: 1px solid var(--pkv-border); background: var(--pkv-surface); border-radius: 4px; cursor: pointer; }
  .cell.on { border-color: var(--pkv-accent); box-shadow: 0 0 0 1px var(--pkv-accent); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .hint { font-size: 0.8rem; color: var(--pkv-ink-2); margin: 6px 0 0; }
</style>
