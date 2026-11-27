/**
 * Gesture previews for canvas data layers: after each full draw a layer keeps a copy of its
 * bitmap and the scales it was drawn with; while a pan/zoom gesture runs it shows that copy
 * through the affine pixel map between the old and the current scales (exact for linear, log and
 * symlog; see zoom.svelte.ts) instead of redrawing every mark. The full draw follows when the
 * gesture pauses. Previews cost one drawImage, independent of the number of marks.
 */
import { pixelMap, type ZScale } from './zoom.svelte'

export interface Snapshot {
  canvas: HTMLCanvasElement | null
  sx: ZScale['fn'] | null
  sy: ZScale['fn'] | null
  dpr: number
}

export const emptySnapshot = (): Snapshot => ({ canvas: null, sx: null, sy: null, dpr: 1 })

export function keepSnapshot(snap: Snapshot, el: HTMLCanvasElement, sx: ZScale['fn'], sy: ZScale['fn'], dpr: number): void {
  const c = snap.canvas ?? document.createElement('canvas')
  c.width = el.width
  c.height = el.height
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(el, 0, 0)
  snap.canvas = c
  snap.sx = sx
  snap.sy = sy
  snap.dpr = dpr
}

/** Draw the snapshot mapped to the current scales; false when that is not possible (draw instead). */
export function drawPreview(snap: Snapshot, el: HTMLCanvasElement, sx: ZScale['fn'], sy: ZScale['fn'], dpr: number): boolean {
  if (!snap.canvas || !snap.sx || !snap.sy || dpr !== snap.dpr || el.width !== snap.canvas.width || el.height !== snap.canvas.height) return false
  const mx = pixelMap(snap.sx, sx)
  const my = pixelMap(snap.sy, sy)
  if (!mx || !my) return false
  const ctx = el.getContext('2d')!
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.setTransform(mx.a, 0, 0, my.a, dpr * mx.b, dpr * my.b)
  ctx.drawImage(snap.canvas, 0, 0)
  ctx.restore()
  return true
}
