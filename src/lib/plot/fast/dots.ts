/**
 * Fast dot layer (screen only): the pure part. SveltePlot's Mark resolves every datum against
 * ≈ 20 channels through reactive props, and once more per facet; for thousands of dots that is
 * most of a panel's render time (docs/performance-profile.md). The fast layer resolves the few
 * channels a canvas dot needs once, into flat arrays, and hands SveltePlot only "proxy" rows:
 * a subset of the original data with the same extent on every continuous channel and the same
 * distinct values, in the same order of first appearance, on every categorical channel. Scale
 * domains, colour assignment, legends and facets are therefore identical to the full data.
 */
import { isValid } from 'svelteplot/helpers/index.js'

type Datum = Record<string, unknown>
type Accessor = string | ((d: any, i?: number) => unknown) | number | undefined | null

/** Dot props the fast layer draws exactly like SveltePlot's DotCanvas. Anything else falls back. */
const SUPPORTED = new Set(['data', 'x', 'y', 'z', 'fx', 'fy', 'fill', 'stroke', 'r', 'opacity', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'canvas', 'title'])

/**
 * Whether `props` can be drawn by the fast layer. Channels must be field names or functions
 * (x, y, fx, fy) or field names / constant colours (fill, stroke); sizes and opacities must be
 * constants (z only groups lines: it does not change how dots are drawn). No symbol, sort,
 * filter, dx/dy, events or links.
 */
export function fastDotsSupported(props: Record<string, any>): boolean {
  if (!Array.isArray(props.data) || !props.canvas) return false
  for (const k of Object.keys(props)) if (props[k] !== undefined && !SUPPORTED.has(k)) return false
  if (props.x == null || props.y == null) return false
  for (const k of ['x', 'y', 'fx', 'fy']) if (props[k] != null && typeof props[k] !== 'string' && typeof props[k] !== 'function') return false
  for (const k of ['fill', 'stroke']) if (props[k] != null && typeof props[k] !== 'string') return false
  for (const k of ['r', 'opacity', 'fillOpacity', 'strokeOpacity', 'strokeWidth']) if (props[k] != null && typeof props[k] !== 'number') return false
  return true
}

/** resolveProp semantics of SveltePlot: function → called; string → field if present, else the literal. */
export function accessor(a: Accessor): (d: Datum, i: number) => unknown {
  if (typeof a === 'function') return (d, i) => a(d, i)
  if (typeof a === 'string') return (d) => (d[a] !== undefined ? d[a] : a)
  return () => a
}

/** A colour channel is scaled when it names a field of the data; otherwise it is a literal colour. */
export function isFieldChannel(data: Datum[], a: Accessor): boolean {
  return typeof a === 'string' && data.some((d) => d[a] !== undefined)
}

export interface DotColumns {
  n: number
  x: unknown[]
  y: unknown[]
  /** categorical keys (null when the channel is unused or literal) */
  fill: unknown[] | null
  stroke: unknown[] | null
  fx: unknown[] | null
  fy: unknown[] | null
}

export function resolveColumns(data: Datum[], props: Record<string, any>): DotColumns {
  const n = data.length
  const col = (a: Accessor) => {
    const f = accessor(a)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = f(data[i], i)
    return out
  }
  return {
    n,
    x: col(props.x),
    y: col(props.y),
    fill: isFieldChannel(data, props.fill) ? col(props.fill) : null,
    stroke: isFieldChannel(data, props.stroke) ? col(props.stroke) : null,
    fx: props.fx != null ? col(props.fx) : null,
    fy: props.fy != null ? col(props.fy) : null,
  }
}

const isNum = (v: unknown) => typeof v === 'number' || v instanceof Date

/**
 * Row indices (ascending) whose values reproduce every channel's domain: for each channel the
 * first row holding its minimum and its maximum (continuous values, as d3.extent sees them),
 * or the first row of each distinct value (categorical; first appearance order is kept).
 */
export function proxyIndices(c: DotColumns): number[] {
  const keep = new Set<number>()
  for (const v of [c.x, c.y, c.fill, c.stroke, c.fx, c.fy]) {
    if (!v) continue
    let lo = -1
    let hi = -1
    const seen = new Set<unknown>()
    for (let i = 0; i < c.n; i++) {
      const x = v[i]
      if (isNum(x)) {
        if (!isValid(x instanceof Date ? x.getTime() : x)) continue
        if (lo < 0 || +(x as number) < +(v[lo] as number)) lo = i
        if (hi < 0 || +(x as number) > +(v[hi] as number)) hi = i
      } else if (!seen.has(x)) {
        seen.add(x)
        keep.add(i)
      }
    }
    if (lo >= 0) keep.add(lo)
    if (hi >= 0) keep.add(hi)
  }
  return [...keep].sort((a, b) => a - b)
}

/** Rows of one facet (all rows when the plot is not faceted), in data order. */
export function facetRows(c: DotColumns, fx: unknown, fy: unknown): Int32Array {
  if (!c.fx && !c.fy) return Int32Array.from({ length: c.n }, (_, i) => i)
  const out: number[] = []
  for (let i = 0; i < c.n; i++) if ((!c.fx || c.fx[i] === fx) && (!c.fy || c.fy[i] === fy)) out.push(i)
  return Int32Array.from(out)
}
