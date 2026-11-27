<!-- Fast dot layer for the screen (see dots.ts). SveltePlot gets the proxy rows through its own
     Dot (invisible), so scales, legends and facets are built exactly as for the full data; this
     component then draws every row on a canvas the way SveltePlot's DotCanvas does (same path,
     same alpha and stroke order), with colours resolved once instead of once per dot. -->
<script lang="ts">
  import { getContext, onDestroy } from 'svelte'
  import { Dot as Mark, usePlot } from 'svelteplot'
  import { projectX, projectY } from 'svelteplot/helpers/scales.js'
  import { isValid } from 'svelteplot/helpers/index.js'
  import { resolveColor } from 'svelteplot/marks/helpers/canvas.js'
  import { devicePixelRatio } from 'svelte/reactivity/window'
  import { facetRows, proxyIndices, resolveColumns } from './dots'
  import { cancelDraw, scheduleDraw } from './frames'
  import { span } from '../../perf/spans'

  let { props }: { props: Record<string, any> } = $props()
  const plot = usePlot()
  const facetCtx = getContext('svelteplot/facet') as { getFacetState?: () => { fx: unknown; fy: unknown } } | undefined
  // read reactively: a facet's value is assigned after its children mount
  const facet = $derived(facetCtx?.getFacetState?.())
  const cols = $derived(resolveColumns(props.data, props))
  const proxy = $derived(proxyIndices(cols).map((i) => props.data[i]))
  const rows = $derived(facetRows(cols, facet?.fx, facet?.fy))
  let canvas: HTMLCanvasElement | undefined = $state()
  // CSS variables (var(--pkv-ink)) change with the theme: repaint when <html> attributes change
  let theme = $state(0)
  $effect(() => {
    const o = new MutationObserver(() => theme++)
    o.observe(document.documentElement, { attributes: true })
    return () => o.disconnect()
  })

  // the effect records what to draw (and tracks its dependencies); drawing happens once per frame
  const key = {}
  $effect(() => {
    void theme
    if (!canvas || !plot.scales) return
    const job: Job = {
      el: canvas,
      dpr: devicePixelRatio.current ?? 1,
      width: plot.width,
      height: plot.height,
      scales: plot.scales,
      unknown: (plot.options as any).color?.unknown,
      cols,
      rows,
      p: { fill: props.fill, stroke: props.stroke, r: props.r, opacity: props.opacity, fillOpacity: props.fillOpacity, strokeOpacity: props.strokeOpacity, strokeWidth: props.strokeWidth },
    }
    scheduleDraw(key, () => span('canvas draw', 'FastDots', () => draw(job)))
  })
  onDestroy(() => cancelDraw(key))

  type Job = { el: HTMLCanvasElement; dpr: number; width: number; height: number; scales: any; unknown: unknown; cols: ReturnType<typeof resolveColumns>; rows: Int32Array; p: Record<string, any> }

  function draw({ el, dpr, width, height, scales, unknown, cols, rows, p }: Job) {
    el.width = width * dpr
    el.height = height * dpr
    const ctx = el.getContext('2d')!
    const colorFn = scales.color.fn as (v: unknown) => string
    const cache = new Map<unknown, string>()
    const css = (c: unknown) => {
      let v = cache.get(c)
      if (v === undefined) cache.set(c, (v = resolveColor((c ?? 'none') as string, el) as string))
      return v
    }
    const colour = (field: unknown[] | null, literal: unknown, i: number) => (field ? css(isValid(field[i] as any) ? colorFn(field[i]) : unknown) : css(literal))
    const { x, y, fill, stroke } = cols
    const r = p.r ?? 3
    const size = r * r * Math.PI
    const rr = Math.sqrt(size / Math.PI) // d3.symbolCircle
    const opacity = p.opacity ?? 1
    const fillOpacity = p.fillOpacity ?? 1
    const strokeOpacity = p.strokeOpacity ?? 1
    // SveltePlot's DotCanvas reads strokeWidth from mark.options before Mark has set them, so its
    // canvas dots always get 1.6 px outlines; the SVG/PDF export uses the mark's strokeWidth. The
    // fast layer uses strokeWidth, as the export does. `__PKV_DOTCANVAS_COMPAT__` (tests only)
    // reproduces DotCanvas, to show that this is the only difference.
    const compat = (globalThis as { __PKV_DOTCANVAS_COMPAT__?: boolean }).__PKV_DOTCANVAS_COMPAT__ === true
    const lineWidth = compat ? 1.6 : (p.strokeWidth ?? 1.6)
    ctx.resetTransform()
    ctx.scale(dpr, dpr)
    // same operations as SveltePlot's DotCanvas; a style is only (re)assigned when it changes,
    // which leaves the canvas state, and so the pixels, as they were
    let lastF: string | null = null
    let lastS: string | null = null
    let lastW = NaN
    for (const i of rows) {
      if (!isValid(x[i] as any) || !isValid(y[i] as any)) continue
      const X = projectX('x', scales, x[i] as any)
      const Y = projectY('y', scales, y[i] as any)
      const f = colour(fill, p.fill, i)
      const s = colour(stroke, p.stroke, i)
      if (s && s !== 'none' && lineWidth !== lastW) ctx.lineWidth = lastW = lineWidth
      const fs = f ? f : 'none'
      const ss = s ? s : 'none'
      if (fs !== lastF) ctx.fillStyle = lastF = fs
      if (ss !== lastS) ctx.strokeStyle = lastS = ss
      ctx.translate(X ?? 0, Y ?? 0)
      ctx.beginPath()
      ctx.moveTo(rr, 0)
      ctx.arc(0, 0, rr, 0, 2 * Math.PI)
      ctx.closePath()
      ctx.globalAlpha = opacity * fillOpacity
      if (f && f !== 'none') ctx.fill()
      ctx.globalAlpha = opacity * strokeOpacity
      if (s && s !== 'none') ctx.stroke()
      ctx.translate(-(X ?? 0), -(Y ?? 0))
    }
  }
</script>

<Mark {...props as any} data={proxy} canvas={false} opacity={0} class="pkv-fast-proxy" />
<foreignObject x="0" y="0" width={plot.width} height={plot.height} pointer-events="none" data-fast-layer="dots" data-fast-elements={rows.length}>
  <canvas bind:this={canvas} style={`width:${plot.width}px;height:${plot.height}px;display:block`}></canvas>
</foreignObject>
