<!-- Pointer handling and clipping for a zoomable plot (rendered inside every facet). Wheel with
     Ctrl/⌘ (or any wheel in pan mode) zooms around the pointer, Shift+wheel zooms x only; drag
     pans in pan mode; double-click resets. While zoomed, the facet's marks are clipped to the
     frame. With `interactive={false}` (an export of the current view) it only clips. -->
<script lang="ts">
  import { usePlot } from 'svelteplot'
  import { getZoom, zoomable, type ZScale } from './zoom.svelte'

  /** the current x/y scales and facet values, for the toolbar and keyboard (same in every facet) */
  let {
    probe = $bindable(),
    interactive = true,
    clip = false,
  }: { probe?: { x: ZScale; y: ZScale; fx: unknown[] }; interactive?: boolean; clip?: boolean } = $props()
  const z = getZoom()
  const plot = usePlot()
  $effect(() => {
    if (plot.scales) probe = { x: plot.scales.x as unknown as ZScale, y: plot.scales.y as unknown as ZScale, fx: [...((plot.scales as any).fx?.domain ?? [])] }
  })
  const clipping = $derived(interactive ? !!z?.zoomed : clip)
  const id = `pkv-zoom-clip-${Math.random().toString(36).slice(2, 10)}`
  let overlay: SVGRectElement | undefined = $state()

  const frame = $derived.by(() => {
    const sx = plot.scales?.x as unknown as ZScale | undefined
    const sy = plot.scales?.y as unknown as ZScale | undefined
    if (!sx || !sy) return null
    const inset = Number((plot.options as any).inset ?? 0) || 0
    const [x0, x1] = sx.fn.range()
    const [y0, y1] = sy.fn.range()
    return { x: Math.min(x0, x1) - inset, y: Math.min(y0, y1) - inset, w: Math.abs(x1 - x0) + 2 * inset, h: Math.abs(y1 - y0) + 2 * inset }
  })
  const scales = () => ({ sx: plot.scales.x as unknown as ZScale, sy: plot.scales.y as unknown as ZScale })

  /** pointer position in this facet's coordinates */
  function local(ev: { clientX: number; clientY: number }) {
    const m = overlay!.getScreenCTM()!.inverse()
    return { x: m.a * ev.clientX + m.c * ev.clientY + m.e, y: m.b * ev.clientX + m.d * ev.clientY + m.f, sx: m.a, sy: m.d }
  }

  // wheel on the whole plot (the overlay ignores pointer events in brush mode)
  $effect(() => {
    const svg = overlay?.ownerSVGElement
    if (!svg || !interactive) return
    const onWheel = (ev: WheelEvent) => {
      if (!z || !(ev.ctrlKey || ev.metaKey || z.mode === 'pan')) return
      const p = local(ev)
      if (!frame || p.x < frame.x || p.x > frame.x + frame.w || p.y < frame.y || p.y > frame.y + frame.h) return
      ev.preventDefault()
      const { sx, sy } = scales()
      z.touch()
      z.zoomAt(sx, sy, p.x, p.y, Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.002)), ev.shiftKey ? 'x' : 'xy')
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  })

  // pan: the domain is computed from the scales at pointerdown and the total offset, so events
  // that arrive before the plot has re-rendered do not accumulate errors
  let drag = $state.raw<{ x: number; y: number; sx: ZScale; sy: ZScale } | null>(null)
  function down(ev: PointerEvent) {
    if (!z || z.mode !== 'pan' || ev.button !== 0) return
    const p = local(ev)
    const { sx, sy } = scales()
    // the scale objects are replaced on every change, so these are snapshots
    drag = { x: p.x, y: p.y, sx: { ...sx, fn: sx.fn }, sy: { ...sy, fn: sy.fn } }
    overlay!.setPointerCapture(ev.pointerId)
  }
  function move(ev: PointerEvent) {
    if (!drag || !z) return
    const p = local(ev)
    z.touch()
    z.view = { ...z.view, ...panned(drag, p.x - drag.x, p.y - drag.y) }
  }
  function panned(d: NonNullable<typeof drag>, dx: number, dy: number) {
    const out: { x?: [number, number]; y?: [number, number] } = {}
    for (const [k, s, delta] of [['x', d.sx, dx], ['y', d.sy, dy]] as const) {
      if (!zoomable(s) || !delta) continue
      const [r0, r1] = s.fn.range()
      const a = +s.fn.invert!(r0 - delta)
      const b = +s.fn.invert!(r1 - delta)
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) out[k] = a < b ? [a, b] : [b, a]
    }
    return out
  }
  function up(ev: PointerEvent) {
    if (!drag) return
    drag = null
    overlay!.releasePointerCapture(ev.pointerId)
  }

  // clip this facet's marks to the frame while zoomed
  $effect(() => {
    const g = overlay?.parentElement
    if (!g) return
    const own = new Set<Element>([overlay!, overlay!.previousElementSibling!])
    const isMark = (c: Element) => !own.has(c) && c.tagName !== 'defs' && !/\b(axis|grid)-[xy]\b/.test(c.getAttribute('class') ?? '')
    const apply = () => {
      for (const c of g.children)
        if (isMark(c)) {
          if (clipping) c.setAttribute('clip-path', `url(#${id})`)
          else if (c.getAttribute('clip-path') === `url(#${id})`) c.removeAttribute('clip-path')
        }
    }
    void clipping
    apply()
    const o = new MutationObserver(apply)
    o.observe(g, { childList: true })
    return () => o.disconnect()
  })
</script>

{#if frame}
  <clipPath {id}><rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} /></clipPath>
  <rect
    bind:this={overlay}
    class="pkv-zoom-overlay"
    data-testid={interactive ? 'zoom-overlay' : null}
    x={frame.x}
    y={frame.y}
    width={frame.w}
    height={frame.h}
    fill="transparent"
    style:cursor={interactive && z?.mode === 'pan' ? (drag ? 'grabbing' : 'grab') : null}
    pointer-events={interactive && z?.mode === 'pan' ? 'all' : 'none'}
    role="presentation"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    ondblclick={() => z?.reset()} />
{/if}
