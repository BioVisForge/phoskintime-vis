/** Minimal NumPy .npy (v1/v2/v3) parser: little-endian numeric dtypes, C or Fortran order. */
import type { NpyArray } from '../model/types'

const MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59] // \x93NUMPY

export function parseNpy(buf: ArrayBuffer): NpyArray {
  const u8 = new Uint8Array(buf)
  for (let i = 0; i < MAGIC.length; i++) if (u8[i] !== MAGIC[i]) throw new Error('not a .npy file (bad magic)')
  const major = u8[6]
  const dv = new DataView(buf)
  let headerLen: number
  let offset: number
  if (major === 1) {
    headerLen = dv.getUint16(8, true)
    offset = 10
  } else if (major === 2 || major === 3) {
    headerLen = dv.getUint32(8, true)
    offset = 12
  } else throw new Error(`unsupported .npy version ${major}`)
  const header = new TextDecoder(major === 3 ? 'utf-8' : 'latin1').decode(u8.subarray(offset, offset + headerLen))
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1]
  const fortran = /'fortran_order':\s*(True|False)/.exec(header)?.[1] === 'True'
  const shapeStr = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1]
  if (!descr || shapeStr === undefined) throw new Error('malformed .npy header')
  const shape = shapeStr.split(',').map((s) => s.trim()).filter((s) => s.length).map(Number)
  const n = shape.reduce((a, b) => a * b, 1)
  const start = offset + headerLen
  const body = buf.slice(start)
  const endian = descr[0]
  if (endian === '>') throw new Error('big-endian .npy is not supported')
  const kind = descr.slice(1)
  let data: NpyArray['data']
  switch (kind) {
    case 'f8': data = new Float64Array(body, 0, n); break
    case 'f4': data = new Float32Array(body, 0, n); break
    case 'i4': data = new Int32Array(body, 0, n); break
    case 'i8': data = new BigInt64Array(body, 0, n); break
    case 'u1': case 'b1': data = new Uint8Array(body, 0, n); break
    default: throw new Error(`unsupported .npy dtype ${descr}`)
  }
  return { dtype: descr, shape, fortranOrder: fortran, data }
}

/** Flat index for a C- or Fortran-ordered array. */
export function npyIndex(a: NpyArray, idx: number[]): number {
  let k = 0
  if (!a.fortranOrder) {
    for (let d = 0; d < a.shape.length; d++) k = k * a.shape[d] + idx[d]
  } else {
    for (let d = a.shape.length - 1; d >= 0; d--) k = k * a.shape[d] + idx[d]
  }
  return k
}
