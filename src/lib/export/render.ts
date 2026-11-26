import { mount, unmount, type Component } from 'svelte'
import ExportHost from './ExportHost.svelte'
import { FigureCollector } from '../plot'
import type { ExportSettings } from './settings'
import type { PanelReport } from '../panels/types'

export interface ExportTarget {
  id: string
  title: string
  caption: string
  component: Component<any>
  props: Record<string, unknown>
  /** CSS selector of the figure inside the rendered component (default: whole component) */
  selector?: string
  bundleIds: string[]
  /** registry id whose persisted controls the render should use (default: id) */
  panelId?: string
  commits: string[]
  /** CSV rows (the plotted data) and column units */
  report?: PanelReport
  units?: Record<string, string>
}

export interface Rendered {
  host: HTMLElement
  figure: HTMLElement
  collector: FigureCollector
  report: PanelReport
  destroy(): void
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Mount the target offscreen in export mode and wait until it has finished drawing. */
export async function renderOffscreen(t: ExportTarget, settings: ExportSettings, timeoutMs = 90_000): Promise<Rendered> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-30000px;top:0;pointer-events:none;'
  document.body.appendChild(host)
  const collector = new FigureCollector()
  const report: PanelReport = { rows: [], notes: [] }
  const app = mount(ExportHost, { target: host, props: { component: t.component, props: { ...t.props, report }, settings, collector, panelId: t.panelId ?? t.id } })
  const destroy = () => {
    unmount(app)
    host.remove()
  }
  try {
    const t0 = performance.now()
    let stableSince = 0
    let lastSig = ''
    for (;;) {
      await frame()
      const fig = (t.selector ? host.querySelector<HTMLElement>(t.selector) : host.querySelector<HTMLElement>('[data-export-root]')) ?? null
      const loading = host.querySelector('.loading, [data-loading]')
      const marks = fig?.querySelectorAll('svg path, svg circle, svg rect, svg image, canvas').length ?? 0
      const sig = `${marks}:${fig?.getBoundingClientRect().height ?? 0}`
      if (fig && !loading && marks > 0) {
        if (sig !== lastSig) {
          lastSig = sig
          stableSince = performance.now()
        } else if (performance.now() - stableSince > 250) {
          await frame()
          return { host, figure: fig, collector, report, destroy }
        }
      }
      if (performance.now() - t0 > timeoutMs) throw new Error(`export render of ${t.id} timed out`)
      await new Promise((r) => setTimeout(r, 30))
    }
  } catch (e) {
    destroy()
    throw e
  }
}
