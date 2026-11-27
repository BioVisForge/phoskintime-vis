/**
 * Mount visible panels one at a time, yielding a frame between them, so the first panel paints
 * quickly and heavy panels do not block each other's first paint.
 */
const queue: (() => void)[] = []
let running = false

function nextFrame(): Promise<void> {
  return new Promise((res) => (typeof requestAnimationFrame === 'undefined' ? setTimeout(res, 0) : requestAnimationFrame(() => setTimeout(res, 0))))
}

export function enqueueRender(fn: () => void) {
  queue.push(fn)
  if (running) return
  running = true
  ;(async () => {
    while (queue.length) {
      queue.shift()!()
      await nextFrame()
    }
    running = false
  })()
}

/** True when no panel mount or table hand-off is waiting in the queue. */
export function renderQueueIdle(): boolean {
  return !running && !queue.length
}
