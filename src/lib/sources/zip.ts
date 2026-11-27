import { unzip, unzipSync } from 'fflate'
import { findRoot, SourceError, type DataSource } from './types'
import { span, spanAsync } from '../perf/spans'

/**
 * A `<run>.pkt.zip` bundle. The central directory is read when the archive is opened (a damaged
 * archive is refused then); each file is inflated the first time it is read, by fflate's
 * asynchronous unzip (in a worker where the platform has workers), and kept in memory. Opening
 * therefore costs only the directory, and inflating (≈ 130 ms for the network fixture) no longer
 * runs on the main thread.
 */
export class BundleZipSource implements DataSource {
  readonly kind = 'zip' as const
  /** bundle path → archive entry name */
  private entries = new Map<string, string>()
  private files = new Map<string, Promise<Uint8Array>>()

  constructor(readonly label: string, private bytes: Uint8Array) {
    const names: string[] = []
    try {
      // the filter sees every entry and declines all of them: nothing is inflated
      span('zip directory', label, () => unzipSync(bytes, { filter: (f) => (names.push(f.name), false) }))
    } catch (e) {
      throw new SourceError(`Could not read zip archive: ${(e as Error).message}`)
    }
    const files = names.filter((n) => !n.endsWith('/'))
    const root = findRoot(files)
    for (const n of files) if (n.startsWith(root)) this.entries.set(n.slice(root.length), n)
  }

  private inflate(path: string): Promise<Uint8Array> {
    let p = this.files.get(path)
    if (p) return p
    const name = this.entries.get(path)
    if (name === undefined) return Promise.reject(new SourceError(`file not in bundle: ${path}`))
    p = spanAsync(
      'zip inflate (async)',
      path,
      () =>
        new Promise<Uint8Array>((res, rej) =>
          unzip(this.bytes, { filter: (f) => f.name === name }, (err, out) => {
            if (err) rej(new SourceError(`Could not read ${path} from the zip archive: ${err.message}`))
            else if (!out[name]) rej(new SourceError(`file not in bundle: ${path}`))
            else res(out[name])
          }),
        ),
    )
    this.files.set(path, p)
    return p
  }

  static async fromFile(f: File): Promise<BundleZipSource> {
    return new BundleZipSource(f.name, new Uint8Array(await f.arrayBuffer()))
  }

  list(): string[] {
    return [...this.entries.keys()]
  }

  async read(path: string): Promise<ArrayBuffer> {
    return (await this.inflate(path)).slice().buffer as ArrayBuffer
  }
}
