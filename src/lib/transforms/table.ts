import type { Column, Table } from '../model/types'
import { timed } from '../perf/spans'

/** Numeric value or NaN for null. */
function num_(t: Table, col: string): Float64Array {
  const c = t.columns[col]
  if (!c) throw new Error(`column ${col} missing from ${t.name}`)
  if (c.values instanceof Float64Array) return c.values
  return Float64Array.from(c.values as unknown[], (v) => (v === null || v === undefined ? NaN : Number(v)))
}

function str_(t: Table, col: string): (string | null)[] {
  const c = t.columns[col]
  if (!c) throw new Error(`column ${col} missing from ${t.name}`)
  if (c.values instanceof Float64Array) return Array.from(c.values, (v, i) => (c.valid && !c.valid[i] ? null : String(v)))
  return (c.values as unknown[]).map((v) => (v === null || v === undefined ? null : String(v)))
}

export function has(t: Table, col: string): boolean {
  return col in t.columns
}

/** Materialise rows as objects (for plotting/raw view). Numeric nulls become null, never 0. */
function rows_(t: Table, cols?: string[], idx?: ArrayLike<number>): Record<string, unknown>[] {
  const names = cols ?? Object.keys(t.columns)
  const getters = names.map((n) => {
    const c: Column = t.columns[n]
    if (c.values instanceof Float64Array) {
      const v = c.values
      const ok = c.valid
      return (i: number) => (ok && !ok[i] ? null : v[i])
    }
    const v = c.values as unknown[]
    return (i: number) => v[i]
  })
  const n = idx ? idx.length : t.rows
  const out: Record<string, unknown>[] = new Array(n)
  for (let k = 0; k < n; k++) {
    const i = idx ? idx[k] : k
    const r: Record<string, unknown> = {}
    for (let j = 0; j < names.length; j++) r[names[j]] = getters[j](i)
    out[k] = r
  }
  return out
}

/** Row indices where predicate(i) holds. */
export function where(t: Table, pred: (i: number) => boolean): Int32Array {
  const out: number[] = []
  for (let i = 0; i < t.rows; i++) if (pred(i)) out.push(i)
  return Int32Array.from(out)
}

export function unique<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)]
}

/** CSV with RFC 4180 quoting; null -> empty field. */
export function toCsv(records: Record<string, unknown>[], cols?: string[]): string {
  const names = cols ?? (records.length ? Object.keys(records[0]) : [])
  const q = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : String(v)) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [names.join(','), ...records.map((r) => names.map((n) => q(r[n])).join(','))].join('\n') + '\n'
}

export const num = timed('shaping', 'num', num_)
export const str = timed('shaping', 'str', str_)
export const rows = timed('shaping', 'rows', rows_)
