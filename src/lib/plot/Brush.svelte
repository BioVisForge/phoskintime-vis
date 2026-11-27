<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark. -->
<script lang="ts">
  import { Brush as Mark } from 'svelteplot'
  import { onDestroy } from 'svelte'
  import { getExportMode, registerMark } from './context'
  import { getZoom } from './zoom/zoom.svelte'

  let { brush = $bindable(), ...rest }: Record<string, any> = $props()
  registerMark('Brush', () => ({ brush, ...rest }))
  const exporting = !!getExportMode()
  // a zoomable plot with a brush starts in brush mode and offers "pan" in its toolbar
  const zoom = getZoom()
  if (zoom && !exporting) {
    zoom.brushes++
    onDestroy(() => zoom.brushes--)
  }
</script>

<!-- interaction only: not drawn in exports -->
{#if !exporting}<Mark bind:brush {...rest} />{/if}
