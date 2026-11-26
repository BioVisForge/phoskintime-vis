<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark. -->
<script lang="ts">
  import { Dot as Mark } from 'svelteplot'
  import { registerMark, useCanvas } from './context'

  let props: Record<string, any> = $props()
  registerMark('Dot', () => props)
  const canvas = $derived(useCanvas(props.canvas, Array.isArray(props.data) ? props.data.length : 0))
</script>

<Mark {...props as any} {canvas} />
