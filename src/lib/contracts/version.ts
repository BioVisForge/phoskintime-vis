export interface SchemaVersion {
  major: number
  minor: number
  raw: string
}

export function parseVersion(v: unknown): SchemaVersion | null {
  if (typeof v !== 'string') return null
  const m = /^(\d+)\.(\d+)$/.exec(v.trim())
  return m ? { major: +m[1], minor: +m[2], raw: v } : null
}
