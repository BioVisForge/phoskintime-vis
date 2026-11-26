<script lang="ts">
  import { Plot } from 'svelteplot'
  import { registerPlot } from './context'
  import ScaleProbe from './ScaleProbe.svelte'

  let { children, ...rest }: Record<string, any> = $props()
  const spec = registerPlot(() => rest)
</script>

<Plot {...rest}>
  {@render children?.()}
  {#if spec}<ScaleProbe {spec} />{/if}
</Plot>
