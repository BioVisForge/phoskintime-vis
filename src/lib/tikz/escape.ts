/** LaTeX escaping and label conversion for PGFPlots output. */

const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '%': '\\%',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

/** Unicode symbols that must be typeset as math (Greek, operators). */
const MATH: Record<string, string> = {
  'μ': '\\mu', 'σ': '\\sigma', 'Δ': '\\Delta', 'δ': '\\delta', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'θ': '\\theta', 'λ': '\\lambda', 'π': '\\pi', 'τ': '\\tau', 'ω': '\\omega', 'χ': '\\chi', 'Σ': '\\Sigma', 'ε': '\\varepsilon', 'ρ': '\\rho', 'ν': '\\nu', 'κ': '\\kappa', 'φ': '\\varphi',
  '±': '\\pm', '−': '-', '×': '\\times', '·': '\\cdot', '≤': '\\leq', '≥': '\\geq', '→': '\\to', '←': '\\leftarrow', '≈': '\\approx', '≠': '\\neq', '∞': '\\infty', '‖': '\\|', '√': '\\surd', '∑': '\\sum', '²': '^{2}', '³': '^{3}', '¹': '^{1}', '⁰': '^{0}', '∗': '*',
}

const TEXT_SUBST: Record<string, string> = { '–': '--', '—': '---', '…': '\\ldots{}', '“': '``', '”': "''", '‘': '`', '’': "'", '\u00a0': '~', '°': '\\textdegree{}', '%': '\\%' }

/** Escape plain text for LaTeX; Greek and math symbols become inline math ($\mu$ ...). */
export function tex(s: string): string {
  let out = ''
  let math = ''
  const flush = () => {
    if (math) out += `$${math}$`
    math = ''
  }
  const chars = [...s]
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch in MATH) {
      math += MATH[ch] + (/[a-zA-Z]$/.test(MATH[ch]) ? ' ' : '')
      // a following '*' (μ*) or digit superscript stays inside the math group
      if (chars[i + 1] === '*') {
        math = math.trimEnd() + '^*'
        i++
      }
      continue
    }
    flush()
    if (ch in SPECIAL) out += SPECIAL[ch]
    else if (ch in TEXT_SUBST) out += TEXT_SUBST[ch]
    else if (ch.charCodeAt(0) < 128) out += ch
    else out += ch // other Unicode (é, Å) is fine with LuaLaTeX/fontspec and inputenc utf8
  }
  flush()
  return out.replace(/\$\s*\$/g, '')
}

/** Axis label: escaped text, unit in brackets when given and not already present. */
export function texLabel(label: string | undefined | null, unit?: string | null): string {
  const l = (label ?? '').trim()
  if (!unit || l.includes(`(${unit})`) || l.includes(`[${unit}]`)) return tex(l)
  return `${tex(l)} [${tex(unit)}]`
}

/** Safe file stem for data files. */
export function stem(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x'
}

/** Full float64 precision for data files (toPrecision(17)); nan for null/NaN (PGFPlots: unbounded coords=jump). */
export function num(v: unknown): string {
  if (v === null || v === undefined) return 'nan'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 'nan'
  return n.toPrecision(17)
}

/** Shortest round-trip number for keys like xmin= (exact, but readable). */
export function short(v: number): string {
  if (!Number.isFinite(v)) return '0'
  return String(v)
}
