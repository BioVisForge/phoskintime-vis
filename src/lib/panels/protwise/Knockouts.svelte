<script lang="ts">
  import { app, pick } from '../../ui/state.svelte'
  import { TIME_TICKS } from '../common'
  import { Plot, Line, DifferenceY, CustomMark } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  const protein = $derived(pick(app.ctx.protein, t ? ([...new Set(str(t, 'protein'))].filter(Boolean) as string[]) : []))
  $effect(() => {
    bundle.table('knockouts').then((x) => {
      t = x
    })
  })
  const all = $derived.by(() => {
    if (!t) return []
    const P = str(t, 'protein'), K = str(t, 'knockout'), S = str(t, 'state'), T = num(t, 'time'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (P[i] === protein) out.push({ knockout: K[i]!, state: S[i]!, time: T[i], value: Number.isFinite(V[i]) ? V[i] : null })
    return out
  })
  const wtName = $derived(all.some((r) => r.knockout === 'wild_type') ? 'wild_type' : all.some((r) => r.knockout === 'WT') ? 'WT' : null)
  // pair each knockout with the wild type on the same state and exact time (continuous model series)
  const pairs = $derived.by(() => {
    if (!wtName) return []
    const wt = new Map(all.filter((r) => r.knockout === wtName).map((r) => [`${r.state}|${r.time}`, r.value]))
    return all.filter((r) => r.knockout !== wtName && wt.has(`${r.state}|${r.time}`)).map((r) => ({ ...r, wt: wt.get(`${r.state}|${r.time}`)!, ko: r.value }))
  })
  const kos = $derived([...new Set(pairs.map((p) => p.knockout))])
  $effect(() => {
    report.rows = pairs
    report.notes = wtName
      ? ['Shaded: y1 = wild type (grey line), y2 = knockout (black line). Red where knockout > wild type, blue where knockout < wild type. Both are model outputs on the same time grid; x is symlog so early and late points are both visible (PhosKinTime splits at index 8).']
      : ['No wild-type series (knockout = “wild_type” or “WT”) in this bundle, so differences cannot be shown.']
  })
</script>

{#if !t}<Loading />{:else}
  <div class="grid">
    {#each kos as ko}
      {#each [...new Set(pairs.map((p) => p.state))] as st}
        {@const d = pairs.filter((p) => p.knockout === ko && p.state === st)}
        <div>
          <Plot height={200} width={340} grid title={`${ko} · ${st}`} x={{ type: 'symlog', ticks: TIME_TICKS, label: 'Time (min), symlog' }} y={{ label: 'Model FC' }}>
            <DifferenceY data={d} x="time" y1="wt" y2="ko" positiveFill="#d6604d" negativeFill="#4393c3" fillOpacity={0.4} />
            <Line data={d} x="time" y="wt" stroke="#888" strokeWidth={1.5} />
            <Line data={d} x="time" y="ko" stroke="var(--pkv-ink)" strokeWidth={1.5} />
            <!-- P4: knockout glyph at the first time point -->
            <CustomMark glyph="cross" data={d.slice(0, 1)} x="time" y="ko">
              {#snippet mark({ record }: any)}
                <g transform={`translate(${record.x}, ${record.y})`}><path d="M-5,-5L5,5M-5,5L5,-5" stroke="#b00" stroke-width="2.5" /><title>knockout: {ko}</title></g>
              {/snippet}
            </CustomMark>
          </Plot>
        </div>
      {/each}
    {/each}
  </div>
{/if}
<style>.grid { display: flex; flex-wrap: wrap; gap: 6px; }</style>
