<script lang="ts">
  import { usePanelState } from '../../ui/panelState'
  import { untrack } from 'svelte'
  import { Plot, BarX, Dot, Text, Brush, Rect, RuleY } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import { paramLabel } from '../common'
  import Selection from './Selection.svelte'
  import Loading from '../Loading.svelte'

  let { bundle, report, workflow }: PanelProps & { workflow: 'protwise' | 'networkmodel' } = $props()
  const ps = usePanelState(untrack(() => bundle))
  let t = $state.raw<Table | null>(null)
  let key = $state(ps.get('key', ''))
  $effect(() => ps.set('key', key))
  let showConf = $state(ps.get('showConf', untrack(() => workflow === 'protwise')))
  $effect(() => ps.set('showConf', showConf))
  let brush = $state({ enabled: false } as { enabled: boolean; x1?: number; x2?: number; y1?: number; y2?: number })
  $effect(() => {
    bundle.table('sensitivity').then((x) => (t = x))
  })
  // protwise: one analysis per protein; networkmodel: one per output
  const keys = $derived(t ? [...new Set(workflow === 'protwise' ? str(t, 'protein') : str(t, 'output'))].filter(Boolean) as string[] : [])
  const k = $derived(keys.includes(key) ? key : keys[0])
  const rows = $derived.by(() => {
    if (!t) return []
    const K = workflow === 'protwise' ? str(t, 'protein') : str(t, 'output')
    const N = str(t, 'parameter'), MS = num(t, 'mu_star'), SG = num(t, 'sigma'), C = t.columns.mu_star_conf ? num(t, 'mu_star_conf') : null
    const out = []
    for (let i = 0; i < t.rows; i++) if (K[i] === k) out.push({ parameter: N[i]!, label: paramLabel(bundle, N[i]!), mu_star: MS[i], sigma: SG[i], conf: C ? C[i] : NaN })
    return out
  })
  // networkmodel _plot_sensitivity_indices: top 30 by mu*, horizontal bars, no error bars
  const bars = $derived([...rows].sort((a, b) => b.mu_star - a.mu_star).slice(0, workflow === 'networkmodel' ? 30 : rows.length))
  const total = $derived(rows.reduce((s, r) => s + r.mu_star, 0))
  const share = $derived(bars.map((r) => ({ ...r, share: (100 * r.mu_star) / total })))
  const long = $derived(bars.flatMap((r) => [{ label: r.label, index: 'μ*', value: r.mu_star }, { label: r.label, index: 'σ', value: r.sigma }]))
  const inB = (r: { mu_star: number; sigma: number }) => brush.enabled && r.mu_star >= brush.x1! && r.mu_star <= brush.x2! && r.sigma >= brush.y1! && r.sigma <= brush.y2!
  const selected = $derived(rows.filter(inB).map((r) => r.parameter))
  const h = $derived(Math.max(160, 16 * bars.length + 50))
  $effect(() => {
    report.rows = rows
    report.notes = workflow === 'protwise'
      ? ['Morris μ* (with μ* confidence as error bars), σ, and μ*–σ as in plot_model_perturbations. Its radar chart is replaced by grouped μ* and σ bars on a common axis, and its pie by μ* shares (% of Σμ*) as sorted bars (see docs/substitutions.md).']
      : ['Top 30 parameters by μ*, as _plot_sensitivity_indices draws them (without error bars; toggle to show μ*_conf). μ*–σ scatter added; brush it to list parameters.']
  })
</script>

{#if !t}<Loading />{:else}
  <label>{workflow === 'protwise' ? 'Protein' : 'Output'} <select value={k} onchange={(e) => (key = e.currentTarget.value)}>{#each keys as x}<option value={x}>{x}</option>{/each}</select></label>
  <label><input type="checkbox" bind:checked={showConf} /> μ* confidence</label>
  <div class="two">
    <Plot height={h} marginLeft={260} grid x={{ label: 'μ* (importance)' }} y={{ label: '', domain: bars.map((b) => b.label) }}>
      <BarX data={bars} x="mu_star" y="label" fill="#87ceeb" />
      {#if showConf}<RuleY data={bars.filter((b) => Number.isFinite(b.conf))} y="label" x1={(d: any) => d.mu_star - d.conf} x2={(d: any) => d.mu_star + d.conf} stroke="var(--pkv-ink)" />{/if}
    </Plot>
    <Plot height={h} marginLeft={260} grid x={{ label: 'σ (standard deviation of elementary effects)' }} y={{ label: '', domain: bars.map((b) => b.label) }}>
      <BarX data={bars} x="sigma" y="label" fill="orange" />
    </Plot>
  </div>
  <div class="two">
    <Plot height={300} grid inset={8} x={{ label: 'μ*' }} y={{ label: 'σ' }}>
      <Dot data={rows} x="mu_star" y="sigma" r={4} fill={(d: any) => (inB(d) ? '#d62728' : 'green')} title={(d: any) => d.label} />
      {#if rows.length <= 30}<Text data={rows} x="mu_star" y="sigma" text="parameter" dy={-8} fontSize={8} />{/if}
      {#if brush.enabled}<Rect {...brush} opacity={0.08} />{/if}
      <Brush bind:brush constrainToDomain stroke={false} />
    </Plot>
    {#if workflow === 'protwise'}
      <div>
        <Plot height={Math.max(140, 18 * bars.length + 60)} marginLeft={260} grid x={{ label: 'μ* and σ on one axis (replaces radar)' }} y={{ label: '', domain: bars.map((b) => b.label) }} color={{ legend: true }}>
          <RuleY data={bars} y="label" x1={(d: any) => Math.min(d.mu_star, d.sigma)} x2={(d: any) => Math.max(d.mu_star, d.sigma)} stroke="#ccc" />
          <Dot data={long} x="value" y="label" fill="index" r={4} />
        </Plot>
        <Plot height={Math.max(140, 18 * share.length + 60)} marginLeft={260} grid x={{ label: 'Share of Σμ* (%) (replaces pie)' }} y={{ label: '', domain: share.map((b) => b.label) }}>
          <BarX data={share} x="share" y="label" fill="#9370db" />
        </Plot>
      </div>
    {/if}
  </div>
  <Selection ids={selected} label="parameters in brush" name="sensitivity_selection" />
{/if}

<style>.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }</style>
