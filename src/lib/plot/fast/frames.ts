/**
 * One draw per animation frame for canvas data layers. A panel's scales and size settle over
 * several reactive updates while it mounts; redrawing a 56,000-point layer for each of them
 * (5 times per render was measured) is the cost, not the drawing itself. Layers call
 * `scheduleDraw(key, fn)` from their effect: the last `fn` per key runs in the next frame.
 * `drawsSettled()` resolves when no draw is pending (the export waits for it).
 */
const pending = new Map<object, () => void>()
let waiters: (() => void)[] = []
let frameRequested = false

function flush() {
  frameRequested = false
  const jobs = [...pending.values()]
  pending.clear()
  for (const j of jobs) j()
  if (!pending.size) {
    const w = waiters
    waiters = []
    for (const r of w) r()
  }
}

export function scheduleDraw(key: object, fn: () => void): void {
  pending.set(key, fn)
  if (frameRequested) return
  frameRequested = true
  if (typeof requestAnimationFrame === 'undefined') queueMicrotask(flush)
  else requestAnimationFrame(flush)
}

/** Drop a pending draw (the layer was destroyed). */
export function cancelDraw(key: object): void {
  pending.delete(key)
  if (!pending.size && waiters.length) {
    const w = waiters
    waiters = []
    for (const r of w) r()
  }
}

export function drawsPending(): number {
  return pending.size
}

export function drawsSettled(): Promise<void> {
  return pending.size ? new Promise((r) => waiters.push(r)) : Promise.resolve()
}

/**
 * What decides a canvas layer's pixels, as a comparable string: the domains and ranges of its
 * scales and the canvas size. SveltePlot builds new scale objects whenever any mark changes (a
 * brush rectangle, for example) even when the values are the same; a layer redraws only when
 * this signature, its data or its style changed.
 */
export function scaleSignature(scales: Record<string, any>, names: string[], extra: unknown[]): string {
  const parts: unknown[] = [...extra]
  for (const n of names) {
    const s = scales?.[n]
    if (!s?.fn) {
      parts.push(null)
      continue
    }
    parts.push(s.type, s.fn.domain?.(), s.fn.range?.())
  }
  return JSON.stringify(parts)
}
