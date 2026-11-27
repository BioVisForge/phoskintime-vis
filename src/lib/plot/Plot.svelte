<!-- Plot used by every panel: SveltePlot's Plot plus the export spec (PlotView). `zoom` (true or a
     key) makes it zoomable on screen (ZoomGroup: Ctrl/⌘ + wheel, toolbar, keyboard, pan mode,
     linked or per-facet views). Exports show the full data range, or the view the user zoomed to
     when the export dialog's "export current view" is on. -->
<script lang="ts">
  import { getExportMode } from './context'
  import PlotView from './zoom/PlotView.svelte'
  import ZoomGroup from './zoom/ZoomGroup.svelte'
  import { withView } from './zoom/zoom.svelte'

  let { children, zoom = false, ...rest }: Record<string, any> = $props()
  const exp = getExportMode()
  // svelte-ignore state_referenced_locally
  const zkey = typeof zoom === 'string' ? zoom : String(rest.title ?? 'plot')
  // svelte-ignore state_referenced_locally
  const label = String(rest.title ?? 'plot')
  // svelte-ignore state_referenced_locally
  const saved = zoom && exp ? exp.views?.get(zkey) : undefined
  const facetOpts = (f: string) => ({ ...rest, fx: { ...rest.fx, domain: [f] } })
</script>

{#if zoom && !exp}
  <ZoomGroup opts={rest} {children} {zkey} {label} />
{:else if saved?.linked}
  <PlotView opts={withView(rest, saved.views.get(''))} {children} layer="clip" />
{:else if saved}
  <div style={`display:grid;gap:4px;grid-template-columns:repeat(${saved.facets.length}, minmax(0, 1fr))`}>
    {#each saved.facets as f (f)}
      <PlotView opts={withView(facetOpts(f), saved.views.get(f))} {children} layer={saved.views.has(f) ? 'clip' : 'none'} />
    {/each}
  </div>
{:else}
  <PlotView opts={rest} {children} />
{/if}
