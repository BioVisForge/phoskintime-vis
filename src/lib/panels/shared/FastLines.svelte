<script lang="ts">
  import { usePlot } from 'svelteplot'
  import { getExportMode, registerMark } from '../../plot'
  import { span } from '../../perf/spans'
  import { onDestroy } from 'svelte'
  import { cancelDraw, scaleSignature, scheduleDraw } from '../../plot/fast/frames'
  import { getZoom } from '../../plot/zoom/zoom.svelte'
  import { drawPreview, emptySnapshot, keepSnapshot } from '../../plot/zoom/preview'

  /**
   * Swappable drawing layer for very many polylines (P6 at 8,000+ series). It draws typed arrays
   * straight to a canvas through the parent Plot's scales, so the points never pass through
   * per-datum mark processing. Same props could be served by a WebGL implementation at 10k+
   * series. The parent Plot must set explicit x/y domains (this layer registers no data).
   * Gaps: a non-finite y breaks the line (nulls are gaps).
   *
   * Export: at most VECTOR_MAX points -> SVG path (vector); above -> canvas at the export
   * pixel ratio (re-rendered, never an upscaled screen bitmap).
   */
  let { xs, ys, starts, stroke = '#9aa3ad', opacity = 0.15, width = 0.6 }: { xs: Float64Array; ys: Float64Array; starts: Int32Array; stroke?: string; opacity?: number; width?: number } = $props()
  registerMark('FastLines', () => ({ xs, ys, starts, stroke, opacity, width }))
  const plot = usePlot()
  const exp = getExportMode()
  const vector = $derived(!!exp && xs.length <= exp.vectorMax)
  let canvas: HTMLCanvasElement | undefined = $state()

  function pathD(): string {
    const fx = plot.scales.x.fn as unknown as (v: number) => number
    const fy = plot.scales.y.fn as unknown as (v: number) => number
    let d = ''
    for (let s = 0; s < starts.length; s++) {
      const a = starts[s]
      const b = s + 1 < starts.length ? starts[s + 1] : xs.length
      let pen = false
      for (let i = a; i < b; i++) {
        if (!Number.isFinite(ys[i])) {
          pen = false
          continue
        }
        d += `${pen ? 'L' : 'M'}${fx(xs[i]).toFixed(2)},${fy(ys[i]).toFixed(2)}`
        pen = true
      }
    }
    return d
  }

  // the effect records what to draw (and tracks its dependencies); drawing happens once per frame
  // (src/lib/plot/fast/frames.ts): while a panel mounts its scales settle over several updates
  const key = {}
  const zoom = getZoom()
  const snap = emptySnapshot()
  const drawn: { sig: string; xs: unknown; ys: unknown; starts: unknown; el: unknown } = { sig: '', xs: null, ys: null, starts: null, el: null }
  $effect(() => {
    if (!canvas || vector) return
    void zoom?.interacting
    const job = {
      el: canvas,
      fx: plot.scales.x.fn as unknown as (v: number) => number,
      fy: plot.scales.y.fn as unknown as (v: number) => number,
      dpr: exp ? exp.pixelRatio : window.devicePixelRatio || 1,
      width: plot.width,
      height: plot.height,
      xs,
      ys,
      starts,
      stroke,
      opacity,
      lw: width,
    }
    // nothing that decides the pixels changed (new scale objects with the same values): skip
    const sig = scaleSignature(plot.scales, ['x', 'y'], [job.width, job.height, job.dpr, stroke, opacity, width])
    if (sig === drawn.sig && xs === drawn.xs && ys === drawn.ys && starts === drawn.starts && canvas === drawn.el) return
    // pan/zoom gesture: show the last bitmap mapped to the new scales; draw when it pauses
    if (zoom?.interacting && drawPreview(snap, canvas, plot.scales.x.fn as any, plot.scales.y.fn as any, job.dpr)) return cancelDraw(key)
    scheduleDraw(key, () =>
      span('canvas draw', `FastLines ${xs.length} pts`, () => {
        draw(job)
        Object.assign(drawn, { sig, xs: job.xs, ys: job.ys, starts: job.starts, el: job.el })
        if (zoom) keepSnapshot(snap, job.el, plot.scales.x.fn as any, plot.scales.y.fn as any, job.dpr)
      }),
    )
  })
  onDestroy(() => cancelDraw(key))

  function draw({ el, fx, fy, dpr, width: w, height: h, xs, ys, starts, stroke, opacity, lw }: { el: HTMLCanvasElement; fx: (v: number) => number; fy: (v: number) => number; dpr: number; width: number; height: number; xs: Float64Array; ys: Float64Array; starts: Int32Array; stroke: string; opacity: number; lw: number }) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = stroke
    ctx.globalAlpha = opacity
    ctx.lineWidth = lw
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
  }
</script>

{#if vector}
  <path d={pathD()} fill="none" stroke={stroke} stroke-opacity={opacity} stroke-width={width} />
{:else}
  <foreignObject x="0" y="0" width={plot.width} height={plot.height} pointer-events="none" data-raster-layer="fastlines" data-raster-elements={xs.length}>
    <canvas bind:this={canvas} style={`width:${plot.width}px;height:${plot.height}px;display:block`}></canvas>
  </foreignObject>
{/if}
