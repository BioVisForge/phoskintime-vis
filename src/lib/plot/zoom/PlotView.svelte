<!-- One SveltePlot plot: records its spec for exports (TikZ), probes its scales, and adds the zoom
     layer: interactive on screen, clip-only in an export of the current view. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Plot } from 'svelteplot'
  import { registerPlot } from '../context'
  import ScaleProbe from '../ScaleProbe.svelte'
  import ZoomLayer from './ZoomLayer.svelte'

  let {
    opts,
    children,
    layer = 'none',
    probe = $bindable(),
  }: { opts: Record<string, any>; children?: Snippet; layer?: 'none' | 'interactive' | 'clip'; probe?: any } = $props()
  const spec = registerPlot(() => opts)
</script>

<Plot {...opts}>
  {@render children?.()}
  {#if spec}<ScaleProbe {spec} />{/if}
  {#if layer === 'interactive'}<ZoomLayer bind:probe />{:else if layer === 'clip'}<ZoomLayer interactive={false} clip />{/if}
</Plot>
