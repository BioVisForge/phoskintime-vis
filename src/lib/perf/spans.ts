/**
 * Opt-in stage timing for docs/performance-profile.md. Off (one property read per call) unless
 * the page sets `globalThis.__PKV_PROFILE__ = true` before the app starts, as
 * scripts/profile.mjs does. Nested spans of the same stage count once (outermost only).
 */
export type Span = { stage: string; label: string; start: number; dur: number }

type G = { __PKV_PROFILE__?: boolean; __PKV_SPANS__?: Span[] }
const g = globalThis as G
const depth: Record<string, number> = {}

export const profiling = (): boolean => g.__PKV_PROFILE__ === true

export function record(stage: string, label: string, start: number, dur: number): void {
  if (!profiling()) return
  ;(g.__PKV_SPANS__ ??= []).push({ stage, label, start, dur })
}

export function span<T>(stage: string, label: string, fn: () => T): T {
  if (!profiling()) return fn()
  depth[stage] = (depth[stage] ?? 0) + 1
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    const d = performance.now() - t0
    if (--depth[stage] === 0) record(stage, label, t0, d)
  }
}

export async function spanAsync<T>(stage: string, label: string, fn: () => Promise<T>): Promise<T> {
  if (!profiling()) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    record(stage, label, t0, performance.now() - t0)
  }
}

/** `fn` timed as one span of `stage` when profiling; otherwise called directly. */
export function timed<A extends unknown[], R>(stage: string, label: string, fn: (...a: A) => R): (...a: A) => R {
  return (...a: A) => (profiling() ? span(stage, label, () => fn(...a)) : fn(...a))
}
