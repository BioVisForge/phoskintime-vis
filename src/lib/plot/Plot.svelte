<script lang="ts">
  import { Plot } from 'svelteplot'
  import { getExportMode, registerPlot } from './context'
  import ScaleProbe from './ScaleProbe.svelte'
  import ZoomLayer from './zoom/ZoomLayer.svelte'
  import { ZoomState, setZoom } from './zoom/zoom.svelte'

  /**
   * `zoom`: pan and zoom on screen (true), or 'brush' when the plot also has a Brush (dragging
   * then brushes until pan mode is switched on). Exports always show the full data range.
   */
  let { children, zoom = false, ...rest }: Record<string, any> = $props()
  const spec = registerPlot(() => rest)
  const exporting = !!getExportMode()
  // svelte-ignore state_referenced_locally
  const z = zoom && !exporting ? new ZoomState(zoom === 'brush') : undefined
  if (z) setZoom(z)
  const opts = $derived(z?.zoomed ? { ...rest, x: { ...rest.x, ...(z.view.x ? { domain: z.view.x } : {}) }, y: { ...rest.y, ...(z.view.y ? { domain: z.view.y } : {}) } } : rest)
  /** zoom by k around the frame centre (toolbar buttons) */
  function step(k: number) {
    z!.touch()
    z!.zoomAt(probe!.x, probe!.y, centre(probe!.x), centre(probe!.y), k)
  }
  const centre = (s: { fn: { range(): number[] } }) => {
    const [a, b] = s.fn.range()
    return (a + b) / 2
  }
  let probe: { x: any; y: any } | undefined = $state()
</script>

{#if z}
  <div class="pkv-zoomwrap" data-zoomed={z.zoomed}>
    <div class="pkv-zoombar" role="toolbar" aria-label="Zoom" data-export-skip>
      <button type="button" data-testid="zoom-in" title="Zoom in (or Ctrl/⌘ + wheel over the plot)" aria-label="Zoom in" onclick={() => step(1.5)}>+</button>
      <button type="button" data-testid="zoom-out" title="Zoom out" aria-label="Zoom out" onclick={() => step(1 / 1.5)}>−</button>
      {#if z.hasBrush}
        <button type="button" data-testid="zoom-pan" aria-pressed={z.mode === 'pan'} title="Drag to pan instead of brushing" onclick={() => (z.mode = z.mode === 'pan' ? 'brush' : 'pan')}>pan</button>
      {/if}
      <button type="button" data-testid="zoom-reset" title="Full data range (double-click the plot in pan mode)" disabled={!z.zoomed} onclick={() => z.reset()}>reset</button>
    </div>
    <Plot {...opts}>
      {@render children?.()}
      {#if spec}<ScaleProbe {spec} />{/if}
      <ZoomLayer bind:probe />
    </Plot>
  </div>
{:else}
  <Plot {...rest}>
    {@render children?.()}
    {#if spec}<ScaleProbe {spec} />{/if}
  </Plot>
{/if}

<style>
  .pkv-zoomwrap { position: relative; }
  .pkv-zoombar { position: absolute; top: 0; right: 0; z-index: 2; display: flex; gap: 2px; opacity: 0.55; transition: opacity 0.15s; }
  .pkv-zoomwrap:hover .pkv-zoombar, .pkv-zoombar:focus-within { opacity: 1; }
  .pkv-zoombar button { font: inherit; font-size: 0.72rem; line-height: 1; padding: 2px 6px; min-width: 22px; border: 1px solid var(--pkv-rule, #ccc); background: var(--pkv-surface, #fff); color: var(--pkv-ink); border-radius: 3px; cursor: pointer; }
  .pkv-zoombar button[aria-pressed='true'] { background: var(--pkv-ink); color: var(--pkv-surface, #fff); }
  .pkv-zoombar button:disabled { opacity: 0.45; cursor: default; }
</style>
