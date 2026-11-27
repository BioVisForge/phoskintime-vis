// Build docs/screenshots/tikz-gallery.html: each panel's compiled TikZ (PDF -> PNG via Ghostscript)
// next to the viewer's own PNG export. Inputs: compile workdirs from compile_all.sh and an
// export-all zip with PNGs.  Usage: node tests/tikz/gallery.mjs <pngZip>... -- <workdir>...
// then: python tests/tikz/downscale_viewer_pngs.py  (keeps the gallery small)
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const sep = args.indexOf('--')
const pngZips = args.slice(0, sep)
const workdirs = args.slice(sep + 1)
const out = 'docs/screenshots/tikz'
mkdirSync(out, { recursive: true })
const rows = []
const pngs = {}
for (const z of pngZips) for (const [n, b] of Object.entries(unzipSync(readFileSync(z)))) if (n.endsWith('.png')) pngs[n.replace(/_[0-9a-f]{8}_\d{8}\.png$/, '')] = { n, b }
for (const w of workdirs) {
  for (const d of readdirSync(w)) {
    const dir = join(w, d)
    if (d === 'all' || !existsSync(dir)) continue
    const pdf = readdirSync(dir).find((f) => f.endsWith('-standalone.pdf'))
    const panel = d.replace(/_[0-9a-f]{8}_\d{8}$/, '')
    const bundle = /_([0-9a-f]{8})_/.exec(d)?.[1] ?? ''
    if (!pdf) {
      rows.push({ panel, bundle, tikz: null, view: null })
      continue
    }
    const tk = `${panel}_${bundle}_tikz.png`
    execFileSync('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m', '-r200', '-dTextAlphaBits=4', `-sOutputFile=${resolve(out, tk)}`, resolve(dir, pdf)])
    let view = null
    const p = pngs[panel]
    if (p) {
      view = `${panel}_${bundle}_viewer.png`
      writeFileSync(join(out, view), p.b)
    }
    const tex = readFileSync(join(dir, `${panel.replace(/[^A-Za-z0-9]+/g, '-')}.tex`), 'utf8')
    const pts = /% points: (\d+); pdflatex: (\w+)/.exec(tex)
    const raster = readdirSync(dir).filter((f) => /-layer.*\.png$/.test(f)).length
    rows.push({ panel, bundle, tikz: tk, view, points: pts?.[1], pdf: pts?.[2], raster })
  }
}
rows.sort((a, b) => (a.bundle + a.panel < b.bundle + b.panel ? -1 : 1))
const html = `<!doctype html><html><head><meta charset="utf-8"><title>TikZ / PGFPlots export gallery (synthetic data)</title>
<style>body{font-family:system-ui,sans-serif;max-width:1500px;margin:20px auto;color:#1d2330}h2{font-size:16px;margin:28px 0 6px;border-bottom:1px solid #ddd}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0;border:1px solid #ddd;padding:6px;background:#fff}img{max-width:100%}figcaption{font-size:12px;color:#555}.meta{font-size:12px;color:#444}</style></head><body>
<h1>TikZ / PGFPlots export vs viewer PNG export</h1>
<p>Synthetic spec fixtures only. Left: the panel's PGFPlots export compiled with LuaLaTeX (<code>tests/tikz/compile_all.sh</code>), rendered at 200 dpi with Ghostscript (graphics anti-aliasing off: Ghostscript 10.06 aborts on it for the GOF PDF). Right: the viewer's PNG export of the same panel (exported at 300 dpi, downscaled to the same width for this page). Both use 85 mm width and 8 pt base font. Compare by eye: the PGFPlots version redraws axes, ticks and legends natively, so tick positions and label placement differ slightly by design.</p>
${rows.map((r) => `<h2>${r.panel} <span class="meta">(bundle ${r.bundle}; ${r.points ?? '?'} points; pdfLaTeX ${r.pdf ?? '?'}; raster layers ${r.raster ?? 0})</span></h2><div class="pair"><figure>${r.tikz ? `<img loading="lazy" src="tikz/${r.tikz}"><figcaption>PGFPlots (LuaLaTeX)</figcaption>` : '<p>not compiled</p>'}</figure><figure>${r.view ? `<img loading="lazy" src="tikz/${r.view}"><figcaption>viewer PNG export</figcaption>` : '<p>no PNG</p>'}</figure></div>`).join('\n')}
</body></html>`
writeFileSync('docs/screenshots/tikz-gallery.html', html)
console.log(`tikz gallery: ${rows.length} panels`)
