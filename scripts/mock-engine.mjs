// MOCK of the draft pktengine API (contracts/pktengine/0.1-draft/openapi.yaml). Development and
// e2e only. It does NOT solve any ODE: "simulate" rescales the bundle's stored best-fit deviation
// from 1 by a made-up factor, so its output has no scientific meaning. It exists so the What-if
// view can be built and tested before PhosKinTime ships pktengine.
//
// Usage: node scripts/mock-engine.mjs [--port 8765] <bundle.pkt dir> [...]
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parquetRead } from 'hyparquet'
import { tableToIPC, tableFromArrays } from 'apache-arrow'

const args = process.argv.slice(2)
let port = 8765
const dirs = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') port = Number(args[++i])
  else dirs.push(args[i])
}

async function readTable(dir, name) {
  const buf = readFileSync(join(dir, 'tables', `${name}.parquet`))
  let rows
  await parquetRead({ file: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), rowFormat: 'object', onComplete: (r) => (rows = r) })
  return rows
}

const bundles = new Map()
for (const d of dirs) {
  const m = JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8'))
  const traj = (await readTable(d, 'trajectories')).filter((r) => r.sample_id === 'best')
  const params = (await readTable(d, 'parameters')).filter((r) => r.sample_id === 'best')
  bundles.set(m.bundle_id, { m, traj, params: new Map(params.map((p) => [p.name, p])) })
}

function simulate(b, req) {
  const factor = new Map()
  for (const [name, v] of Object.entries(req.parameters ?? {})) {
    const p = b.params.get(name)
    if (!p || !(p.value > 0) || !(v > 0)) continue
    const key = p.protein ?? '*'
    factor.set(key, (factor.get(key) ?? 1) * Math.sqrt(v / p.value))
  }
  const ko = new Set((req.knockouts ?? []).map((k) => k.id))
  return b.traj.map((r) => {
    const f = (factor.get(r.protein) ?? 1) * (factor.get('*') ?? 1)
    const v = r.value_pred == null ? null : ko.has(r.protein) ? 1 : 1 + (r.value_pred - 1) * f
    return { state: r.state, layer: r.layer, protein: r.protein, time: r.time, value: v }
  })
}

const INFO = {
  status: 'ok', engine: 'mock-pktengine', version: '0.0.0-mock', commit: 'mock', api_version: '0.1-draft',
  capabilities: { simulate: true, batch: true, whatif_ops: ['set_parameter', 'knockout'], knockout_targets: ['protein'], model_variants: ['distributive'], output_formats: ['arrow', 'json'], bundle_schemas: ['1.0'] },
}

createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type, accept')
  res.setHeader('access-control-expose-headers', 'x-engine, x-engine-version')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  const send = (code, obj) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(obj))
  let body = ''
  for await (const c of req) body += c
  const j = body ? JSON.parse(body) : {}
  const b = j.bundle_id ? bundles.get(j.bundle_id) : null
  if (req.url === '/health') return send(200, INFO)
  if (req.url === '/bundles') return send(200, [...bundles.values()].map((x) => ({ bundle_id: x.m.bundle_id, model_id: x.m.model.model_id, variant: x.m.model.variant })))
  if (j.bundle_id && !b) return send(404, { error: `unknown bundle ${j.bundle_id}` })
  if (req.url === '/verify') {
    const rows = simulate(b, {})
    let max = 0
    rows.forEach((r, i) => r.value != null && b.traj[i].value_pred != null && (max = Math.max(max, Math.abs(r.value - b.traj[i].value_pred))))
    return send(200, { bundle_id: j.bundle_id, reproduces: max <= 1e-9, max_abs_diff: max, tolerance: 1e-9, n_compared: rows.length, note: 'mock engine: replays stored trajectories, so it reproduces trivially' })
  }
  if (req.url === '/simulate') {
    const rows = simulate(b, j)
    if ((req.headers.accept ?? '').includes('arrow')) {
      const t = tableFromArrays({ state: rows.map((r) => r.state), layer: rows.map((r) => r.layer), protein: rows.map((r) => r.protein), time: Float64Array.from(rows, (r) => r.time), value: rows.map((r) => r.value) })
      return res.writeHead(200, { 'content-type': 'application/vnd.apache.arrow.stream', 'x-engine': INFO.engine, 'x-engine-version': INFO.version }).end(Buffer.from(tableToIPC(t, 'stream')))
    }
    return send(200, { engine: INFO.engine, version: INFO.version, rows })
  }
  if (req.url === '/simulate/batch') return send(200, { results: (j.requests ?? []).map((r) => ({ engine: INFO.engine, version: INFO.version, rows: simulate(bundles.get(r.bundle_id), r) })) })
  send(404, { error: 'not found' })
}).listen(port, '127.0.0.1', () => console.log(`mock-pktengine on http://127.0.0.1:${port} serving ${[...bundles.keys()].join(', ')}`))
