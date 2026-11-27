/**
 * Figure spec: what a panel actually drew, captured from the plot wrappers while it renders.
 * Exporters (TikZ/PGFPlots) read this instead of re-implementing each panel.
 */
export type MarkKind =
  | 'Line' | 'Dot' | 'AreaY' | 'DifferenceY' | 'BoxY' | 'RuleX' | 'RuleY' | 'RegressionY' | 'Vector'
  | 'Cell' | 'Raster' | 'BarX' | 'RectY' | 'Text' | 'CustomMark' | 'Rect' | 'Brush' | 'FastLines'

export interface MarkSpec {
  kind: MarkKind
  /** Props as passed to the mark (data, channels, styles). Read lazily: always the latest. */
  props: () => Record<string, any>
  /** Mark-specific glyph hint for CustomMark (e.g. 'ring', 'cross', 'triangle'). */
  glyph?: string
}

export interface ResolvedScale {
  type: string
  domain: unknown[]
  range?: unknown[]
  fn?: (v: unknown) => unknown
  ticks?: unknown[]
  label?: string
}

export interface PlotSpec {
  id: number
  options: () => Record<string, any>
  marks: MarkSpec[]
  scales: Record<string, ResolvedScale>
  width: number
  height: number
  /** the Plot's root element (geometry for TikZ placement) */
  body?: HTMLElement
  margins?: { left: number; right: number; top: number; bottom: number }
}

export class FigureCollector {
  plots: PlotSpec[] = []
  private seq = 0
  add(options: () => Record<string, any>): PlotSpec {
    const p: PlotSpec = { id: ++this.seq, options, marks: [], scales: {}, width: 0, height: 0 }
    this.plots.push(p)
    return p
  }
  remove(p: PlotSpec) {
    this.plots = this.plots.filter((x) => x !== p)
  }
}
