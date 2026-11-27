<!-- A zoomable plot: its zoom state (context for the zoom layer, the brush and the canvas
     layers), the toolbar, and the keyboard (+/− zoom, arrow keys pan, 0 resets) when focused. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { setZoom, withView, type ZoomState } from './zoom.svelte'
  import PlotView from './PlotView.svelte'
  import ZoomToolbar from './ZoomToolbar.svelte'

  let {
    z,
    opts,
    children,
    label,
    zkey = '',
    extra,
    probe = $bindable(),
  }: { z: ZoomState; opts: Record<string, any>; children?: Snippet; label: string; zkey?: string; extra?: Snippet; probe?: any } = $props()
  // svelte-ignore state_referenced_locally
  setZoom(z)
  const applied = $derived(withView(opts, z.view))
  const step = (k: string) => {
    if (probe) z.key(k, probe.x, probe.y)
  }
  function onkeydown(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || !probe) return
    if (z.key(ev.key, probe.x, probe.y)) ev.preventDefault()
  }
</script>

<!-- a focusable group with keyboard shortcuts (+/−, arrows, 0), named by aria-label -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="pkv-zoomwrap" data-zoom-key={zkey} data-zoomed={z.zoomed} data-view={JSON.stringify(z.view)} tabindex="0" role="group" aria-label={`${label}: zoomable plot. Plus and minus zoom, arrow keys pan, 0 resets.`} {onkeydown}>
  <ZoomToolbar {z} {step} {extra} />
  <PlotView opts={applied} {children} layer="interactive" bind:probe />
</div>

<style>
  .pkv-zoomwrap { position: relative; min-width: 0; }
  .pkv-zoomwrap:focus-visible { outline: 2px solid var(--pkv-accent, #0072b2); outline-offset: 2px; }
</style>
