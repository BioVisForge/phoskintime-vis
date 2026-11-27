import type { EngineConnector, EngineInfo, SimRequest, SimResult, VerifyResult, SimRow } from '../engine/types'

/**
 * EngineHttpSource: talks to a pktengine-compatible server over localhost HTTP
 * (contracts/pktengine/0.1-draft/openapi.yaml). Only loopback URLs are accepted: the viewer must
 * not send bundle data anywhere else.
 */
export class EngineHttpSource implements EngineConnector {
  readonly url: string
  constructor(url: string) {
    const u = new URL(url)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) throw new Error('Engine URL must be on this machine (127.0.0.1 or localhost).')
    this.url = u.origin
  }

  private async json<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(this.url + path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/vnd.apache.arrow.stream, application/json' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`engine ${path}: HTTP ${r.status}`)
    return r.json() as Promise<T>
  }

  async health(): Promise<EngineInfo> {
    const h = await this.json<any>('/health')
    const c = h.capabilities ?? {}
    return {
      engine: String(h.engine), version: String(h.version), commit: String(h.commit), apiVersion: h.api_version ?? null, status: h.status === 'ok' ? 'ok' : 'degraded',
      capabilities: { simulate: !!c.simulate, batch: !!c.batch, whatifOps: c.whatif_ops ?? [], knockoutTargets: c.knockout_targets ?? [], modelVariants: c.model_variants ?? [], outputFormats: c.output_formats ?? ['json'], bundleSchemas: c.bundle_schemas ?? [] },
    }
  }

  async bundles() {
    const b = await this.json<any[]>('/bundles')
    return b.map((x) => ({ bundleId: String(x.bundle_id), modelId: x.model_id ?? null, variant: x.variant ?? null }))
  }

  private toBody(r: SimRequest) {
    return { bundle_id: r.bundleId, parameters: r.parameters ?? {}, knockouts: r.knockouts ?? [], times: r.times }
  }

  async simulate(req: SimRequest): Promise<SimResult> {
    const r = await fetch(this.url + '/simulate', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/vnd.apache.arrow.stream, application/json' }, body: JSON.stringify(this.toBody(req)) })
    if (!r.ok) throw new Error(`engine /simulate: HTTP ${r.status}`)
    const ct = r.headers.get('content-type') ?? ''
    if (ct.includes('arrow')) {
      const { tableFromIPC } = await import('apache-arrow')
      const t = tableFromIPC(new Uint8Array(await r.arrayBuffer()))
      const col = (n: string) => t.getChild(n)?.toArray() as ArrayLike<unknown>
      const S = col('state'), L = col('layer'), P = col('protein'), T = col('time'), V = col('value')
      const rows: SimRow[] = Array.from({ length: t.numRows }, (_, i) => ({ state: String(S[i]), layer: String(L[i]), protein: String(P[i]), time: Number(T[i]), value: V[i] === null || V[i] === undefined ? null : Number(V[i]) }))
      return { engine: r.headers.get('x-engine') ?? 'unknown', version: r.headers.get('x-engine-version') ?? 'unknown', rows }
    }
    const j = await r.json()
    return { engine: j.engine, version: j.version, rows: j.rows }
  }

  async simulateBatch(reqs: SimRequest[]): Promise<SimResult[]> {
    const j = await this.json<{ results: SimResult[] }>('/simulate/batch', { requests: reqs.map((r) => this.toBody(r)) })
    return j.results
  }

  async verify(bundleId: string): Promise<VerifyResult> {
    const v = await this.json<any>('/verify', { bundle_id: bundleId })
    return { bundleId: v.bundle_id, reproduces: !!v.reproduces, maxAbsDiff: v.max_abs_diff, tolerance: v.tolerance, nCompared: v.n_compared, note: v.note ?? null }
  }
}
