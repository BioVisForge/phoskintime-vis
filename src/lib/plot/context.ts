import { getContext, setContext, onDestroy } from 'svelte'
import { FigureCollector, type MarkKind, type MarkSpec, type PlotSpec } from './spec'

/** Export mode: set by the offscreen export host. */
export interface ExportMode {
  active: true
  /** Canvas layers with at most this many elements are re-rendered as SVG (vector). */
  vectorMax: number
  /** Pixel ratio for layers that stay raster (export dpi / 96). */
  pixelRatio: number
  /** "Export current view": the panel's zoomed plots, by zoom key (decision 0006, pan-zoom.md) */
  views?: Map<string, import('./zoom/views').PlotViews>
}

const EXPORT = Symbol('pkv-export')
const COLLECT = Symbol('pkv-collector')
const PLOT = Symbol('pkv-plot')

/** Canvas layers above this many elements are rasterised in vector exports (measured, docs/decisions/0002). */
export const VECTOR_MAX = 50_000

export function setExportMode(m: ExportMode) {
  setContext(EXPORT, m)
}
export function getExportMode(): ExportMode | undefined {
  return getContext(EXPORT)
}
export function setCollector(c: FigureCollector) {
  setContext(COLLECT, c)
}
export function getCollector(): FigureCollector | undefined {
  return getContext(COLLECT)
}

export function registerPlot(options: () => Record<string, any>): PlotSpec | undefined {
  const c = getCollector()
  if (!c) return undefined
  const p = c.add(options)
  setContext(PLOT, p)
  onDestroy(() => c.remove(p))
  return p
}

export function registerMark(kind: MarkKind, props: () => Record<string, any>, glyph?: string) {
  const p = getContext<PlotSpec | undefined>(PLOT)
  if (!p) return
  const m: MarkSpec = { kind, props, glyph }
  p.marks.push(m)
  onDestroy(() => {
    p.marks = p.marks.filter((x) => x !== m)
  })
}

/** Canvas decision for a mark: on screen as requested; in export mode vector unless too large. */
export function useCanvas(requested: unknown, n: number): boolean {
  const e = getExportMode()
  if (!requested) return false
  if (e) return n > e.vectorMax
  return true
}
