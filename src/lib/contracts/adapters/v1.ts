import type { BundleMeta, FileEntry } from '../../model/types'
import type { VersionAdapter } from './types'

const s = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** bundle_schema 1.x (1.0-draft today; 1.1 adds resim/, which this adapter passes through as files). */
export const adapterV1: VersionAdapter = {
  id: 'v1',
  major: 1,
  maxKnownMinor: 1,
  contract: '1.0-draft',
  draft: true,
  toMeta(m): BundleMeta {
    const files: FileEntry[] = (m.files ?? []).map((f: any) => ({
      path: f.path,
      sha256: f.sha256,
      bytes: f.bytes,
      kind: f.kind,
      table: f.table,
      rows: f.rows,
      columns: f.columns?.map((c: any) => ({ name: c.name, dtype: c.dtype, unit: s(c.unit), nullable: c.nullable ?? true })),
      array: f.array,
      passthrough: f.passthrough ? { sourcePath: f.passthrough.source_path, sheet: s(f.passthrough.sheet) } : undefined,
    }))
    return {
      schemaVersion: m.bundle_schema,
      adapter: this.id,
      bundleId: m.bundle_id,
      createdUtc: m.created_utc,
      phoskintimeVersion: m.producer.phoskintime_version,
      gitCommit: m.producer.git_commit,
      gitBranch: s(m.producer.git_branch),
      repository: s(m.producer.repository),
      workflows: m.workflows,
      modelId: String(m.model.model_id),
      modelVariant: s(m.model.variant),
      configSha256: m.config_sha256,
      parameterOrderSha256: m.parameter_order_sha256,
      stateOrderSha256: m.state_order_sha256,
      inputs: (m.inputs ?? []).map((i: any) => ({ name: i.name, sha256: i.sha256, bytes: i.bytes ?? null })),
      files,
      layers: (m.layers ?? []).map((l: any) => ({
        id: l.id,
        label: s(l.label),
        unit: s(l.unit),
        foldChangeBaseline: l.fold_change_baseline
          ? { time: l.fold_change_baseline.time, method: s(l.fold_change_baseline.method), note: s(l.fold_change_baseline.note) }
          : null,
      })),
      parameters: (m.parameters ?? []).map((p: any) => ({
        name: p.name,
        label: s(p.label),
        group: s(p.group),
        unit: s(p.unit),
        description: s(p.description),
      })),
      parameterGroups: (m.parameter_groups ?? []).map((g: any) => ({ id: g.id, label: s(g.label), unit: s(g.unit) })),
      missing: (m.missing ?? []).map((x: any) => ({ artifact: x.artifact, reason: x.reason, workflow: s(x.workflow) })),
      skipped: (m.skipped ?? []).map((x: any) => ({ artifact: x.artifact, reason: x.reason, workflow: s(x.workflow) })),
      warnings: (m.warnings ?? []).map((w: any) => ({ code: s(w.code), message: w.message, issue: s(w.issue) })),
      knownIssuesOpen: Array.isArray(m.known_issues_open)
        ? m.known_issues_open.map((k: any) =>
            typeof k === 'string'
              ? { id: k, severity: null, status: null, title: null, text: null }
              : { id: k.id, severity: s(k.severity), status: s(k.status), title: s(k.title), text: s(k.text) },
          )
        : null,
      knownIssuesSource: m.known_issues_source ? { path: s(m.known_issues_source.path), commit: s(m.known_issues_source.commit) } : null,
    }
  },
}
