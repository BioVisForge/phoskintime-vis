import { describe, expect, it } from 'vitest'
import { parseNpy, npyIndex } from '../../src/lib/io/npy'

function makeNpy(descr: string, shape: number[], data: ArrayBufferView, fortran = false, version = 1): ArrayBuffer {
  let header = `{'descr': '${descr}', 'fortran_order': ${fortran ? 'True' : 'False'}, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`
  const pre = version === 1 ? 10 : 12
  const total = Math.ceil((pre + header.length + 1) / 64) * 64
  header = header.padEnd(total - pre - 1, ' ') + '\n'
  const buf = new Uint8Array(total + data.byteLength)
  buf.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, version, 0])
  const dv = new DataView(buf.buffer)
  if (version === 1) dv.setUint16(8, header.length, true)
  else dv.setUint32(8, header.length, true)
  buf.set(new TextEncoder().encode(header), pre)
  buf.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), total)
  return buf.buffer
}

describe('npy parser', () => {
  it('reads f8 C-order 3-D', () => {
    const d = Float64Array.from({ length: 24 }, (_, i) => i * 0.5)
    const a = parseNpy(makeNpy('<f8', [2, 3, 4], d))
    expect(a.shape).toEqual([2, 3, 4])
    expect(a.data[npyIndex(a, [1, 2, 3])]).toBe(23 * 0.5)
  })
  it('reads Fortran order', () => {
    const d = Float64Array.from([1, 4, 2, 5, 3, 6]) // 2x3 [[1,2,3],[4,5,6]] in F order
    const a = parseNpy(makeNpy('<f8', [2, 3], d, true))
    expect(a.data[npyIndex(a, [0, 2])]).toBe(3)
    expect(a.data[npyIndex(a, [1, 0])]).toBe(4)
  })
  it('reads v2 headers, f4, i4 and 1-D shapes', () => {
    expect(Array.from(parseNpy(makeNpy('<f4', [3], Float32Array.from([1, 2, 3]), false, 2)).data as ArrayLike<number>)).toEqual([1, 2, 3])
    expect(Array.from(parseNpy(makeNpy('<i4', [2], Int32Array.from([-1, 7]))).data as ArrayLike<number>)).toEqual([-1, 7])
  })
  it('rejects bad magic, big-endian and object dtypes', () => {
    expect(() => parseNpy(new Uint8Array(20).buffer)).toThrow(/magic/)
    expect(() => parseNpy(makeNpy('>f8', [1], new Float64Array(1)))).toThrow(/big-endian/)
    expect(() => parseNpy(makeNpy('|O', [1], new Float64Array(1)))).toThrow(/unsupported/)
  })
})
