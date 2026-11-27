/** Parquet -> column-oriented Table, via hyparquet (see docs/decisions/0001-parquet-reader.md). */
import { parquetRead, parquetMetadata } from 'hyparquet'
import type { Column, Table, FileEntry } from '../model/types'

type Chunk = { columnName: string; columnData: ArrayLike<unknown>; rowStart: number; rowEnd: number }

export async function decodeParquet(buf: ArrayBuffer, name: string, path: string, entry?: FileEntry): Promise<Table> {
  const meta = parquetMetadata(buf)
  const rows = Number(meta.num_rows)
  const chunks: Record<string, Chunk[]> = {}
  await parquetRead({
    file: buf,
    metadata: meta,
    onChunk: (c) => {
      ;(chunks[c.columnName] ??= []).push(c as Chunk)
    },
  })
  const declared = new Map((entry?.columns ?? []).map((c) => [c.name, c]))
  const columns: Record<string, Column> = {}
  for (const [cname, list] of Object.entries(chunks)) {
    list.sort((a, b) => a.rowStart - b.rowStart)
    const dec = declared.get(cname)
    const first = firstNonNull(list)
    const isNum = dec ? ['float64', 'float32', 'int64', 'int32'].includes(dec.dtype) : typeof first === 'number' || typeof first === 'bigint'
    const isBool = dec ? dec.dtype === 'bool' : typeof first === 'boolean'
    if (isNum) {
      const values = new Float64Array(rows)
      const valid = new Uint8Array(rows)
      for (const c of list) {
        const d = c.columnData
        for (let i = 0; i < d.length; i++) {
          const r = c.rowStart + i
          if (r >= rows) break
          const v = d[i] as number | bigint | null | undefined
          if (v === null || v === undefined) {
            values[r] = NaN
          } else {
            values[r] = typeof v === 'bigint' ? Number(v) : v
            valid[r] = 1
          }
        }
      }
      columns[cname] = { name: cname, dtype: dec?.dtype ?? 'float64', unit: dec?.unit ?? null, values, valid }
    } else {
      const values: (string | boolean | null)[] = new Array(rows).fill(null)
      for (const c of list) {
        const d = c.columnData
        for (let i = 0; i < d.length && c.rowStart + i < rows; i++) {
          const v = d[i]
          values[c.rowStart + i] = v === undefined || v === null ? null : isBool ? Boolean(v) : String(v)
        }
      }
      columns[cname] = { name: cname, dtype: isBool ? 'bool' : 'string', unit: dec?.unit ?? null, values: values as Column['values'] }
    }
  }
  return { name, path, rows, columns }
}

function firstNonNull(list: Chunk[]): unknown {
  for (const c of list) for (let i = 0; i < c.columnData.length; i++) if (c.columnData[i] != null) return c.columnData[i]
  return null
}
