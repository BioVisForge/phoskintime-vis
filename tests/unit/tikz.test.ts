import { describe, expect, it } from 'vitest'
import { tex, texLabel, num } from '../../src/lib/tikz/escape'
import { differencePolygons, emitFigure, lttb, type EmitPlot } from '../../src/lib/tikz/emit'
import type { MarkKind, PlotSpec } from '../../src/lib/plot/spec'

describe('LaTeX escaping', () => {
  it('escapes every special character', () => {
    expect(tex('a_b % c & d # e $ f { g } h ~ i ^ j \\ k')).toBe('a\\_b \\% c \\& d \\# e \\$ f \\{ g \\} h \\textasciitilde{} i \\textasciicircum{} j \\textbackslash{} k')
  })
  it('turns Greek and operators into math, with μ* as superscript', () => {
    expect(tex('μ* (importance)')).toBe('$\\mu^*$ (importance)')
    expect(tex('σ of Δ')).toBe('$\\sigma $ of $\\Delta $')
    expect(tex('±1.96 · σ')).toBe('$\\pm $1.96 $\\cdot \\sigma $')
    expect(tex('pred − obs')).toBe('pred $-$ obs')
    expect(tex('KL(obs ‖ est)')).toBe('KL(obs $\\|$ est)')
  })
  it('puts units in brackets once', () => {
    expect(texLabel('Time', 'min')).toBe('Time [min]')
    expect(texLabel('Time (min)', 'min')).toBe('Time (min)')
    expect(texLabel('rate', '1/min')).toBe('rate [1/min]')
  })
  it('writes full float64 precision and nan for null', () => {
    expect(num(0.1)).toBe('0.10000000000000001')
    expect(Number(num(1 / 3))).toBe(1 / 3)
    expect(num(null)).toBe('nan')
    expect(num(NaN)).toBe('nan')
  })
})

describe('difference polygons', () => {
  it('splits at sign changes with linear interpolation of the crossing', () => {
    const p = differencePolygons([0, 1, 2], [0, 0, 0], [1, -1, -1])
    expect(p.map((x) => x.sign)).toEqual([1, -1])
    // crossing between x=0 (diff +1) and x=1 (diff -1) at x=0.5
    expect(p[0].pts).toContainEqual([0.5, 0])
    expect(p[1].pts[0]).toEqual([0.5, 0])
  })
  it('breaks polygons at gaps (nulls are gaps)', () => {
    const p = differencePolygons([0, 1, 2, 3], [0, 0, 0, 0], [1, 1, NaN, 1])
    expect(p).toHaveLength(1)
  })
})

describe('lttb', () => {
  it('keeps the endpoints and the requested count', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i)
    const ys = xs.map((x) => Math.sin(x / 30))
    const k = lttb(xs, ys, 100)
    expect(k).toHaveLength(100)
    expect(k[0]).toBe(0)
    expect(k[99]).toBe(999)
  })
})

function plot(marks: { kind: MarkKind; props: Record<string, any>; glyph?: string }[], scales: Record<string, any> = {}, options: Record<string, any> = {}): EmitPlot {
  const spec: PlotSpec = {
    id: 1,
    options: () => ({ grid: true, x: { label: 'Time (min)' }, y: { label: 'Fold change' }, ...options }),
    marks: marks.map((m) => ({ kind: m.kind, props: () => m.props, glyph: m.glyph })),
    scales: { x: { type: 'linear', domain: [0, 10], range: [40, 440] }, y: { type: 'linear', domain: [0, 2], range: [260, 10] }, ...scales },
    width: 460,
    height: 300,
  }
  return { spec, geom: { left: 0, top: 0, width: 460, height: 300, marginLeft: 40, marginTop: 10, marginRight: 20, marginBottom: 40 } }
}

const D = [
  { t: 0, v: 1, g: 'a', lo: 0.8, hi: 1.2 },
  { t: 2, v: 1.5, g: 'a', lo: 1.2, hi: 1.7 },
  { t: 4, v: null, g: 'a', lo: 1.1, hi: 1.6 },
  { t: 6, v: 1.25, g: 'b', lo: 1.0, hi: 1.4 },
  { t: 8, v: 0.75, g: 'b', lo: 0.5, hi: 0.9 },
]

const CASES: [string, EmitPlot][] = [
  ['line', plot([{ kind: 'Line', props: { data: D, x: 't', y: 'v', z: 'g', stroke: '#0072B2', strokeDasharray: '4 3' } }])],
  ['line-step', plot([{ kind: 'Line', props: { data: D, x: 't', y: 'lo', stroke: '#E69F00', curve: 'step-after' } }])],
  ['dot', plot([{ kind: 'Dot', props: { data: D, x: 't', y: 'lo', fill: '#009E73', r: 3 } }])],
  ['area', plot([{ kind: 'AreaY', props: { data: D, x: 't', y1: 'lo', y2: 'hi', fill: '#56B4E9', fillOpacity: 0.4 } }])],
  ['difference', plot([{ kind: 'DifferenceY', props: { data: D, x: 't', y1: 'lo', y2: 'hi', positiveFill: '#D55E00', negativeFill: '#0072B2', fillOpacity: 0.4 } }])],
  ['box', plot([{ kind: 'BoxY', props: { data: [...D, ...D.map((d) => ({ ...d, lo: d.lo * 2 }))], x: 'g', y: 'lo', fill: '#bcd4ec' } }], { x: { type: 'band', domain: ['a', 'b'], range: [40, 440] } })],
  ['rule', plot([{ kind: 'RuleX', props: { data: D, x: 't', y1: 'lo', y2: 'hi', stroke: '#c44' } }, { kind: 'RuleY', props: { y: 1, stroke: 'red', strokeDasharray: '4 3' } }])],
  ['regression', plot([{ kind: 'RegressionY', props: { data: D, x: 't', y: 'lo', stroke: '#000000', confidence: 0.95 } }])],
  ['vector', plot([{ kind: 'Vector', props: { data: [{ x: 3, y: 1, x0: 2, y0: 0.5, x1: 4, y1: 1.5 }], length: () => 12, stroke: '#444444' } }])],
  ['cell', plot([{ kind: 'Cell', props: { data: [{ a: 'p', b: 'q', v: 1 }, { a: 'r', b: 'q', v: -1 }], x: 'a', y: 'b', fill: 'v' } }], { x: { type: 'band', domain: ['p', 'r'], range: [40, 440] }, y: { type: 'band', domain: ['q', 's'], range: [10, 260] }, color: { type: 'diverging', domain: [-1, 1], fn: (v: number) => (v < 0 ? '#2166ac' : '#b2182b') } })],
  ['barx', plot([{ kind: 'BarX', props: { data: [{ k: 'x_1', v: 2 }, { k: 'y%2', v: -1 }], x: 'v', y: 'k', fill: '#87ceeb' } }], { y: { type: 'band', domain: ['x_1', 'y%2'], range: [10, 260], fn: Object.assign(() => 0, { bandwidth: () => 20 }) }, x: { type: 'linear', domain: [-1, 2], range: [40, 440] } })],
  ['recty', plot([{ kind: 'RectY', props: { data: [{ x1: 0, x2: 1, c: 3 }, { x1: 1, x2: 2, c: 5 }], x1: 'x1', x2: 'x2', y1: 0, y2: 'c', fill: '#7aa6d6' } }])],
  ['text', plot([{ kind: 'Text', props: { data: [{ x: 1, y: 1, s: 'μ* & σ_1' }], x: 'x', y: 'y', text: 's', textAnchor: 'start', dx: 4 } }])],
  ['glyph', plot([{ kind: 'CustomMark', glyph: 'ring', props: { data: [{ x: 1, y: 1 }], x: 'x', y: 'y' } }])],
  ['symlog-facets', plot([{ kind: 'Line', props: { data: [...D.map((d) => ({ ...d, f: 'A' })), ...D.map((d) => ({ ...d, f: 'B' }))], x: 't', y: 'lo', fx: 'f', stroke: '#0072B2' } }], { x: { type: 'symlog', domain: [0, 10], range: [0, 100] }, fx: { type: 'band', domain: ['A', 'B'], fn: Object.assign((v: string) => (v === 'A' ? 40 : 250), { bandwidth: () => 190 }) } }, { x: { label: 'Time (min), symlog', ticks: [0, 1, 10] } })],
]

describe('PGFPlots emitters (golden snapshots)', () => {
  for (const [name, p] of CASES) {
    it(name, async () => {
      const r = await emitFigure([p], { name, fontPt: 8, downsample: false })
      const files = Object.entries(r.files).map(([k, v]) => `%%% ${k}\n${v}`).join('\n')
      const colors = [...r.colors.entries()].map(([h, n]) => `\\definecolor{${n}}{HTML}{${h.slice(1)}}`).join('\n')
      await expect(`${colors}\n${r.picture}\n${files}`).toMatchFileSnapshot(`./__snapshots__/tikz/${name}.tex`)
    })
  }
})

describe('data files equal the plotted data bit for bit', () => {
  it('Line and AreaY values round-trip exactly', async () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ t: i * 0.1 + 1e-9 * i, v: Math.sin(i) / 3, lo: Math.PI / (i + 1), hi: Math.E * i }))
    const r = await emitFigure([plot([{ kind: 'Line', props: { data, x: 't', y: 'v', stroke: '#000000' } }, { kind: 'AreaY', props: { data, x: 't', y1: 'lo', y2: 'hi', fill: '#999999' } }])], { name: 'parity', fontPt: 8, downsample: false })
    const [lineFile, areaFile] = Object.values(r.files)
    const parse = (f: string) => f.trim().split('\n').slice(1).map((l) => l.split('\t').map(Number))
    const L = parse(lineFile)
    L.forEach((row, i) => {
      expect(Object.is(row[0], data[i].t)).toBe(true)
      expect(Object.is(row[1], data[i].v)).toBe(true)
    })
    // band polygon: upper edge forward, then lower edge backward
    const A = parse(areaFile)
    expect(A).toHaveLength(2 * data.length)
    data.forEach((d, i) => {
      expect(Object.is(A[i][0], d.t)).toBe(true)
      expect(Object.is(A[i][1], d.hi)).toBe(true)
      expect(Object.is(A[2 * data.length - 1 - i][1], d.lo)).toBe(true)
    })
  })
  it('switches a layer above the TeX threshold to \\addplot graphics and says so', async () => {
    const data = Array.from({ length: 30 }, (_, i) => ({ t: i, v: i }))
    const p = plot([{ kind: 'Dot', props: { data, x: 't', y: 'v', fill: '#000000' } }])
    p.rasterPng = async () => 'data:image/png;base64,iVBORw0KGgo='
    const r = await emitFigure([p], { name: 'big', fontPt: 8, downsample: false, texMax: 10 })
    expect(r.picture).toMatch(/\\addplot graphics\[xmin=0, xmax=10, ymin=0, ymax=2\] \{big-layer\.png\}/)
    expect(r.picture).toMatch(/% Dot: 30 points > /)
    expect(r.notes.join(' ')).toMatch(/600 dpi image/)
    expect(r.images).toHaveLength(1)
  })
  it('downsampling is off by default and stated when on', async () => {
    const data = Array.from({ length: 40 }, (_, i) => ({ t: i, v: Math.sin(i) }))
    const r = await emitFigure([plot([{ kind: 'Line', props: { data, x: 't', y: 'v', stroke: '#000000' } }])], { name: 'ds', fontPt: 8, downsample: true, texMax: 10 })
    expect(r.notes.join(' ')).toMatch(/largest-triangle-three-buckets/)
    expect(Object.values(r.files)[0].trim().split('\n').length - 1).toBeLessThanOrEqual(10)
  })
})
