import { getContext, setContext, untrack } from 'svelte'
import type { LoadedBundle } from '../model/bundle'
import { app } from './state.svelte'

const KEY = Symbol('pkv-panel-id')

/** Set by PanelCard (screen) and the export host, so a panel knows its registry id. */
export function setPanelId(id: string) {
  setContext(KEY, id)
}

/**
 * Persisted local controls for a panel (per bundle and panel id). The offscreen export render of
 * the same panel reads the same values, so an export shows what the screen shows.
 */
export function usePanelState(bundle: LoadedBundle) {
  const id = getContext<string | undefined>(KEY) ?? 'anon'
  const store = untrack(() => app.panelUi(bundle.meta.bundleId, id, {} as Record<string, unknown>))
  return {
    get<T>(k: string, d: T): T {
      return (k in store ? store[k] : d) as T
    },
    set(k: string, v: unknown) {
      store[k] = v
    },
  }
}

/** The registry id of the panel being rendered (screen or export), or null outside a panel. */
export function getPanelId(): string | null {
  return getContext<string | undefined>(KEY) ?? null
}
