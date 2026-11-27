<script lang="ts">
  import { Plot, BarX, Text } from '../../plot'
  import type { PanelProps } from '../types'
  import type { Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    bundle.table('metrics').then((x) => (t = x))
  })
  const by = (m: string) => {
    if (!t) return []
    const P = str(t, 'protein'), M = str(t, 'metric'), V = num(t, 'value')
    const out = []
    for (let i = 0; i < t.rows; i++) if (M[i] === m && P[i]) out.push({ protein: P[i]!, value: V[i] })
    return out.sort((a, b) => b.value - a.value) // sorted descending, as plot_regularization / plot_model_error
  }
  const reg = $derived(by('regularization'))
  const mse = $derived(by('mse'))
  $effect(() => {
    report.rows = [...reg.map((r) => ({ ...r, metric: 'regularization' })), ...mse.map((r) => ({ ...r, metric: 'mse' }))]
  })
</script>

{#if !t}<Loading />{:else}
  <div class="two">
    {#each [['Regularization R = (λ/m) Σ p²', reg, 'skyblue'], ['MSE = (1/n) Σ (y − ŷ)²', mse, 'coral']] as [title, d, c]}
      {@const data = d as { protein: string; value: number }[]}
      {#if data.length}
        <Plot height={Math.max(140, 26 * data.length + 50)} marginLeft={90} grid title={title as string} x={{ label: 'value' }} y={{ label: 'Protein', domain: data.map((r) => r.protein) }}>
          <BarX data={data} x="value" y="protein" fill={c as string} stroke="var(--pkv-ink)" />
          <Text data={data} x="value" y="protein" text={(r: any) => r.value.toFixed(2)} textAnchor="start" dx={4} fontSize={9} />
        </Plot>
      {:else}<p class="na">No “{(title as string).split(' ')[0].toLowerCase()}” metric rows per protein in this bundle.</p>{/if}
    {/each}
  </div>
{/if}
<style>.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .na { color: var(--pkv-ink-2); font-size: 0.85rem; }</style>
