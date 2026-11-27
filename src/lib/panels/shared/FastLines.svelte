<script lang="ts">
  import { usePlot } from 'svelteplot'

  /**
   * Swappable drawing layer for very many polylines (P6 at 8,000+ series). It draws typed arrays
   * straight to a canvas through the parent Plot's scales, so the points never pass through
   * per-datum mark processing. Same props could be served by a WebGL implementation at 10k+
   * series. The parent Plot must set explicit x/y domains (this layer registers no data).
   * Gaps: a non-finite y breaks the line (nulls are gaps).
   */
  let { xs, ys, starts, stroke = '#9aa3ad', opacity = 0.15, width = 0.6 }: { xs: Float64Array; ys: Float64Array; starts: Int32Array; stroke?: string; opacity?: number; width?: number } = $props()
  const plot = usePlot()
  let canvas: HTMLCanvasElement | undefined = $state()

  $effect(() => {
    if (!canvas) return
    const fx = plot.scales.x.fn as unknown as (v: number) => number
    const fy = plot.scales.y.fn as unknown as (v: number) => number
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(plot.width * dpr)
    canvas.height = Math.round(plot.height * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, plot.width, plot.height)
    ctx.strokeStyle = stroke
    ctx.globalAlpha = opacity
    ctx.lineWidth = width
    ctx.beginPath()
    for (let s = 0; s < starts.length; s++) {
      const a = starts[s]
      const b = s + 1 < starts.length ? starts[s + 1] : xs.length
      let pen = false
      for (let i = a; i < b; i++) {
        if (!Number.isFinite(ys[i])) {
          pen = false
          continue
        }
        const X = fx(xs[i])
        const Y = fy(ys[i])
        if (pen) ctx.lineTo(X, Y)
        else ctx.moveTo(X, Y)
        pen = true
      }
    }
    ctx.stroke()
  })
</script>

<foreignObject x="0" y="0" width={plot.width} height={plot.height} pointer-events="none">
  <canvas bind:this={canvas} style={`width:${plot.width}px;height:${plot.height}px;display:block`}></canvas>
</foreignObject>
