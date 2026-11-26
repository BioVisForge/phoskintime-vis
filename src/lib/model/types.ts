/**
 * The app's internal data model. Panels see only these types, never the raw manifest of a
 * specific bundle_schema version: version adapters (src/lib/contracts/adapters) map each
 * supported schema version onto this model.
 */

export type ColumnValues = Float64Array | (string | null)[] | (boolean | null)[]

/** A decoded table, column-oriented. Numeric nulls are NaN in `values` and false in `valid`. */
export interface Column {
  name: string
  dtype: 'float64' | 'float32' | 'int64' | 'int32' | 'string' | 'bool'
  unit: string | null
  values: ColumnValues
  /** For numeric columns: valid[i] === 0 means the value is null (a gap, never zero). */
  valid?: Uint8Array
}

export interface Table {
  name: string
  path: string
  rows: number
  columns: Record<string, Column>
}

export interface NpyArray {
  dtype: string
  shape: number[]
  fortranOrder: boolean
  data: Float64Array | Float32Array | Int32Array | BigInt64Array | Uint8Array
}

export interface FileEntry {
  path: string
  sha256: string
  bytes: number
  kind: 'provenance' | 'table' | 'array' | 'resim'
  table?: string
  rows?: number
  columns?: { name: string; dtype: Column['dtype']; unit: string | null; nullable: boolean }[]
  array?: { name: string; dtype?: string; shape?: number[]; axes?: string[]; unit?: string | null }
  passthrough?: { sourcePath: string; sheet: string | null }
}

export interface ParameterMeta {
  name: string
  label: string | null
  group: string | null
  unit: string | null
  description: string | null
}

export interface LayerMeta {
  id: string
  label: string | null
  unit: string | null
  foldChangeBaseline: { time: number; method: string | null; note: string | null } | null
}

export interface KnownIssue {
  id: string
  severity: string | null
  status: string | null
  title: string | null
  text: string | null
}

export interface Reasoned {
  artifact: string
  reason: string
  workflow: string | null
}

export interface BundleMeta {
  schemaVersion: string
  adapter: string
  bundleId: string
  createdUtc: string
  phoskintimeVersion: string
  gitCommit: string
  gitBranch: string | null
  repository: string | null
  workflows: string[]
  modelId: string
  modelVariant: string | null
  configSha256: string
  parameterOrderSha256: string
  stateOrderSha256: string
  inputs: { name: string; sha256: string; bytes: number | null }[]
  files: FileEntry[]
  layers: LayerMeta[]
  parameters: ParameterMeta[]
  parameterGroups: { id: string; label: string | null; unit: string | null }[]
  missing: Reasoned[]
  skipped: Reasoned[]
  warnings: { code: string | null; message: string; issue: string | null }[]
  /** null when the manifest has no known_issues_open field (different from "none open"). */
  knownIssuesOpen: KnownIssue[] | null
  knownIssuesSource: { path: string | null; commit: string | null } | null
}

export type VerifyState = 'pending' | 'verified' | 'mismatch' | 'error'

export interface FileCheck {
  path: string
  expected: string
  actual: string | null
  ok: boolean
  error?: string
}
