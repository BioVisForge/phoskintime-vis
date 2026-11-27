<!-- Wrapper: records the mark for exports, then renders SveltePlot's Raster. In export mode a
     raster of at most VECTOR_MAX cells is drawn as one Rect per cell (same fill channel and colour
     scale), so PDF/SVG exports stay vector and no viewer can smooth the cells. Assumes the
     panels' convention: x/y are cell indices (one unit per cell). -->
<script lang="ts">
  import { Raster as Mark, Rect } from 'svelteplot'
  import { getExportMode, registerMark } from './context'

  let props: Record<string, any> = $props()
  registerMark('Raster', () => props)
  const exp = getExportMode()
  const vector = $derived(!!exp && Array.isArray(props.data) && props.data.length <= exp.vectorMax && typeof props.x === 'string' && typeof props.y === 'string')
</script>

{#if vector}
  <Rect data={props.data} x1={(d: any) => d[props.x] - 0.5} x2={(d: any) => d[props.x] + 0.5} y1={(d: any) => d[props.y] - 0.5} y2={(d: any) => d[props.y] + 0.5} fill={props.fill} />
{:else}
  <Mark {...props as any} />
{/if}
