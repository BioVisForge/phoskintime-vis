<script lang="ts">
  import { Plot, Cell, Text } from 'svelteplot'
  import type { PanelProps } from '../types'
  import { loadPosterior } from './posterior'
  import { posteriorColumn } from '../../derive/trajectories'
  import { pearson } from '../../transforms/stats'
  import { parameterValues } from '../../derive/compare'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  let post = $state.raw<Awaited<ReturnType<typeof loadPosterior>> | null>(null)
  let params = $state.raw<Awaited<ReturnType<typeof parameterValues>> | null>(null)
  let group = $state('')
  $effect(() => {
    Promise.all([bundle.arrayEntry('posterior_draws') ? loadPosterior(bundle) : Promise.resolve(null), parameterValues(bundle)]).then(([p, q]) => {
      post = p
      params = q
    })
  })
  const groups = $derived(params ? [...new Set(params.map((p) => p.group).filter(Boolean))] as string[] : [])
  const g = $derived(groups.includes(group) ? group : (groups.find((x) => x === 'c_k') ?? groups[0]))
  // (1) within-group correlation across posterior draws (PhosKinTime: c_k across Pareto solutions)
  const across = $derived.by(() => {
    if (!post) return []
    const idx = post.names.map((n, j) => ({ n, j })).filter(({ n }) => params?.find((p) => p.name === n)?.group === g).slice(0, 40)
    const cols = idx.map(({ j }) => posteriorColumn(post!.arr, j))
    const out = []
    for (let a = 0; a < idx.length; a++) for (let b = 0; b < idx.length; b++) out.push({ x: idx[a].n, y: idx[b].n, r: a === b ? 1 : pearson(cols[a], cols[b]) })
    return out
  })
  // (2) gene-level groups correlated across proteins (export_param_correlations, best solution)
  const genes = $derived.by(() => {
    if (!params) return { cells: [], groups: [] as string[] }
    const byG = new Map<string, Map<string, number>>()
    const metaP = new Map(bundle.meta.parameters.map((p) => [p.name, p]))
    for (const p of params) {
      const prot = /\[([^\]_]+)\]$/.exec(p.name)?.[1]
      if (!p.group || !prot || metaP.get(p.name)?.group !== p.group) continue
      ;(byG.get(p.group) ?? byG.set(p.group, new Map()).get(p.group)!).set(prot, p.value)
    }
    // groups with one value per protein over a shared protein set
    // keep the largest family of groups indexed by the same entity set (e.g. A_i..E_i over proteins)
    const fam = new Map<string, [string, Map<string, number>][]>()
    for (const e of byG.entries()) {
      if (e[1].size < 5) continue
      const sig = [...e[1].keys()].sort().join('|')
      ;(fam.get(sig) ?? fam.set(sig, []).get(sig)!).push(e)
    }
    const best = [...fam.values()].sort((a, b) => b.length - a.length)[0] ?? []
    const use = best.length >= 2 ? best : []
    const common = use.length ? [...use[0][1].keys()] : []
    const cells = []
    for (const [a, ma] of use) for (const [b, mb] of use) cells.push({ x: a, y: b, r: pearson(common.map((k) => ma.get(k)!), common.map((k) => mb.get(k)!)) })
    return { cells, groups: use.map(([k]) => k), n: common.length }
  })
  $effect(() => {
    report.rows = [...across.map((c) => ({ kind: 'across draws', ...c })), ...genes.cells.map((c) => ({ kind: 'across proteins', ...c }))]
    report.notes = [
      'Left: Pearson correlation between parameters of one group across posterior draws. PhosKinTime correlates c_k across Pareto solutions, which this bundle does not contain, so this uses posterior draws instead (substitution).',
      'Right: correlation of per-protein parameter groups across proteins in the best fit, as export_param_correlations does. Groups are recognised from the manifest’s group field and the “[protein]” name suffix only.',
    ]
  })
</script>

{#if !params}<Loading />{:else}
  <label>Group <select value={g} onchange={(e) => (group = e.currentTarget.value)}>{#each groups as x}<option value={x}>{x}</option>{/each}</select></label>
  <div class="two">
    {#if post}
      <Plot height={420} marginLeft={110} marginBottom={90} x={{ label: '', tickRotate: -60 }} y={{ label: '' }} color={{ type: 'diverging', scheme: 'rdbu', domain: [-1, 1], legend: true, label: 'Pearson r', reverse: true }}>
        <Cell data={across} x="x" y="y" fill="r" />
      </Plot>
    {:else}<p>No posterior draws in this bundle.</p>{/if}
    {#if genes.groups.length}
      <Plot height={320} marginLeft={60} x={{ label: '' }} y={{ label: '' }} color={{ type: 'diverging', scheme: 'rdbu', domain: [-1, 1], legend: true, label: 'Pearson r', reverse: true }}>
        <Cell data={genes.cells} x="x" y="y" fill="r" />
        <Text data={genes.cells} x="x" y="y" text={(d: any) => d.r.toFixed(2)} fontSize={10} />
      </Plot>
    {/if}
  </div>
{/if}
<style>.two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; }</style>
