// Before/after table for docs/performance.md from the JSON files in docs/profile/.
//   node scripts/perf-table.mjs   -> markdown on stdout
import { readFileSync, existsSync } from 'node:fs'

const D = 'docs/profile/'
const j = (f) => (existsSync(D + f) ? JSON.parse(readFileSync(D + f, 'utf8')) : null)
const scen = (prefix, b) => ({ ...(j(`${prefix}.${b}.json`)?.scenarios ?? {}), ...(j(`${prefix}.${b}.export.json`)?.scenarios ?? {}) })
const fmt = (v) => (v == null ? '–' : `${Math.round(v).toLocaleString('en')} ms`)
const pct = (a, b) => (a && b ? ` (${b < a ? '−' : '+'}${Math.abs(Math.round((100 * (b - a)) / a))} %)` : '')
const cell = (a, b) => `${fmt(a)} → ${fmt(b)}${pct(a, b)}`

const rows = [
  ['open', 'Open zip → first panel drawn (Fit quality, nm-gof)'],
  ['gof', 'GOF panel alone (from the overview)'],
  ['raw', '“Raw lines” on: 8,000 series on canvas'],
  ['compare', 'Comparison load (2nd bundle → all sections drawn)'],
  ['png', '600 dpi PNG export, raw-lines panel (85 mm)'],
  ['pdf', 'PDF export, raw-lines panel (85 mm)'],
]
const B = { chromium: scen('before', 'chromium'), firefox: scen('before', 'firefox') }
const A = { chromium: scen('after', 'chromium'), firefox: scen('after', 'firefox') }
let out = '| Measure | Chromium | Firefox |\n|---|---|---|\n'
for (const [k, label] of rows) {
  const c = (b) => {
    const before = B[b][k]
    const after = A[b][k]
    const note = before?.note || (before?.errors ? ' ¹' : '')
    return cell(before?.wallMedianMs, after?.wallMedianMs) + (note ? ' ¹' : '')
  }
  out += `| ${label} | ${c('chromium')} | ${c('firefox')} |\n`
}
const pb = j('before.perf.json')
const pa = j('after.perf.json')
if (pb && pa) {
  out += `| Open zip → all files sha256-verified | ${cell(pb.chromium.openToVerifiedMs, pa.chromium.openToVerifiedMs)} | ${cell(pb.firefox.openToVerifiedMs, pa.firefox.openToVerifiedMs)} |\n`
  out += '\n| Panel in isolation (scripts/perf.mjs) | Chromium | Firefox |\n|---|---|---|\n'
  const ids = Object.keys(pb.chromium.panelsMs).sort((x, y) => pb.chromium.panelsMs[y] - pb.chromium.panelsMs[x])
  for (const id of ids) out += `| ${id} | ${cell(pb.chromium.panelsMs[id], pa.chromium.panelsMs[id])} | ${cell(pb.firefox.panelsMs[id], pa.firefox.panelsMs[id])} |\n`
  out += `\nSingle file: ${pb.chromium.singleFileBytes.toLocaleString('en')} → ${pa.chromium.singleFileBytes.toLocaleString('en')} B\n`
}
for (const b of ['chromium', 'firefox']) {
  const f = j(`frames.${b}.json`)
  if (!f) continue
  out += `\n**Frame intervals during gestures, ${f.browser}** (60 Hz: 16.7 ms is one frame)\n\n| Gesture | frames | median | p95 | max | after the gesture: max (frames > 20 ms) |\n|---|---|---|---|---|---|\n`
  for (const g of f.gestures) out += `| ${g.name} | ${g.frames} | ${g.medianMs} | ${g.p95Ms} | ${g.maxMs} | ${g.afterGesture.maxMs} (${g.afterGesture.framesOver20ms}) |\n`
}
console.log(out)
