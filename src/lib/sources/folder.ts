import { findRoot, SourceError, type DataSource } from './types'

/** A bundle folder chosen with <input webkitdirectory> or dropped as a directory. */
export class BundleFolderSource implements DataSource {
  readonly kind = 'folder' as const
  private files = new Map<string, File>()
  readonly label: string

  constructor(files: { path: string; file: File }[]) {
    const all = files.map((f) => f.path.replace(/^\/+/, ''))
    const root = findRoot(all)
    for (const f of files) {
      const p = f.path.replace(/^\/+/, '')
      if (p.startsWith(root)) this.files.set(p.slice(root.length), f.file)
    }
    this.label = root.replace(/\/$/, '') || 'bundle folder'
  }

  static fromFileList(list: FileList | File[]): BundleFolderSource {
    return new BundleFolderSource(Array.from(list, (f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f })))
  }

  list(): string[] {
    return [...this.files.keys()]
  }

  async read(path: string): Promise<ArrayBuffer> {
    const f = this.files.get(path)
    if (!f) throw new SourceError(`file not in bundle: ${path}`)
    return f.arrayBuffer()
  }
}

/** Walk a dropped directory (DataTransferItem.webkitGetAsEntry) into path/File pairs. */
export async function filesFromDrop(items: DataTransferItemList): Promise<{ path: string; file: File }[]> {
  const out: { path: string; file: File }[] = []
  const entries: FileSystemEntry[] = []
  for (const it of Array.from(items)) {
    const e = it.webkitGetAsEntry?.()
    if (e) entries.push(e)
  }
  async function walk(e: FileSystemEntry, prefix: string): Promise<void> {
    if (e.isFile) {
      const file = await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej))
      out.push({ path: prefix + e.name, file })
    } else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader()
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        if (!batch.length) break
        for (const c of batch) await walk(c, prefix + e.name + '/')
      }
    }
  }
  for (const e of entries) await walk(e, '')
  return out
}
