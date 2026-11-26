import { applyContract, ContractError } from '../contracts/index'
import { sha256Hex } from '../io/sha256'
import { parseNpy } from '../io/npy'
import { decodeTable } from '../workers/client'
import type { DataSource } from '../sources/types'
import type { BundleMeta, FileCheck, FileEntry, NpyArray, Table, VerifyState } from './types'

/** An opened bundle: validated manifest, adapted metadata, lazy table/array access, sha256 checks. */
export class LoadedBundle {
  private tables = new Map<string, Promise<Table>>()
  private arrays = new Map<string, Promise<NpyArray>>()
  verifyState: VerifyState = 'pending'
  checks: FileCheck[] = []
  /** Files present in the source but not listed in the manifest. */
  readonly unlisted: string[]

  constructor(
    readonly source: DataSource,
    readonly meta: BundleMeta,
    readonly contract: string,
    readonly draft: boolean,
    readonly notices: string[],
  ) {
    const listed = new Set(meta.files.map((f) => f.path).concat('manifest.json'))
    this.unlisted = source.list().filter((p) => !listed.has(p))
  }

  static async open(source: DataSource): Promise<LoadedBundle> {
    let manifest: unknown
    try {
      manifest = JSON.parse(new TextDecoder().decode(await source.read('manifest.json')))
    } catch (e) {
      throw new ContractError(`manifest.json could not be read: ${(e as Error).message}`, 'unreadable')
    }
    const r = applyContract(manifest)
    return new LoadedBundle(source, r.meta, r.contract, r.draft, r.notices)
  }

  get label(): string {
    return this.source.label
  }

  tableEntry(name: string): FileEntry | undefined {
    return this.meta.files.find((f) => f.kind === 'table' && f.table === name)
  }

  hasTable(name: string, columns: string[] = []): boolean {
    const e = this.tableEntry(name)
    if (!e) return false
    const have = new Set((e.columns ?? []).map((c) => c.name))
    return columns.every((c) => have.has(c))
  }

  arrayEntry(name: string): FileEntry | undefined {
    return this.meta.files.find((f) => f.kind === 'array' && f.array?.name === name)
  }

  /** Reason from the manifest's missing/skipped lists, if any, for an artifact. */
  missingReason(artifact: string): string | null {
    const m = [...this.meta.missing, ...this.meta.skipped].find((x) => x.artifact === artifact || x.artifact.startsWith(artifact + ':'))
    return m ? m.reason : null
  }

  table(name: string): Promise<Table> {
    let p = this.tables.get(name)
    if (!p) {
      const e = this.tableEntry(name)
      if (!e) return Promise.reject(new Error(`table ${name} is not in this bundle`))
      p = this.source.read(e.path).then((buf) => decodeTable(buf, name, e.path, e))
      this.tables.set(name, p)
    }
    return p
  }

  array(name: string): Promise<NpyArray> {
    let p = this.arrays.get(name)
    if (!p) {
      const e = this.arrayEntry(name)
      if (!e) return Promise.reject(new Error(`array ${name} is not in this bundle`))
      p = this.source.read(e.path).then(parseNpy)
      this.arrays.set(name, p)
    }
    return p
  }

  async text(path: string): Promise<string> {
    return new TextDecoder().decode(await this.source.read(path))
  }

  /** Recompute every file's sha256 and compare with the manifest. */
  async verify(onProgress?: (done: number, total: number) => void): Promise<FileCheck[]> {
    const out: FileCheck[] = []
    let done = 0
    for (const f of this.meta.files) {
      try {
        const actual = await sha256Hex(await this.source.read(f.path))
        out.push({ path: f.path, expected: f.sha256, actual, ok: actual === f.sha256 })
      } catch (e) {
        out.push({ path: f.path, expected: f.sha256, actual: null, ok: false, error: (e as Error).message })
      }
      onProgress?.(++done, this.meta.files.length)
    }
    this.checks = out
    this.verifyState = out.every((c) => c.ok) ? 'verified' : out.some((c) => c.error) && !out.some((c) => c.actual && !c.ok) ? 'error' : 'mismatch'
    return out
  }
}
