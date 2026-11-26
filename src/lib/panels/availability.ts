import type { LoadedBundle } from '../model/bundle'
import { parseVersion } from '../contracts/version'
import type { Availability, PanelDef } from './types'

/** Panels are enabled by what the bundle contains, never by fixed lists. */
export function availability(p: PanelDef, b: LoadedBundle): Availability {
  if (p.workflow !== 'any' && !b.meta.workflows.includes(p.workflow)) return { ok: false, reason: `Not a ${p.workflow} bundle.` }
  const v = parseVersion(b.meta.schemaVersion)
  const min = parseVersion(p.minSchema)
  if (v && min && (v.major < min.major || (v.major === min.major && v.minor < min.minor)))
    return { ok: false, reason: `Needs bundle schema ${p.minSchema} or newer (bundle is ${b.meta.schemaVersion}).` }
  for (const r of p.requires) {
    if (!b.hasTable(r.table)) {
      const why = b.missingReason(r.table)
      return { ok: false, reason: why ? `Manifest: “${why}”` : `Table “${r.table}” is not in this bundle (no reason given in the manifest).` }
    }
    if (r.columns && !b.hasTable(r.table, r.columns)) {
      const have = new Set((b.tableEntry(r.table)?.columns ?? []).map((c) => c.name))
      return { ok: false, reason: `Table “${r.table}” lacks column(s): ${r.columns.filter((c) => !have.has(c)).join(', ')}.` }
    }
  }
  for (const a of p.arrays ?? []) {
    if (!b.arrayEntry(a)) {
      const why = b.missingReason(a)
      return { ok: false, reason: why ? `Manifest: “${why}”` : `Array “${a}” is not in this bundle (no reason given in the manifest).` }
    }
  }
  return { ok: true, reason: null }
}
