<!-- The one zoom toolbar (every zoomable plot): zoom in/out, pan mode (plots with a brush),
     reset, and an optional extra control (link facets). Labels keep WCAG AA contrast in both
     themes: full opacity, ink on surface. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { ZoomState } from './zoom.svelte'

  /** without `z`: only the extra control (the facet row's "link facets") */
  let { z, step, extra }: { z?: ZoomState; step?: (k: string) => void; extra?: Snippet } = $props()
</script>

<div class="pkv-zoombar" role="toolbar" aria-label="Zoom" data-export-skip>
  {#if z && step}
    <button type="button" data-testid="zoom-in" title="Zoom in (+, or Ctrl/⌘ + wheel over the plot)" aria-label="Zoom in" onclick={() => step('+')}>+</button>
    <button type="button" data-testid="zoom-out" title="Zoom out (−)" aria-label="Zoom out" onclick={() => step('-')}>−</button>
    {#if z.hasBrush}
      <button type="button" data-testid="zoom-pan" aria-pressed={z.mode === 'pan'} title="Drag to pan instead of brushing" onclick={() => (z.mode = z.mode === 'pan' ? 'brush' : 'pan')}>pan</button>
    {/if}
    <button type="button" data-testid="zoom-reset" title="Full data range (0, or double-click the plot in pan mode)" disabled={!z.zoomed} onclick={() => z.reset()}>reset</button>
  {/if}
  {@render extra?.()}
</div>

<style>
  /* a row above the plot (not over it: legends and titles stay readable) */
  .pkv-zoombar { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 2px; margin: 0 0 2px; }
  .pkv-zoombar :global(button) { font: inherit; font-size: 0.72rem; line-height: 1; padding: 2px 6px; min-width: 22px; border: 1px solid var(--pkv-rule, #ccc); background: var(--pkv-surface, #fff); color: var(--pkv-ink); border-radius: 3px; cursor: pointer; white-space: nowrap; }
  .pkv-zoombar :global(button[aria-pressed='true']) { background: var(--pkv-ink); color: var(--pkv-surface, #fff); }
  .pkv-zoombar :global(button:disabled) { color: var(--pkv-ink-2); cursor: default; }
</style>
