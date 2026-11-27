/** Export dialog settings, shared by all formats. */
export type SizePreset = 'single' | 'onehalf' | 'double' | 'poster' | 'custom'
export const PRESETS: Record<Exclude<SizePreset, 'custom' | 'poster'>, { label: string; widthMm: number }> = {
  single: { label: 'Single column (85 mm)', widthMm: 85 },
  onehalf: { label: '1.5 column (114 mm)', widthMm: 114 },
  double: { label: 'Double column (174 mm)', widthMm: 174 },
}

export interface ExportSettings {
  preset: SizePreset
  widthMm: number
  /** null = follow the panel's aspect ratio */
  heightMm: number | null
  fontPt: number
  dpi: 300 | 600 | 1200
  title: boolean
  caption: boolean
  footer: boolean
  /** SVG only: embed the font as data URL (true) or reference it by name (false) */
  svgEmbedFont: boolean
  /** TikZ only: largest-triangle-three-buckets downsampling above the TeX threshold; off by default */
  tikzDownsample: boolean
  /**
   * Fit-to-width fixes, chosen in the dialog for one export and never remembered: keep every k-th
   * tick label on overflowing axes, shorten tick labels, or (confirmed) scale text below fontPt.
   */
  fitFewerTicks: boolean
  fitShortenLabels: boolean
  fitScale: boolean
  /** set by the "next width preset" fix: draw plots narrower by their overhang so labels fit */
  fitReflow: boolean
  /** internal, per render: layout px reserved for overhanging labels */
  fitReservePx: number
  /**
   * 'full' (default): every plot shows its full data range. 'current': zoomed plots show the
   * view the user zoomed to on screen, and the caption states the shown ranges. Never remembered.
   */
  view: 'full' | 'current'
}

/** Per-export choices that are never persisted (a confirmed "scale anyway" must not carry over). */
export const TRANSIENT_KEYS = ['fitFewerTicks', 'fitShortenLabels', 'fitScale', 'fitReflow', 'fitReservePx', 'view'] as const

export const DEFAULTS: ExportSettings = {
  preset: 'single',
  widthMm: 85,
  heightMm: null,
  fontPt: 8,
  dpi: 600,
  title: true,
  caption: true,
  footer: true,
  svgEmbedFont: true,
  tikzDownsample: false,
  fitFewerTicks: false,
  fitShortenLabels: false,
  fitScale: false,
  fitReflow: false,
  fitReservePx: 0,
  view: 'full',
}

function withoutTransient(s: Partial<ExportSettings>): Partial<ExportSettings> {
  const out = { ...s }
  for (const k of TRANSIENT_KEYS) delete out[k]
  return out
}

const KEY = 'pkv.export.settings.v1'

export function loadSettings(): ExportSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const s = { ...DEFAULTS, ...withoutTransient(JSON.parse(raw)) }
    return normalise(s)
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: ExportSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(withoutTransient(s)))
  } catch {
    /* storage unavailable (private mode, file:// quirks): settings just are not remembered */
  }
}

export function normalise(s: ExportSettings): ExportSettings {
  const out = { ...s }
  if (out.preset !== 'custom' && out.preset !== 'poster') out.widthMm = PRESETS[out.preset].widthMm
  out.widthMm = Math.min(1200, Math.max(20, Number(out.widthMm) || 85))
  out.heightMm = out.heightMm == null || !(Number(out.heightMm) > 0) ? null : Math.min(1200, Math.max(10, Number(out.heightMm)))
  out.fontPt = Math.min(12, Math.max(6, Number(out.fontPt) || 8))
  if (![300, 600, 1200].includes(out.dpi)) out.dpi = 600
  for (const k of ['fitFewerTicks', 'fitShortenLabels', 'fitScale', 'fitReflow'] as const) out[k] = !!out[k]
  out.fitReservePx = Math.max(0, Number(out.fitReservePx) || 0)
  return out
}

/** The next larger journal width preset, if any (fit-to-width fix). */
export function nextPreset(widthMm: number): Exclude<SizePreset, 'custom' | 'poster'> | null {
  const order = (Object.keys(PRESETS) as Exclude<SizePreset, 'custom' | 'poster'>[]).sort((a, b) => PRESETS[a].widthMm - PRESETS[b].widthMm)
  return order.find((k) => PRESETS[k].widthMm > widthMm) ?? null
}

/** Layout pixels per mm used for export rendering (≈142 px/inch). Fonts and lines scale with it. */
export const LAYOUT_PX_PER_MM = 5.6
export const ptToLayoutPx = (pt: number) => (pt * 25.4) / 72 * LAYOUT_PX_PER_MM

/** <panel-id>_<bundle-id-8>_<yyyymmdd>.<ext>; comparison panels pass both bundle ids. */
export function exportFilename(panelId: string, bundleIds: string[], ext: string, date = new Date()): string {
  const d = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const ids = bundleIds.map((b) => b.replace(/^pkt-/, '').slice(0, 8)).join('_vs_')
  const safe = panelId.replace(/[^A-Za-z0-9._-]+/g, '-')
  return `${safe}_${ids}_${d}.${ext}`
}

export interface Provenance {
  bundleIds: string[]
  commits: string[]
  panelId: string
  viewerVersion: string
  exportDate: string
}

export function provenanceText(p: Provenance): string {
  return `bundle ${p.bundleIds.map((b) => b.slice(0, 12)).join(' vs ')} · PhosKinTime ${p.commits.map((c) => c.slice(0, 7)).join(' vs ')} · panel ${p.panelId} · PhosKinTime-Vis ${p.viewerVersion}`
}
