<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark.
     On screen, a canvas Dot with simple channels is drawn by the fast layer (fast/FastDots.svelte);
     exports always use SveltePlot's mark, so PDF/SVG/TikZ output is unchanged. -->
<script lang="ts">
  import { Dot as Mark } from 'svelteplot'
  import { getExportMode, registerMark, useCanvas } from './context'
  import { fastDotsSupported } from './fast/dots'
  import { fastLayersEnabled } from './fast/mode'
  import FastDots from './fast/FastDots.svelte'

  let props: Record<string, any> = $props()
  registerMark('Dot', () => props)
  const exporting = !!getExportMode()
  const canvas = $derived(useCanvas(props.canvas, Array.isArray(props.data) ? props.data.length : 0))
  const fast = $derived(!exporting && canvas && fastLayersEnabled() && fastDotsSupported(props))
</script>

{#if fast}
  <FastDots {props} />
{:else}
  <Mark {...props as any} {canvas} />
{/if}
