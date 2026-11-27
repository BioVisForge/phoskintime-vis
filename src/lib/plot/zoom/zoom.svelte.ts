/**
 * Pan and zoom for a plot (screen only; exports always show the full data range).
 *
 * The view is defined in pixel space: zooming by k around pixel p maps the current range ends r
 * to p + (r - p) / k, panning by d maps them to r - d, and the new domain is the scale's inverse
 * of those pixels. For linear, log and symlog scales a datum's new pixel is therefore an affine
 * function of its old pixel, so canvas layers can show the previous bitmap transformed while a
 * gesture runs (cheap at 100k+ marks) and redraw properly once it pauses.
 */
import { getContext, setContext } from 'svelte'

export type Domain = [number, number]
export interface View {
  x?: Domain
  y?: Domain
}

/** The part of a SveltePlot scale the zoom needs. */
export interface ZScale {
  fn: { (v: number): number; invert?: (p: number) => number; range(): number[]; domain(): unknown[] }
  type: string
}

const KEY = Symbol('pkv-zoom')
/** Continuous scale types the zoom can invert. */
const ZOOMABLE = new Set(['linear', 'log', 'symlog', 'pow', 'sqrt', 'time', 'utc'])
/** A gesture ends this long after its last event. */
export const SETTLE_MS = 140

export class ZoomState {
  view = $state<View>({})
  mode = $state<'brush' | 'pan'>('brush')
  /** true while a wheel or drag gesture runs: canvas layers preview instead of redrawing */
  interacting = $state(false)
  /** the plot has a brush: dragging brushes unless pan mode is on */
  readonly hasBrush: boolean
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(hasBrush: boolean) {
    this.hasBrush = hasBrush
    if (!hasBrush) this.mode = 'pan'
  }

  get zoomed(): boolean {
    return !!(this.view.x || this.view.y)
  }

  /** Mark a gesture as running; it ends SETTLE_MS after the last call. */
  touch(): void {
    this.interacting = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.interacting = false
      this.timer = null
    }, SETTLE_MS)
  }

  reset(): void {
    this.view = {}
  }

  /** Zoom by k (> 1 zooms in) around pixel (px, py) of the given scales. */
  zoomAt(sx: ZScale, sy: ZScale, px: number, py: number, k: number, axes: 'xy' | 'x' | 'y' = 'xy'): void {
    const v: View = { ...this.view }
    if (axes !== 'y') {
      const d = zoomDomain(sx, px, k)
      if (d) v.x = d
    }
    if (axes !== 'x') {
      const d = zoomDomain(sy, py, k)
      if (d) v.y = d
    }
    this.view = v
  }

  /** Pan by (dx, dy) pixels. */
  panBy(sx: ZScale, sy: ZScale, dx: number, dy: number): void {
    const v: View = { ...this.view }
    const x = panDomain(sx, dx)
    const y = panDomain(sy, dy)
    if (x) v.x = x
    if (y) v.y = y
    this.view = v
  }
}

export function zoomable(s: ZScale | undefined): boolean {
  return !!s && ZOOMABLE.has(s.type) && typeof s.fn.invert === 'function'
}

function domainOf(s: ZScale, p0: number, p1: number): Domain | null {
  const a = s.fn.invert!(p0)
  const b = s.fn.invert!(p1)
  if (!Number.isFinite(+a) || !Number.isFinite(+b) || +a === +b) return null
  // keep the domain's direction (an inverted axis stays inverted)
  const [d0, d1] = s.fn.domain() as number[]
  return (+d0 <= +d1) === (+a <= +b) ? [+a, +b] : [+b, +a]
}

export function zoomDomain(s: ZScale, p: number, k: number): Domain | null {
  if (!zoomable(s)) return null
  const [r0, r1] = s.fn.range()
  return domainOf(s, p + (r0 - p) / k, p + (r1 - p) / k)
}

export function panDomain(s: ZScale, d: number): Domain | null {
  if (!zoomable(s) || !d) return null
  const [r0, r1] = s.fn.range()
  return domainOf(s, r0 - d, r1 - d)
}

/**
 * Affine map (a, b) with new = a * old + b between the pixel positions of the same values under
 * an old and a new scale (exact for the zoomable scale types; see the module comment).
 */
export function pixelMap(old: ZScale['fn'], now: ZScale['fn']): { a: number; b: number } | null {
  const [d0, d1] = old.domain() as number[]
  const o0 = old(d0)
  const o1 = old(d1)
  const n0 = now(d0)
  const n1 = now(d1)
  if (![o0, o1, n0, n1].every(Number.isFinite) || o0 === o1) return null
  const a = (n1 - n0) / (o1 - o0)
  return { a, b: n0 - a * o0 }
}

export function setZoom(z: ZoomState): void {
  setContext(KEY, z)
}

export function getZoom(): ZoomState | undefined {
  return getContext(KEY)
}
