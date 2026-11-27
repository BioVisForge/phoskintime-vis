import { findRoot, SourceError, type DataSource } from './types'

/** In-memory source (tests, and bundles fetched by the Pages demo). */
export class MemorySource implements DataSource {
  readonly kind = 'memory' as const
  private files = new Map<string, Uint8Array>()
  constructor(readonly label: string, files: Record<string, Uint8Array>) {
    const root = findRoot(Object.keys(files))
    for (const [k, v] of Object.entries(files)) if (k.startsWith(root)) this.files.set(k.slice(root.length), v)
  }
  list() {
    return [...this.files.keys()]
  }
  async read(path: string) {
    const b = this.files.get(path)
    if (!b) throw new SourceError(`file not in bundle: ${path}`)
    return b.slice().buffer as ArrayBuffer
  }
}
