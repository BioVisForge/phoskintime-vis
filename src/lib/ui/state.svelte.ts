import { LoadedBundle } from '../model/bundle'
import { ContractError } from '../contracts/index'
import type { DataSource } from '../sources/types'
import type { Format } from '../export/formats'
import type { FitIssue } from '../export/compose'
import type { ExportTarget } from '../export/render'

export interface LoadError {
  label: string
  message: string
  kind: string
  details: string[]
}

/** Navigation by scientific question. */
export const SECTIONS = [
  { id: 'overview', label: 'Overview', hint: 'Run summary, verification, fit headline, warnings' },
  { id: 'fit', label: 'Fit quality', hint: 'GOF, residuals, KL, errors' },
  { id: 'dynamics', label: 'Dynamics', hint: 'Trajectories, time series, knockouts, kinase activity' },
  { id: 'parameters', label: 'Parameters', hint: 'Distributions, correlations, profiles, regularization' },
  { id: 'uncertainty', label: 'Uncertainty', hint: 'Posterior, intervals, predictive bands, multistart, profiles, Pareto' },
  { id: 'sensitivity', label: 'Sensitivity', hint: 'μ*/σ, perturbation clouds, phase space' },
  { id: 'network', label: 'Steady state & network', hint: 'Steady state, Insights, matrices' },
  { id: 'compare', label: 'Compare', hint: 'Run A vs run B' },
] as const
export type SectionId = (typeof SECTIONS)[number]['id']

export interface Route {
  section: SectionId
  panel: string | null
  params: Record<string, string>
}

function parseHash(h: string): Route {
  const m = /^#\/([a-z]+)(?:\/([A-Za-z0-9-]+))?(?:\?(.*))?$/.exec(h)
  const ids = SECTIONS.map((s) => s.id) as string[]
  if (!m || !ids.includes(m[1])) return { section: 'overview', panel: null, params: {} }
  return { section: m[1] as SectionId, panel: m[2] ?? null, params: Object.fromEntries(new URLSearchParams(m[3] ?? '')) }
}

export function hashFor(section: SectionId, panel: string | null, ctx: Partial<Record<'protein' | 'psite' | 'layer', string | null>>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(ctx)) if (v) q.set(k, v)
  const qs = q.toString()
  return `#/${section}${panel ? '/' + panel : ''}${qs ? '?' + qs : ''}`
}

class AppState {
  bundles = $state<LoadedBundle[]>([])
  errors = $state<LoadError[]>([])
  activeId = $state<string | null>(null)
  compareA = $state<string | null>(null)
  compareB = $state<string | null>(null)
  /** Draw many-line panels on canvas instead of SVG. */
  rawLines = $state(false)
  verifyProgress = $state<Record<string, string>>({})
  engineFlag = $state(typeof location !== 'undefined' && new URLSearchParams(location.search).get('engine') === 'mock')

  route = $state<Route>({ section: 'overview', panel: null, params: {} })
  /** Global context: drives every dependent panel. */
  ctx = $state<{ protein: string | null; psite: string | null; layer: string | null }>({ protein: null, psite: null, layer: null })
  /** Workflow filter (tags), empty = all. */
  workflowFilter = $state<string[]>([])
  theme = $state<'light' | 'dark'>('light')
  density = $state<'comfortable' | 'compact'>('comfortable')
  sidebarOpen = $state(true)
  inspectorOpen = $state(true)
  paletteOpen = $state(false)
  /** Panel whose definition the inspector shows. */
  focusPanel = $state<string | null>(null)
  /** Per-bundle, per-panel local controls (shared by screen and offscreen export renders). */
  private ui = new Map<string, Record<string, unknown>>()
  /** Export dialog: registry panels by id, all panels, or custom targets (comparison sections). */
  export = $state<{ open: boolean; targetIds: string[]; all: boolean; formats?: Format[]; fit?: FitIssue[]; view?: 'full' | 'current'; custom?: { title: string; make: () => Promise<ExportTarget[]> } }>({ open: false, targetIds: [], all: false })
  toast = $state<string | null>(null)

  constructor() {
    if (typeof window === 'undefined') return
    try {
      const t = localStorage.getItem('pkv.theme')
      if (t === 'dark' || t === 'light') this.theme = t
      else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) this.theme = 'dark'
      const d = localStorage.getItem('pkv.density')
      if (d === 'compact' || d === 'comfortable') this.density = d
    } catch {
      /* storage unavailable */
    }
    this.readHash()
    window.addEventListener('hashchange', () => this.readHash())
  }

  readHash() {
    const r = parseHash(location.hash)
    this.route = r
    for (const k of ['protein', 'psite', 'layer'] as const) if (r.params[k] !== undefined) this.ctx[k] = r.params[k] || null
  }

  go(section: SectionId, panel: string | null = null) {
    const h = hashFor(section, panel, this.ctx)
    if (location.hash !== h) location.hash = h
    else this.readHash()
  }

  setCtx(k: 'protein' | 'psite' | 'layer', v: string | null) {
    this.ctx[k] = v
    if (k === 'protein') this.ctx.psite = null
    const h = hashFor(this.route.section, this.route.panel, this.ctx)
    try {
      history.replaceState(null, '', h)
    } catch {
      // Chromium refuses replaceState with a URL on file:// pages (origin "null"): set the hash instead
      if (location.hash !== h) location.hash = h
    }
  }

  setTheme(t: 'light' | 'dark') {
    this.theme = t
    try {
      localStorage.setItem('pkv.theme', t)
    } catch {
      /* ignore */
    }
  }

  setDensity(d: 'comfortable' | 'compact') {
    this.density = d
    try {
      localStorage.setItem('pkv.density', d)
    } catch {
      /* ignore */
    }
  }

  panelUi<T extends Record<string, unknown>>(bundleId: string, panelId: string, defaults: T): T {
    const key = `${bundleId}|${panelId}`
    let s = this.ui.get(key) as T | undefined
    if (!s) {
      s = proxyState(defaults)
      this.ui.set(key, s)
    }
    return s
  }

  get active(): LoadedBundle | undefined {
    return this.bundles.find((b) => b.meta.bundleId === this.activeId) ?? this.bundles[0]
  }

  byId(id: string | null): LoadedBundle | undefined {
    return this.bundles.find((b) => b.meta.bundleId === id)
  }

  async open(source: DataSource): Promise<LoadedBundle | null> {
    try {
      const b = await LoadedBundle.open(source)
      if (this.bundles.some((x) => x.meta.bundleId === b.meta.bundleId)) {
        this.activeId = b.meta.bundleId
        return this.byId(b.meta.bundleId) ?? null
      }
      this.bundles = [...this.bundles, b]
      this.activeId = b.meta.bundleId
      if (!this.compareA) this.compareA = b.meta.bundleId
      else if (!this.compareB) this.compareB = b.meta.bundleId
      b.prefetch('trajectories')
      this.verifyProgress[b.meta.bundleId] = 'checking…'
      b.verify((d, n) => (this.verifyProgress[b.meta.bundleId] = `checking ${d}/${n}`)).then(() => {
        this.verifyProgress[b.meta.bundleId] = b.verifyState
        this.bundles = [...this.bundles] // refresh badges
      })
      return b
    } catch (e) {
      const ce = e instanceof ContractError ? e : null
      this.errors = [...this.errors, { label: source.label, message: (e as Error).message, kind: ce?.kind ?? 'error', details: ce?.details ?? [] }]
      return null
    }
  }

  remove(id: string) {
    this.bundles = this.bundles.filter((b) => b.meta.bundleId !== id)
    if (this.compareA === id) this.compareA = null
    if (this.compareB === id) this.compareB = null
  }
}

function proxyState<T extends Record<string, unknown>>(v: T): T {
  const s = $state(v)
  return s
}

export const app = new AppState()

/** Pick the global value when the list has it, else the first entry. */
export function pick(value: string | null | undefined, list: string[]): string {
  return value && list.includes(value) ? value : (list[0] ?? '')
}
