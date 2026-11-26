<script lang="ts">
  import { tick } from 'svelte'
  import type { LoadedBundle } from '../model/bundle'
  import { app, SECTIONS } from './state.svelte'
  import { PANELS } from '../panels/registry'
  import PanelCard from '../panels/PanelCard.svelte'
  import { openExport } from '../export/actions'

  let { bundle }: { bundle: LoadedBundle } = $props()
  const section = $derived(SECTIONS.find((s) => s.id === app.route.section)!)
  const panels = $derived(
    PANELS.filter((p) => p.topic === app.route.section && (p.workflow === 'any' || bundle.meta.workflows.includes(p.workflow)) && (!app.workflowFilter.length || p.workflow === 'any' || app.workflowFilter.includes(p.workflow)) && (!app.route.params.only || p.id === app.route.params.only)),
  )
  // deep link: scroll the requested panel into view
  $effect(() => {
    const id = app.route.panel
    if (!id) return
    tick().then(() => document.getElementById(`panel-${id}`)?.scrollIntoView({ block: 'start' }))
  })
</script>

<header class="sh">
  <h1>{section.label}</h1>
  <p>{section.hint}</p>
  <button onclick={() => openExport(panels.map((p) => p.id))} disabled={!panels.length}>Export section…</button>
</header>
{#if !panels.length}
  <p class="empty">No panels in this section for a {bundle.meta.workflows.join('/')} bundle{app.workflowFilter.length ? ' with the current workflow filter' : ''}.</p>
{/if}
{#each panels as def (def.id + bundle.meta.bundleId)}<PanelCard {def} {bundle} />{/each}

<style>
  .sh { display: flex; align-items: baseline; gap: var(--pkv-space-3); flex-wrap: wrap; margin-bottom: var(--pkv-space-3); }
  h1 { font-size: 1.35rem; margin: 0; letter-spacing: -0.01em; }
  .sh p { margin: 0; color: var(--pkv-ink-2); font-size: var(--pkv-text-sm); flex: 1; }
  .empty { color: var(--pkv-ink-2); }
</style>
