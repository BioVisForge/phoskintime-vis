import { LoadedBundle } from '../model/bundle'
import { ContractError } from '../contracts/index'
import type { DataSource } from '../sources/types'

export interface LoadError {
  label: string
  message: string
  kind: string
  details: string[]
}

class AppState {
  bundles = $state<LoadedBundle[]>([])
  errors = $state<LoadError[]>([])
  activeId = $state<string | null>(null)
  compareA = $state<string | null>(null)
  compareB = $state<string | null>(null)
  view = $state<'viewer' | 'compare' | 'whatif'>('viewer')
  /** Draw many-line panels on canvas instead of SVG. */
  rawLines = $state(false)
  verifyProgress = $state<Record<string, string>>({})
  /** Feature flags (Milestone 2). Off unless ?engine=mock is in the URL. */
  engineFlag = $state(typeof location !== 'undefined' && new URLSearchParams(location.search).get('engine') === 'mock')

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

export const app = new AppState()
