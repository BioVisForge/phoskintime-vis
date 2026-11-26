// svg2pdf + jsPDF cost vs. number of path points (vector/raster threshold for PDF export).
import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
const res: Record<string, unknown>[] = []
for (const n of [5000, 20000, 50000, 112000, 250000]) {
  let d = ''
  for (let i = 0; i < n; i++) d += `${i % 140 === 0 ? 'M' : 'L'}${((i % 140) * 3.1).toFixed(2)},${(150 + 100 * Math.sin(i / 37)).toFixed(2)}`
  const svg = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="174mm" height="120mm" viewBox="0 0 974 672"><path d="${d}" fill="none" stroke="#999" stroke-opacity="0.15" stroke-width="0.6"/></svg>`, 'image/svg+xml').documentElement
  document.body.appendChild(svg)
  const t = performance.now()
  const doc = new jsPDF({ unit: 'mm', format: [174, 120] })
  await (doc as any).svg(svg, { x: 0, y: 0, width: 174, height: 120 })
  const bytes = doc.output('arraybuffer').byteLength
  res.push({ points: n, ms: Math.round(performance.now() - t), bytes })
  svg.remove()
}
;(window as any).__bench = res
document.getElementById('out')!.textContent = JSON.stringify(res, null, 1)
