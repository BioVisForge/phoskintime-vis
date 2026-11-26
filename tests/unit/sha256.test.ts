import { describe, expect, it } from 'vitest'
import { sha256Hex, orderSha256 } from '../../src/lib/io/sha256'
import { createHash } from 'node:crypto'

describe('sha256', () => {
  it('matches known vectors', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Hex(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
  it('order hash is sha256 of newline-joined names', async () => {
    expect(await orderSha256(['a', 'b'])).toBe(createHash('sha256').update('a\nb').digest('hex'))
  })
})
