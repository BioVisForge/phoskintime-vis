<script lang="ts">
  import { Plot, Cell } from 'svelteplot'
  import type { PanelProps } from '../types'
  import type { NpyArray, Table } from '../../model/types'
  import { num, str } from '../../transforms/table'
  import Loading from '../Loading.svelte'

  let { bundle, report }: PanelProps = $props()
  const names = $derived(bundle.meta.files.filter((f) => f.kind === 'array' && f.array?.name?.startsWith('matrix_')).map((f) => f.array!.name!))
  let name = $state('')
  $effect(() => {
    if (!name && names.length) name = names[0]
  })
  let arr = $state.raw<NpyArray | null>(null)
  let labels = $state.raw<Table | null>(null)
  let maxRows = $state(80)
  $effect(() => {
    if (!name) return
    Promise.all([bundle.array(name), bundle.hasTable('matrix_labels') ? bundle.table('matrix_labels') : Promise.resolve(null)]).then(([a, l]) => {
      arr = a
      labels = l
    })
  })
  const lab = (axis: number, pos: number) => {
    if (!labels) return String(pos)
    const M = str(labels, 'matrix'), A = num(labels, 'axis'), P = num(labels, 'position'), L = str(labels, 'label')
    for (let i = 0; i < labels.rows; i++) if (M[i] === name && A[i] === axis && P[i] === pos) return L[i]!
    return String(pos)
  }
  const cells = $derived.by(() => {
    if (!arr || arr.shape.length !== 2) return []
    const [R, C] = arr.shape
    const out = []
    for (let i = 0; i < Math.min(R, maxRows); i++) for (let j = 0; j < C; j++) {
      const v = Number(arr.data[arr.fortranOrder ? j * R + i : i * C + j])
      if (v !== 0) out.push({ row: lab(0, i), col: lab(1, j), value: v }) // sparse: only non-zeros are cells
    }
    return out
  })
  $effect(() => {
    report.rows = cells
    report.notes = ['Viewer extra (PhosKinTime has no matrix heatmap). Sparse matrix: only non-zero entries are drawn, as cells (Cell, not Raster), so empty entries stay empty instead of being coloured as zero.']
  })
</script>

{#if !arr}<Loading />{:else}
  <label>Matrix <select bind:value={name}>{#each names as n}<option value={n}>{n} ({bundle.arrayEntry(n)?.array?.axes?.join(' × ')})</option>{/each}</select></label>
  <label>Rows shown <input type="number" min="10" max="400" bind:value={maxRows} style="width:5em" /> of {arr.shape[0]}</label>
  <Plot height={Math.max(200, 9 * Math.min(arr.shape[0], maxRows) + 90)} marginLeft={100} marginBottom={60} x={{ label: arr && bundle.arrayEntry(name)?.array?.axes?.[1], tickRotate: -60 }} y={{ label: bundle.arrayEntry(name)?.array?.axes?.[0] }} color={{ scheme: 'blues', legend: true, label: 'weight' }}>
    <Cell data={cells} x="col" y="row" fill="value" />
  </Plot>
{/if}
