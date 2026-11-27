import { unzipSync } from 'fflate'
import { findRoot, SourceError, type DataSource } from './types'

/** A `<run>.pkt.zip` bundle. The archive is inflated once, in memory. */
export class BundleZipSource implements DataSource {
  readonly kind = 'zip' as const
  private files = new Map<string, Uint8Array>()

  constructor(readonly label: string, bytes: Uint8Array) {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes)
    } catch (e) {
      throw new SourceError(`Could not read zip archive: ${(e as Error).message}`)
    }
    const names = Object.keys(entries).filter((n) => !n.endsWith('/'))
    const root = findRoot(names)
    for (const n of names) if (n.startsWith(root)) this.files.set(n.slice(root.length), entries[n])
  }

  static async fromFile(f: File): Promise<BundleZipSource> {
    return new BundleZipSource(f.name, new Uint8Array(await f.arrayBuffer()))
  }

  list(): string[] {
    return [...this.files.keys()]
  }

  async read(path: string): Promise<ArrayBuffer> {
    const b = this.files.get(path)
    if (!b) throw new SourceError(`file not in bundle: ${path}`)
    return b.slice().buffer as ArrayBuffer
  }
}
