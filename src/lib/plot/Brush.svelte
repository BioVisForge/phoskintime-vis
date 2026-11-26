<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark. -->
<script lang="ts">
  import { Brush as Mark } from 'svelteplot'
  import { getExportMode, registerMark } from './context'

  let { brush = $bindable(), ...rest }: Record<string, any> = $props()
  registerMark('Brush', () => ({ brush, ...rest }))
  const exporting = !!getExportMode()
</script>

<!-- interaction only: not drawn in exports -->
{#if !exporting}<Mark bind:brush {...rest} />{/if}
