import { zipSync } from 'fflate'
import type { LoadedBundle } from '../model/bundle'
import type { PanelDef } from '../panels/types'
import { PANELS } from '../panels/registry'
import { availability } from '../panels/availability'
import { app } from '../ui/state.svelte'
import { download } from './figure'
import { exportTarget, type Format, type ExportFile } from './formats'
import type { ExportTarget } from './render'
import { exportFilename, loadSettings, type ExportSettings } from './settings'

/** Column units from the bundle's table definitions (CSV header). */
function unitsFor(def: PanelDef, b: LoadedBundle): Record<string, string> {
  const u: Record<string, string> = {}
  for (const r of def.requires) for (const c of b.tableEntry(r.table)?.columns ?? []) if (c.unit) u[c.name] = c.unit
  return u
}

export function panelTarget(def: PanelDef, b: LoadedBundle): ExportTarget {
  return {
    id: def.id,
    panelId: def.id,
    title: def.title,
    caption: def.description,
    component: def.component,
    props: { bundle: b },
    bundleIds: [b.meta.bundleId],
    commits: [b.meta.gitCommit],
    units: unitsFor(def, b),
  }
}

/** A comparison-mode section, rendered offscreen from the Compare view; filenames carry both bundle ids. */
export async function compareTarget(id: string, title: string, caption: string, a: LoadedBundle, b: LoadedBundle, rows: Record<string, unknown>[]): Promise<ExportTarget> {
  const { default: Compare } = await import('../ui/Compare.svelte')
  return {
    id: `compare-${id}`,
    title: `${title} (A ${a.label} vs B ${b.label})`,
    caption,
    component: Compare,
    props: {},
    selector: `[data-figure="${id}"]`,
    bundleIds: [a.meta.bundleId, b.meta.bundleId],
    commits: [a.meta.gitCommit, b.meta.gitCommit],
    report: { rows, notes: [] },
  }
}

export function openExport(ids: string[], all = false) {
  app.export = { open: true, targetIds: ids, all }
}

export async function runExport(targets: ExportTarget[], formats: Format[], s: ExportSettings, onProgress?: (msg: string) => void): Promise<ExportFile[]> {
  const files: ExportFile[] = []
  for (const t of targets) {
    for (const f of formats) {
      onProgress?.(`${t.title}: ${f.toUpperCase()}`)
      files.push(await exportTarget(t, f, s))
    }
  }
  return files
}

export function saveFiles(files: ExportFile[], zipName?: string) {
  if (files.length === 1 && !zipName) {
    const f = files[0]
    download(f.name, new Blob([f.data as BlobPart], { type: f.mime }))
    return
  }
  const z = zipSync(Object.fromEntries(files.map((f) => [f.name, f.data])), { level: 6 })
  download(zipName ?? 'phoskintime-vis-export.zip', new Blob([z as BlobPart], { type: 'application/zip' }))
}

export async function quickExport(def: PanelDef, b: LoadedBundle, fmt: Format) {
  try {
    app.toast = `Exporting ${def.title} as ${fmt.toUpperCase()}…`
    const files = await runExport([panelTarget(def, b)], [fmt], loadSettings())
    saveFiles(files)
    app.toast = `Saved ${files[0].name}`
  } catch (e) {
    app.toast = `Export failed: ${(e as Error).message}`
  }
}

/** Every available panel of the active bundle, all chosen formats, one zip. */
export function allTargets(b: LoadedBundle): ExportTarget[] {
  return PANELS.filter((p) => (p.workflow === 'any' || b.meta.workflows.includes(p.workflow)) && availability(p, b).ok).map((p) => panelTarget(p, b))
}

export function allZipName(b: LoadedBundle) {
  return exportFilename('all-panels', [b.meta.bundleId], 'zip')
}
