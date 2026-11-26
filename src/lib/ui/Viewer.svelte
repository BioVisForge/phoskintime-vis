<script lang="ts">
  import type { LoadedBundle } from '../model/bundle'
  import { PANELS } from '../panels/registry'
  import { availability } from '../panels/availability'
  import PanelFrame from '../panels/PanelFrame.svelte'
  import BundleHeader from './BundleHeader.svelte'

  let { bundle }: { bundle: LoadedBundle } = $props()
  const panels = $derived(PANELS.filter((p) => p.workflow === 'any' || bundle.meta.workflows.includes(p.workflow)))
  const sections = $derived([...new Set(panels.map((p) => p.section))])
  let only = $state<string>('')
</script>

<BundleHeader {bundle} />
<nav class="toc">
  {#each sections as s}<a href={`#sec-${s}`}>{s}</a>{/each}
  <span class="count">{panels.filter((p) => availability(p, bundle).ok).length}/{panels.length} panels available</span>
  <label>Show only <select bind:value={only}><option value="">all panels</option>{#each panels as p}<option value={p.id}>{p.title}</option>{/each}</select></label>
</nav>
{#each sections as s}
  {@const list = panels.filter((p) => p.section === s && (!only || p.id === only))}
  {#if list.length}
    <h2 id={`sec-${s}`}>{s}</h2>
    {#each list as def (def.id + bundle.meta.bundleId)}<PanelFrame {def} {bundle} />{/each}
  {/if}
{/each}

<style>
  .toc { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.85rem; align-items: center; position: sticky; top: 0; background: #f4f5f7; padding: 6px 0; z-index: 5; }
  .count { color: #666; margin-left: auto; }
  h2 { font-size: 1.1rem; margin: 18px 0 4px; border-bottom: 1px solid #ccd; }
</style>
