/**
 * EngineConnector: the viewer's only view of a simulation engine (Milestone 2). Engines report
 * what they can do; the What-if view enables controls only for reported capabilities. Engine
 * output is never presented as stored bundle results: every view labels it with engine + version.
 */
export interface EngineCapabilities {
  simulate: boolean
  batch: boolean
  whatifOps: ('set_parameter' | 'knockout')[]
  knockoutTargets: string[]
  modelVariants: string[]
  outputFormats: ('arrow' | 'json')[]
  bundleSchemas: string[]
}

export interface EngineInfo {
  engine: string
  version: string
  commit: string
  apiVersion: string | null
  status: 'ok' | 'degraded'
  capabilities: EngineCapabilities
}

export interface SimRequest {
  bundleId: string
  parameters?: Record<string, number>
  knockouts?: { target: string; id: string }[]
  times?: number[]
}

export interface SimRow {
  state: string
  layer: string
  protein: string
  time: number
  value: number | null
}

export interface SimResult {
  engine: string
  version: string
  rows: SimRow[]
}

export interface VerifyResult {
  bundleId: string
  reproduces: boolean
  maxAbsDiff: number
  tolerance: number
  nCompared: number
  note: string | null
}

export interface EngineConnector {
  readonly url: string
  health(): Promise<EngineInfo>
  bundles(): Promise<{ bundleId: string; modelId: string | null; variant: string | null }[]>
  simulate(req: SimRequest): Promise<SimResult>
  simulateBatch(reqs: SimRequest[]): Promise<SimResult[]>
  verify(bundleId: string): Promise<VerifyResult>
}
