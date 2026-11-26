import type { Component } from 'svelte'
import type { LoadedBundle } from '../model/bundle'

export type PatternId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10' | 'P11' | 'P12'

export interface Requirement {
  table: string
  columns?: string[]
}

export interface ParityRef {
  file: string
  fn: string
  line: number
  commit: string
}

/** Coverage against PhosKinTime's plot: full, partial, substituted, or a viewer extra (no upstream plot). */
export type Coverage = 'full' | 'partial' | 'substituted' | 'viewer-extra'

export interface PanelReport {
  /** Rows of the plotted data (CSV export, raw-rows view). */
  rows: Record<string, unknown>[]
  /** Notes shown under the panel (e.g. "only the interpolated export is available"). */
  notes: string[]
}

export interface PanelProps {
  bundle: LoadedBundle
  report: PanelReport
}

export interface PanelDef {
  id: string
  title: string
  workflow: 'protwise' | 'networkmodel' | 'any'
  section: string
  requires: Requirement[]
  arrays?: string[]
  /** Minimum bundle_schema (major.minor). */
  minSchema: string
  parity: ParityRef | null
  coverage: Coverage
  patterns: PatternId[]
  /** One sentence: what the panel shows and any difference from PhosKinTime. */
  description: string
  component: Component<PanelProps>
}

export interface Availability {
  ok: boolean
  reason: string | null
}
