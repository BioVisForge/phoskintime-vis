<script lang="ts">
  import type { Snippet } from 'svelte'
  import { download, figureToPng, figureToSvg } from '../export/figure'
  import { toCsv } from '../transforms/table'
  import RawRows from '../ui/RawRows.svelte'

  let { id, title, patterns = [], rows = [], note = '', children }: { id: string; title: string; patterns?: string[]; rows?: Record<string, unknown>[]; note?: string; children: Snippet } = $props()
  let fig: HTMLElement | undefined = $state()
  let raw = $state(false)
</script>

<section class="cs" data-compare-section={id}>
  <header><h3>{title}</h3>{#each patterns as p}<span class="pat">{p}</span>{/each}</header>
  <div class="fig" bind:this={fig} data-figure={id}>{@render children()}</div>
  {#if note}<p class="note">{note}</p>{/if}
  <div class="tools">
    <button onclick={() => (raw = !raw)}>{raw ? 'Hide' : 'Show'} rows ({rows.length})</button>
    <button onclick={() => fig && download(`compare_${id}.svg`, figureToSvg(fig).svg, 'image/svg+xml')}>SVG</button>
    <button onclick={async () => fig && download(`compare_${id}.png`, await figureToPng(fig))}>PNG</button>
    <button onclick={() => download(`compare_${id}.csv`, toCsv(rows), 'text/csv')}>CSV</button>
  </div>
  {#if raw}<RawRows {rows} />{/if}
</section>

<style>
  .cs { border: 1px solid #d6d9de; border-radius: 6px; padding: 10px 14px; margin: 12px 0; background: #fff; }
  header { display: flex; gap: 6px; align-items: baseline; }
  h3 { margin: 0 8px 4px 0; font-size: 1rem; }
  .pat { font-size: 0.7rem; padding: 1px 6px; border-radius: 9px; background: #f0f0f0; font-family: monospace; }
  .note { background: #fff6dd; border-left: 3px solid #e0a800; margin: 6px 0; padding: 4px 8px; font-size: 0.82rem; }
  .tools { display: flex; gap: 4px; justify-content: flex-end; font-size: 0.75rem; }
  .fig { overflow-x: auto; }
  .fig :global(h2) { font-size: 0.82rem; font-weight: 600; margin: 2px 0; }
</style>
