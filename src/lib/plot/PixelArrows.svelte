<script lang="ts">
  import { usePlot } from 'svelteplot'
  import Vector from './Vector.svelte'

  /**
   * Direction-of-time arrows (P11). The angle is computed in PIXEL space from the plot's scales,
   * so the arrow points along the drawn path even when x and y have different scales (a
   * data-space atan2(dx, dy) would be distorted). Input: finite-difference segments
   * {x0, y0, x1, y1, x, y} where (x, y) is the anchor (segment midpoint).
   */
  let { data, length = 12, stroke = '#444' }: { data: { x0: number; y0: number; x1: number; y1: number; x: number; y: number }[]; length?: number; stroke?: string } = $props()
  const plot = usePlot()
  const rotated = $derived.by(() => {
    const fx = plot.scales.x?.fn as unknown as ((v: number) => number) | undefined
    const fy = plot.scales.y?.fn as unknown as ((v: number) => number) | undefined
    if (!fx || !fy) return []
    // screen y grows downwards; rotate is clockwise from north
    return data.map((d) => ({ ...d, rot: (Math.atan2(fx(d.x1) - fx(d.x0), -(fy(d.y1) - fy(d.y0))) * 180) / Math.PI }))
  })
</script>

<Vector data={rotated} x="x" y="y" rotate="rot" length={() => length} {stroke} anchor="middle" />
