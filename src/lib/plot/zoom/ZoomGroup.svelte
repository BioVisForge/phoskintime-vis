<!-- Screen side of a zoomable plot. Facets share their scales, so they zoom together ("link
     facets", the default); unlinked, each facet becomes its own plot (SveltePlot's fx domain
     restricted to that facet) with its own view. The views are published for "export current
     view". -->
<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte'
  import { ZoomState } from './zoom.svelte'
  import ZoomPlot from './ZoomPlot.svelte'
  import ZoomToolbar from './ZoomToolbar.svelte'
  import { publishViews, unpublishViews } from './views'
  import { getPanelId } from '../../ui/panelState'

  let { opts, children, zkey, label }: { opts: Record<string, any>; children?: Snippet; zkey: string; label: string } = $props()
  const panelId = getPanelId() ?? 'anon'
  const main = new ZoomState()
  const per = new Map<string, ZoomState>()
  const facetState = (f: string) => {
    let z = per.get(f)
    if (!z) {
      z = new ZoomState()
      z.view = { ...main.view } // unlinking does not move anything
      per.set(f, z)
    }
    return z
  }
  let linked = $state(true)
  let probe = $state<{ fx: unknown[] } | undefined>()
  // facet values (fx only: a plot faceted by fy as well keeps its facets linked)
  let facets = $state<string[]>([])
  $effect(() => {
    if (linked && probe) facets = probe.fx.filter((v) => v !== undefined && v !== null).map(String)
  })
  const canUnlink = $derived(facets.length > 1 && !opts.fy)
  const fxRaw = (f: string) => (probe?.fx ?? []).find((v) => String(v) === f)

  $effect(() => {
    const views = new Map<string, { x?: [number, number]; y?: [number, number] }>()
    if (linked) {
      if (main.zoomed) views.set('', $state.snapshot(main.view))
    } else for (const f of facets) if (facetState(f).zoomed) views.set(f, $state.snapshot(facetState(f).view))
    untrack(() => publishViews(panelId, zkey, { label, linked, facets: [...facets], views }))
  })
  onDestroy(() => unpublishViews(panelId, zkey))
</script>

{#snippet link()}
  {#if canUnlink || !linked}
    <button type="button" data-testid="zoom-link" aria-pressed={linked} title="Zoom all facets together (they share their scales) or each on its own" onclick={() => (linked = !linked)}>link facets</button>
  {/if}
{/snippet}

{#if linked}
  <ZoomPlot z={main} {opts} {children} {label} {zkey} extra={link} bind:probe />
{:else}
  <!-- one element: the group sits in its panel's layout grid as the linked plot did -->
  <div class="pkv-facet-group">
    <ZoomToolbar extra={link} />
    <div class="pkv-facet-row" style={`grid-template-columns: repeat(${facets.length}, minmax(0, 1fr))`}>
      {#each facets as f (f)}
        <ZoomPlot z={facetState(f)} opts={{ ...opts, fx: { ...opts.fx, domain: [fxRaw(f)] } }} {children} label={`${label} (${f})`} zkey={`${zkey}:${f}`} />
      {/each}
    </div>
  </div>
{/if}

<style>
  .pkv-facet-group { min-width: 0; }
  .pkv-facet-row { display: grid; gap: 4px; }
</style>
