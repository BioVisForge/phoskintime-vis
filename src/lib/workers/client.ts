import { decodeParquet } from '../io/parquet'
import type { FileEntry, Table } from '../model/types'
import type { DecodeResponse } from './decode.worker'
import { record, span } from '../perf/spans'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { res: (t: Table) => void; rej: (e: Error) => void }>()

let workerBroken = false

async function getWorker(): Promise<Worker | null> {
  if (typeof Worker === 'undefined' || workerBroken) return null
  if (!worker) {
    // inline: works from file:// (blob worker) and in the Pages build alike
    const mod = await import('./decode.worker?worker&inline')
    worker = new mod.default()
    worker.onerror = (ev) => {
      const err = new Error(`Parquet worker failed: ${ev.message || 'unknown error'}`)
      for (const p of pending.values()) p.rej(err)
      pending.clear()
      worker = null
      workerBroken = true
    }
    worker.onmessage = (ev: MessageEvent<DecodeResponse>) => {
      const p = pending.get(ev.data.id)
      if (!p) return
      pending.delete(ev.data.id)
      if (ev.data.error) p.rej(new Error(ev.data.error))
      else {
        record('decode (worker)', ev.data.table!.name, performance.now() - (ev.data.ms ?? 0), ev.data.ms ?? 0)
        p.res(ev.data.table!)
      }
    }
  }
  return worker
}

/** Decode a Parquet file in the worker (falls back to the calling thread where workers don't exist). */
export async function decodeTable(buf: ArrayBuffer, name: string, path: string, entry?: FileEntry): Promise<Table> {
  const w = await getWorker()
  if (!w) return span('decode (main)', name, () => decodeParquet(buf, name, path, entry))
  const id = ++seq
  return new Promise((res, rej) => {
    pending.set(id, { res, rej })
    w.postMessage({ id, buf, name, path, entry: entry ? JSON.parse(JSON.stringify(entry)) : undefined }, [buf])
  })
}
