/// <reference lib="webworker" />
// Parquet decoding off the main thread.
import { decodeParquet } from '../io/parquet'
import type { FileEntry, Table } from '../model/types'

export type DecodeRequest = { id: number; buf: ArrayBuffer; name: string; path: string; entry?: FileEntry }
export type DecodeResponse = { id: number; table?: Table; error?: string }

self.onmessage = async (ev: MessageEvent<DecodeRequest>) => {
  const { id, buf, name, path, entry } = ev.data
  try {
    const table = await decodeParquet(buf, name, path, entry)
    const transfer: Transferable[] = []
    for (const c of Object.values(table.columns)) {
      if (c.values instanceof Float64Array) transfer.push(c.values.buffer)
      if (c.valid) transfer.push(c.valid.buffer)
    }
    ;(self as unknown as Worker).postMessage({ id, table } satisfies DecodeResponse, transfer)
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id, error: (e as Error).message } satisfies DecodeResponse)
  }
}
