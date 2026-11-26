import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MemorySource } from '../../src/lib/sources/memory'

export const FIX = resolve(__dirname, '../fixtures/out')
export const haveFixtures = existsSync(join(FIX, 'small-protwise.pkt/manifest.json'))

export function folderFiles(dir: string, prefix = ''): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) Object.assign(out, folderFiles(p, prefix + n + '/'))
    else out[prefix + n] = new Uint8Array(readFileSync(p))
  }
  return out
}

export function fixtureSource(name: string) {
  return new MemorySource(name, folderFiles(join(FIX, `${name}.pkt`), `${name}.pkt/`))
}

export function fixtureZip(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIX, `${name}.pkt.zip`)))
}
