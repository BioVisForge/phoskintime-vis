/**
 * DataSource: where bundle bytes come from. The loader only needs to list relative paths and
 * read bytes, so new transports (an engine over HTTP, a remote URL) plug in without changing
 * panels or the model.
 */
export interface DataSource {
  readonly kind: 'folder' | 'zip' | 'engine' | 'memory'
  /** Human-readable origin (folder or file name). */
  readonly label: string
  /** Paths relative to the bundle root (the folder that holds manifest.json). */
  list(): string[]
  read(path: string): Promise<ArrayBuffer>
}

export class SourceError extends Error {}

/** Find the bundle root: the shortest directory prefix that contains manifest.json. */
export function findRoot(paths: string[]): string {
  const manifests = paths.filter((p) => p === 'manifest.json' || p.endsWith('/manifest.json'))
  if (!manifests.length) throw new SourceError('No manifest.json found: this is not a PhosKinTime run bundle.')
  manifests.sort((a, b) => a.length - b.length)
  return manifests[0].slice(0, -'manifest.json'.length)
}
