<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark. -->
<script lang="ts">
  import { Rect as Mark } from 'svelteplot'
  import { registerMark } from './context'

  let props: Record<string, any> = $props()
  registerMark('Rect', () => props)
</script>

<Mark {...props as any} />
