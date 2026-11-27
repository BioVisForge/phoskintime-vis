import { zipSync } from 'fflate'
import type { LoadedBundle } from '../model/bundle'
import type { PanelDef } from '../panels/types'
import { PANELS } from '../panels/registry'
import { availability } from '../panels/availability'
import { app } from '../ui/state.svelte'
import { download } from './figure'
import { exportTarget, type Format, type ExportFile } from './formats'
import { FitError, type FitIssue } from './compose'
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

export function openExport(ids: string[], all = false, extra: { formats?: Format[]; fit?: FitIssue[]; custom?: { title: string; make: () => Promise<ExportTarget[]> } } = {}) {
  app.export = { open: true, targetIds: ids, all, ...extra }
}

/**
 * Export every target in every format. A target that does not fit its width is not exported; the
 * others still run so that one FitError lists every such panel, and no partial set is returned.
 */
export async function runExport(targets: ExportTarget[], formats: Format[], s: ExportSettings, onProgress?: (msg: string) => void): Promise<ExportFile[]> {
  const files: ExportFile[] = []
  const issues: FitIssue[] = []
  for (const t of targets) {
    for (const f of formats) {
      onProgress?.(`${t.title}: ${f.toUpperCase()}`)
      try {
        files.push(await exportTarget(t, f, s))
      } catch (e) {
        if (!(e instanceof FitError)) throw e
        // same figure, same width: the other formats would not fit either
        for (const i of e.issues) if (!issues.some((x) => x.panelId === i.panelId)) issues.push(i)
        break
      }
    }
  }
  if (issues.length) throw new FitError(issues)
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
    // does not fit at the chosen pt size: open the dialog with the warning and its fixes
    if (e instanceof FitError) {
      app.toast = `${def.title} does not fit ${loadSettings().widthMm} mm at ${loadSettings().fontPt} pt`
      openExport([def.id], false, { formats: [fmt], fit: e.issues })
      return
    }
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
