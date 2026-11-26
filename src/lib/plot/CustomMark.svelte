<!-- GENERATED wrapper (see src/lib/plot/README in index.ts): records the mark for exports, then renders SveltePlot's mark. -->
<script lang="ts">
  import { CustomMark as Mark } from 'svelteplot'
  import { untrack } from 'svelte'
  import { registerMark } from './context'

  /** glyph: how exporters should draw this mark ('ring' | 'cross' | 'triangle'). */
  let { glyph, ...props }: Record<string, any> = $props()
  registerMark('CustomMark', () => props, untrack(() => glyph))
</script>

<Mark {...props as any} />
