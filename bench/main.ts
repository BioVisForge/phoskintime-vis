// Parquet reader benchmark (dev only). Decodes the same file to columns with each reader.
import { parquetRead } from 'hyparquet'
import initPW, { readParquet } from 'parquet-wasm/esm/parquet_wasm.js'
import pwWasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url'
import { tableFromIPC } from 'apache-arrow'
import * as duckdb from '@duckdb/duckdb-wasm'
import duckWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

const FILE = new URLSearchParams(location.search).get('file') ?? '/fixtures/network.pkt/tables/trajectories.parquet'
const REPS = 5

async function hyp(buf: ArrayBuffer) {
  const cols: Record<string, unknown[]> = {}
  await parquetRead({ file: buf, onChunk: (c) => { (cols[c.columnName] ??= []).push(c.columnData) } })
  return Object.keys(cols).length
}
let pwReady: Promise<unknown> | null = null
async function pw(buf: ArrayBuffer) {
  pwReady ??= initPW(pwWasmUrl)
  await pwReady
  const t = readParquet(new Uint8Array(buf))
  const arrow = tableFromIPC(t.intoIPCStream())
  const n = arrow.numCols
  for (const f of arrow.schema.fields) arrow.getChild(f.name)!.toArray()
  return n
}
let db: duckdb.AsyncDuckDB | null = null
async function duck(buf: ArrayBuffer) {
  if (!db) {
    const w = new Worker(duckWorker)
    db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), w)
    await db.instantiate(duckWasm)
  }
  await db.registerFileBuffer('t.parquet', new Uint8Array(buf.slice(0)))
  const c = await db.connect()
  const r = await c.query("select * from 't.parquet'")
  for (const f of r.schema.fields) r.getChild(f.name)!.toArray()
  await c.close(); await db.dropFile('t.parquet')
  return r.numCols
}
async function time(name: string, fn: (b: ArrayBuffer) => Promise<number>, buf: ArrayBuffer) {
  const t0 = performance.now(); await fn(buf); const first = performance.now() - t0 // includes init/wasm compile
  const xs: number[] = []
  for (let i = 0; i < REPS; i++) { const t = performance.now(); await fn(buf); xs.push(performance.now() - t) }
  xs.sort((a, b) => a - b)
  return { name, first_ms: +first.toFixed(1), median_ms: +xs[Math.floor(REPS / 2)].toFixed(1), min_ms: +xs[0].toFixed(1) }
}
const buf = await (await fetch(FILE)).arrayBuffer()
const res = [await time('hyparquet', hyp, buf), await time('parquet-wasm+arrow', pw, buf), await time('duckdb-wasm', duck, buf)]
;(window as any).__bench = { file: FILE, bytes: buf.byteLength, ua: navigator.userAgent, res }
document.getElementById('out')!.textContent = JSON.stringify((window as any).__bench, null, 2)
