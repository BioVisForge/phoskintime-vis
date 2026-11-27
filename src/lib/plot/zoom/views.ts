/**
 * The views users zoomed to on screen, per panel, for the export option "export current view".
 * A zoomable plot is identified by its panel id and a key (the plot's `zoom` key or title); with
 * facets unlinked each facet has its own view. An export renders the panel afresh: with the option
 * on, its zoomable plots read their views here, and the caption states the shown ranges.
 */
import type { View } from './zoom.svelte'

export interface PlotViews {
  /** label for the caption (plot title, or the panel's) */
  label: string
  /** facets linked (one view under '') or unlinked (one view per facet value) */
  linked: boolean
  /** facet values of the plot (empty when it is not faceted) */
  facets: string[]
  /** facet value ('' when linked) → view; only zoomed views are kept */
  views: Map<string, View>
}

const live = new Map<string, PlotViews>()
const id = (panelId: string, key: string) => `${panelId}\u0000${key}`

export function publishViews(panelId: string, key: string, v: PlotViews): void {
  // nothing zoomed: the current view is the full range, whatever the facet linking
  if (!v.views.size) live.delete(id(panelId, key))
  else live.set(id(panelId, key), v)
}

export function unpublishViews(panelId: string, key: string): void {
  live.delete(id(panelId, key))
}

/** key → views of one panel's zoomed plots */
export function panelViews(panelId: string): Map<string, PlotViews> {
  const out = new Map<string, PlotViews>()
  const pre = `${panelId}\u0000`
  for (const [k, v] of live) if (k.startsWith(pre)) out.set(k.slice(pre.length), v)
  return out
}

const num = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : Number(v.toPrecision(4)).toString())
const range = (d: [number, number]) => `${num(d[0])} – ${num(d[1])}`

/** Caption sentence for an export of the current view (empty when nothing is zoomed). */
export function viewCaption(views: Map<string, PlotViews>): string {
  const parts: string[] = []
  for (const v of views.values())
    for (const [facet, view] of v.views) {
      const axes = [view.x ? `x ${range(view.x)}` : '', view.y ? `y ${range(view.y)}` : ''].filter(Boolean).join(', ')
      if (axes) parts.push(`${v.label}${facet ? ` (${facet})` : ''}: ${axes}`)
    }
  return parts.length ? `Current view, not the full data range: ${parts.join('; ')}.` : ''
}
