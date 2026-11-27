import { describe, expect, it } from 'vitest'
import { facetRows, fastDotsSupported, proxyIndices, resolveColumns } from '../../src/lib/plot/fast/dots'

type Row = { a: number; b: number | null; k: string; f: string }
const extent = (rows: Row[], f: (d: Row) => number | null) => {
  const v = rows.map(f).filter((x): x is number => x !== null && Number.isFinite(x))
  return [Math.min(...v), Math.max(...v)]
}
const data: Row[] = [
  { a: 3, b: 10, k: 'z', f: 'p' },
  { a: -1, b: null, k: 'y', f: 'q' },
  { a: 7, b: 4, k: 'z', f: 'p' },
  { a: NaN, b: 12, k: 'x', f: 'q' },
  { a: 7, b: -2, k: 'y', f: 'p' },
]

describe('fast dots: proxy rows', () => {
  it('keeps the extent of every continuous channel and every category in first-appearance order', () => {
    const c = resolveColumns(data, { x: 'a', y: 'b', fill: 'k', fx: 'f' })
    const idx = proxyIndices(c)
    const sub = idx.map((i) => data[i])
    expect(extent(sub, (d) => d.a)).toEqual(extent(data, (d) => d.a))
    expect(extent(sub, (d) => d.b)).toEqual(extent(data, (d) => d.b))
    expect([...new Set(sub.map((d) => d.k))]).toEqual([...new Set(data.map((d) => d.k))])
    expect([...new Set(sub.map((d) => d.f))]).toEqual([...new Set(data.map((d) => d.f))])
    expect(idx).toEqual([...idx].sort((p, q) => p - q))
  })

  it('a literal colour is not a channel; function accessors are resolved', () => {
    const c = resolveColumns(data, { x: (d: any) => d.a * 2, y: 'b', fill: '#555', stroke: 'var(--pkv-ink)' })
    expect(c.fill).toBeNull()
    expect(c.stroke).toBeNull()
    expect(c.x[0]).toBe(6)
  })

  it('facet rows keep data order', () => {
    const c = resolveColumns(data, { x: 'a', y: 'b', fx: 'f' })
    expect(Array.from(facetRows(c, 'p', undefined))).toEqual([0, 2, 4])
    expect(Array.from(facetRows(resolveColumns(data, { x: 'a', y: 'b' }), undefined, undefined))).toEqual([0, 1, 2, 3, 4])
  })

  it('empty data and a single row', () => {
    expect(proxyIndices(resolveColumns([], { x: 'a', y: 'b' }))).toEqual([])
    expect(proxyIndices(resolveColumns([data[0]], { x: 'a', y: 'b', fill: 'k' }))).toEqual([0])
  })

  it('falls back to SveltePlot for anything it does not draw like DotCanvas', () => {
    const base = { data, x: 'a', y: 'b', canvas: true }
    expect(fastDotsSupported(base)).toBe(true)
    expect(fastDotsSupported({ ...base, canvas: false })).toBe(false)
    expect(fastDotsSupported({ ...base, r: 'a' })).toBe(false)
    expect(fastDotsSupported({ ...base, fill: (d: any) => d.k })).toBe(false)
    expect(fastDotsSupported({ ...base, symbol: 'square' })).toBe(false)
    expect(fastDotsSupported({ ...base, sort: 'a' })).toBe(false)
    expect(fastDotsSupported({ ...base, onclick: () => {} })).toBe(false)
  })
})
