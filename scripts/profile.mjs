// Stage-by-stage profile of the `network` fixture (docs/performance-profile.md).
//
//   node scripts/profile.mjs [chromium|firefox] [--runs N] [--out file.json]
//
// Every scenario runs in a fresh page with `__PKV_PROFILE__` set, so the app records its own
// stage spans (src/lib/perf/spans.ts): zip inflate, Parquet decode (worker), sha256,
// transforms, data shaping, Canvas2D drawing, export compose/encode. Wall times come from the
// single-file build opened from file://, as in scripts/perf.mjs.
//
// Chromium also records a V8 CPU profile and a rendering trace of a source-mapped build served
// over http (module scripts cannot be source-mapped from the single file), and attributes
// every main-thread sample to a stage by the original source file of the innermost frame that
// has one (src/…, node_modules/…). Firefox has no CPU profiler over Playwright: its table has
// the instrumented stages and "other main-thread work" (Svelte/SveltePlot, SVG, layout, paint).
import { chromium, firefox } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { SourceMapConsumer } from 'source-map-js'

const args = process.argv.slice(2)
const which = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? 'chromium'
const runs = Number(args[args.indexOf('--runs') + 1] ?? 0) || 3
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : `docs/performance-profile.${which}.json`
const SCEN = (args.includes('--only') ? args[args.indexOf('--only') + 1] : 'open,gof,raw,compare,png,pdf').split(',')
const FIX = (n) => resolve(`tests/fixtures/out/${n}.pkt.zip`)
const SINGLE = 'file://' + resolve(process.env.PROFILE_SINGLE ?? 'dist-single/index.html')

// ---------- scenarios: each returns its wall time (ms) ----------
const ready = (page, id) =>
  page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-panel="${id}"]`)
      return el && el.getAttribute('data-rendered') === 'true' && !el.querySelector('.loading') && el.querySelectorAll('svg path, svg circle, svg rect, svg image, canvas').length > 0
    },
    id,
    { timeout: 180000, polling: 10 },
  )
const go = async (page, h) => {
  await page.evaluate((h) => (location.hash = h), h)
  await page.waitForSelector('main h1')
}
async function openNetwork(page) {
  await page.setInputFiles('[data-testid=open-zip]', FIX('network'))
  await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 120000 })
}
async function download(page, panel, fmt) {
  const card = page.locator(`[data-panel="${panel}"]`)
  await card.locator('[data-testid=panel-menu]').click()
  const t = Date.now()
  const dlp = page.waitForEvent('download', { timeout: Number(process.env.PROFILE_EXPORT_TIMEOUT ?? 300000) })
  await card.locator(`[data-testid=export-${fmt}]`).click()
  // Firefox lays text out slightly wider: when the fit check refuses 85 mm, take its "1.5 column" fix
  const fix = page.getByRole('button', { name: /Use 1\.5 column/ })
  const first = await Promise.race([dlp.then(() => 'dl'), fix.waitFor({ timeout: 300000 }).then(() => 'fit')])
  if (first === 'fit') {
    page.__fitFix = true
    await fix.click()
  }
  const dl = await dlp
  await dl.path()
  return Date.now() - t
}
/** [setup (not timed, not profiled), measured action] */
const scenarios = {
  open: [
    async () => {},
    async (page) => {
      const t = Date.now()
      await page.setInputFiles('[data-testid=open-zip]', FIX('network'))
      const first = await page.locator('[data-panel]').first().getAttribute('data-panel')
      await ready(page, first)
      return Date.now() - t
    },
  ],
  gof: [
    async (page) => {
      await openNetwork(page)
      await go(page, '#/overview')
    },
    async (page) => {
      const t = Date.now()
      await go(page, '#/fit?only=nm-gof')
      await ready(page, 'nm-gof')
      return Date.now() - t
    },
  ],
  raw: [
    async (page) => {
      await openNetwork(page)
      await go(page, '#/dynamics?only=nm-all-trajectories')
      await ready(page, 'nm-all-trajectories')
    },
    async (page) => {
      const t = Date.now()
      await page.check('[data-testid=raw-lines]')
      await page.waitForFunction(() => document.querySelector('[data-panel="nm-all-trajectories"] canvas'), null, { timeout: 120000, polling: 10 })
      // the canvas exists before its first stroke: wait two frames so the draw is inside the window
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      return Date.now() - t
    },
  ],
  compare: [
    async (page) => {
      await openNetwork(page)
    },
    async (page) => {
      const t = Date.now()
      await page.setInputFiles('[data-testid=open-zip]', FIX('network-after-fix'))
      await page.waitForFunction(() => document.querySelectorAll('[data-testid=tab-compare]:not([disabled])').length > 0)
      await page.click('[data-testid=tab-compare]')
      await page.waitForSelector('[data-testid=compare-ready] [data-compare-section="params"] svg', { timeout: 120000 })
      return Date.now() - t
    },
  ],
  png: [
    async (page) => {
      await openNetwork(page)
      await go(page, '#/dynamics?only=nm-all-trajectories')
      await ready(page, 'nm-all-trajectories')
      await page.check('[data-testid=raw-lines]')
      await page.waitForFunction(() => document.querySelector('[data-panel="nm-all-trajectories"] canvas'))
    },
    (page) => download(page, 'nm-all-trajectories', 'png'),
  ],
  pdf: [
    async (page) => {
      await openNetwork(page)
      await go(page, '#/dynamics?only=nm-all-trajectories')
      await ready(page, 'nm-all-trajectories')
      await page.check('[data-testid=raw-lines]')
      await page.waitForFunction(() => document.querySelector('[data-panel="nm-all-trajectories"] canvas'))
    },
    (page) => download(page, 'nm-all-trajectories', 'pdf'),
  ],
}

// ---------- Chromium CPU profile attribution ----------
const RULES = [
  [/src\/lib\/export\/|src\/lib\/tikz\/|node_modules\/(jspdf|svg2pdf\.js|fflate\/esm\/browser.*zip)/, 'export (compose, encode)'],
  [/src\/lib\/panels\/shared\/FastLines|node_modules\/svelteplot\/dist\/marks\/helpers\/\w+Canvas|node_modules\/svelteplot\/dist\/helpers\/canvas/, 'data-mark drawing (Canvas2D)'],
  [/node_modules\/hyparquet/, 'Parquet decode'],
  [/node_modules\/fflate/, 'zip inflate'],
  [/src\/lib\/io\/sha256/, 'sha256'],
  [/src\/lib\/transforms\/table\.ts|src\/lib\/derive\/|src\/lib\/panels\/common\.ts|src\/lib\/io\/npy/, 'data shaping (columns → rows)'],
  [/src\/lib\/transforms\//, 'transforms (quantiles, KDE, box, envelopes, GOF, deltas)'],
  [/node_modules\/(ajv|ajv-formats)|src\/lib\/contracts|src\/lib\/validators/, 'manifest validation'],
  [/node_modules\/(svelte|svelteplot|d3-|esm-env|fast-equals|merge-deep|interval-tree)|src\/lib\/(plot|panels|ui|compare|model|sources|workers)|src\/App/, 'Svelte/SveltePlot reactivity + SVG'],
]
const EXPORT = RULES[0][1]
const SPECIAL = { '(garbage collector)': 'garbage collection', '(program)': 'browser native (style, layout, paint, compositing)', '(idle)': 'idle' }

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' }
  const srv = createServer((req, res) => {
    const p = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const f = existsSync(p) && !p.endsWith('/') ? p : join(dir, 'index.html')
    res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' })
    res.end(readFileSync(f))
  })
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}/` })))
}

function attribute(profile, dir, windowMs) {
  const maps = new Map()
  const consumer = (url) => {
    if (maps.has(url)) return maps.get(url)
    let c = null
    try {
      const p = join(dir, new URL(url).pathname)
      if (existsSync(p + '.map')) c = { map: new SourceMapConsumer(JSON.parse(readFileSync(p + '.map', 'utf8'))), base: dirname(p) }
    } catch {
      /* not a served file */
    }
    maps.set(url, c)
    return c
  }
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const parent = new Map()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const srcCache = new Map()
  const source = (n) => {
    if (srcCache.has(n.id)) return srcCache.get(n.id)
    const cf = n.callFrame
    let s = null
    if (cf.url) {
      const c = consumer(cf.url)
      if (c) s = c.map.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }).source
      // repo-relative path of the original file (src/…, node_modules/…)
      if (s) s = relative(process.cwd(), resolve(c.base, s.replace(/^[a-z]+:\/\//, '')))
    }
    srcCache.set(n.id, s)
    return s
  }
  const bucketOf = new Map()
  const bucket = (id) => {
    if (bucketOf.has(id)) return bucketOf.get(id)
    const n = byId.get(id)
    let b = SPECIAL[n.callFrame.functionName]
    if (!b) {
      const s = source(n)
      if (s) b = RULES.find(([re]) => re.test(s))?.[1] ?? `other: ${s.split('/').slice(0, 3).join('/')}`
    }
    if (!b) b = parent.has(id) ? bucket(parent.get(id)) : 'other (native, unattributed)'
    // library code called by the export (jsPDF compresses with fflate) counts as export
    if (b !== EXPORT && inExport(id)) b = EXPORT
    bucketOf.set(id, b)
    return b
  }
  const exportOf = new Map()
  const inExport = (id) => {
    if (exportOf.has(id)) return exportOf.get(id)
    const s = source(byId.get(id))
    const v = (s && RULES[0][0].test(s)) || (parent.has(id) && inExport(parent.get(id)))
    exportOf.set(id, v)
    return v
  }
  const out = {}
  const files = {}
  const fns = {}
  const { samples, timeDeltas } = profile
  // Profiler.stop is answered only when the main thread is free, so the profile runs past the
  // measured action: keep the samples inside the window (from Profiler.start, windowMs long)
  let t = 0
  for (let i = 0; i < samples.length; i++) {
    t += timeDeltas[i] / 1000
    if (t > windowMs) break
    // the delta before sample i+1 is the time sample i stood for
    const dt = (timeDeltas[i + 1] ?? 0) / 1000
    const b = bucket(samples[i])
    out[b] = (out[b] ?? 0) + dt
    // innermost frame with a source file, for the detail tables
    let id = samples[i]
    while (id !== undefined && !source(byId.get(id))) id = parent.get(id)
    if (id !== undefined) {
      const n = byId.get(id)
      const f = source(n)
      files[f] = (files[f] ?? 0) + dt
      const k = `${n.callFrame.functionName || '(anonymous)'} ${f}:${n.callFrame.lineNumber + 1}`
      fns[k] = (fns[k] ?? 0) + dt
    }
  }
  const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(1)]))
  return { buckets: out, files: top(files, 30), functions: top(fns, 30), windowStartUs: profile.startTime }
}

function traceTotals(buf, fromUs, windowMs) {
  const ev = JSON.parse(buf.toString()).traceEvents
  const main = new Set(ev.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`))
  const raster = new Set(ev.filter((e) => e.name === 'thread_name' && /Raster|Compositor/.test(e.args?.name ?? '')).map((e) => `${e.pid}:${e.tid}`))
  const want = { UpdateLayoutTree: 'style', Layout: 'layout', PrePaint: 'paint', Paint: 'paint', Layerize: 'paint', Commit: 'paint' }
  const out = { style: 0, layout: 0, paint: 0, raster: 0 }
  for (const e of ev) {
    if (e.ph !== 'X' || !e.dur || e.ts < fromUs || e.ts > fromUs + windowMs * 1000) continue
    const k = `${e.pid}:${e.tid}`
    if (main.has(k) && want[e.name]) out[want[e.name]] += e.dur / 1000
    else if (raster.has(k) && /RasterTask|ImageDecodeTask/.test(e.name)) out.raster += e.dur / 1000
  }
  return out
}

// ---------- run ----------
const bt = which === 'firefox' ? firefox : chromium
const browser = await bt.launch()
let build = null
if (which === 'chromium' && !process.env.PROFILE_NO_CPU) {
  const dir = resolve(process.env.PROFILE_BUILD ?? 'test-results/pkv-profile-build')
  if (!process.env.PROFILE_BUILD_REUSE || !existsSync(join(dir, 'index.html'))) {
    mkdirSync(dir, { recursive: true })
    execFileSync('npx', ['vite', 'build', '--sourcemap', '--outDir', dir, '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit' })
  }
  build = { dir, ...(await serve(dir)) }
}

// brushing the GOF overall plot of the gof-100k fixture (102,868 points)
scenarios.brush100k = [
  async (page) => {
    await page.setInputFiles('[data-testid=open-zip]', FIX('gof-100k'))
    await page.waitForSelector('[data-testid=verify-badge][data-state=verified]', { timeout: 120000 })
    await go(page, '#/fit?only=nm-gof')
    await ready(page, 'nm-gof')
    await page.waitForTimeout(1500)
  },
  async (page) => {
    const box = (await page.locator('[data-panel="nm-gof"] .pkv-zoomwrap svg').evaluateAll((ss) => ss.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 100).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))))[0]
    const t = Date.now()
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 20 })
    await page.mouse.up()
    // the selection applies when the pointer pauses: wait for it and the trajectories it shows
    await page.locator('[data-panel="nm-gof"] [data-testid=selection] b').filter({ hasNotText: /^0$/ }).waitFor()
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    return Date.now() - t
  },
]

// 600 dpi PNG of the GOF panel (vector dots: the composed SVG has ≈ 10,000 circles)
scenarios.pngGof = [
  async (page) => {
    await openNetwork(page)
    await go(page, '#/fit?only=nm-gof')
    await ready(page, 'nm-gof')
  },
  (page) => download(page, 'nm-gof', 'png'),
]

// generic single-panel scenarios: `panel:<section>/<panel-id>` (rendered alone, after the bundle is open)
for (const name of SCEN.filter((n) => n.startsWith('panel:'))) {
  const [section, id] = name.slice(6).split('/')
  scenarios[name] = [
    async (page) => {
      await openNetwork(page)
      await go(page, '#/overview')
    },
    async (page) => {
      const t = Date.now()
      await go(page, `#/${section}?only=${id}`)
      await ready(page, id)
      return Date.now() - t
    },
  ]
}

const result = { browser: `${which} ${browser.version()}`, date: new Date().toISOString(), runs, scenarios: {} }
for (const name of SCEN) {
  const [setup, act] = scenarios[name]
  const rec = { wallMs: [], spans: [], cpu: null, cpuDetail: null, trace: null, profiledWallMs: null }
  for (let r = 0; r < runs; r++) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true })
    await ctx.addInitScript(() => (globalThis.__PKV_PROFILE__ = true))
    const page = await ctx.newPage()
    page.__errors = []
    page.on('console', (m) => m.type() === 'error' && page.__errors.push(m.text()))
    page.on('pageerror', (e) => page.__errors.push(e.message))
    await page.goto(SINGLE + (name === 'open' ? '#/fit' : ''))
    await setup(page)
    await page.evaluate(() => (globalThis.__PKV_SPANS__ = []))
    const t0 = await page.evaluate(() => performance.now())
    try {
      rec.wallMs.push(await act(page))
      if (page.__fitFix) rec.note = 'the 85 mm fit check refused; timed with its "Use 1.5 column (114 mm)" fix, so the time includes the refused attempt'
    } catch (e) {
      // record the failure (and what the app showed) instead of losing the other scenarios
      const shown = await page.locator('[role=alert], .error, [data-testid=export-error]').allInnerTexts().catch(() => [])
      rec.errors = [...(rec.errors ?? []), `${e.message.split('\n')[0]} | app: ${shown.join(' / ').slice(0, 300)} | console: ${(page.__errors ?? []).slice(-3).join(' / ').slice(0, 300)}`]
      await ctx.close()
      break
    }
    const spans = await page.evaluate(() => globalThis.__PKV_SPANS__)
    rec.spans.push(spans.filter((s) => s.start >= t0 - 1))
    await ctx.close()
  }
  if (build && !rec.errors) {
    // one more run on the source-mapped build, with the CPU profiler and the trace on
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true })
    await ctx.addInitScript(() => (globalThis.__PKV_PROFILE__ = true))
    const page = await ctx.newPage()
    await page.goto(build.url + (name === 'open' ? '#/fit' : ''))
    await setup(page)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] })
    await cdp.send('Profiler.start')
    rec.profiledWallMs = await act(page)
    const { profile } = await cdp.send('Profiler.stop')
    const a = attribute(profile, build.dir, rec.profiledWallMs)
    rec.cpu = a.buckets
    rec.cpuDetail = { files: a.files, functions: a.functions }
    rec.trace = traceTotals(await browser.stopTracing(), a.windowStartUs, rec.profiledWallMs)
    await ctx.close()
  }
  // spans: per stage, sum per run, then the median over runs
  const stages = {}
  for (const run of rec.spans) {
    const sum = {}
    for (const s of run) sum[s.stage] = (sum[s.stage] ?? 0) + s.dur
    for (const [k, v] of Object.entries(sum)) (stages[k] ??= []).push(v)
  }
  const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  result.scenarios[name] = {
    errors: rec.errors,
    note: rec.note,
    wallMs: rec.wallMs,
    wallMedianMs: med(rec.wallMs),
    stagesMedianMs: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, +med(v).toFixed(1)])),
    cpuMs: rec.cpu && Object.fromEntries(Object.entries(rec.cpu).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +v.toFixed(1)])),
    traceMs: rec.trace && Object.fromEntries(Object.entries(rec.trace).map(([k, v]) => [k, +v.toFixed(1)])),
    profiledWallMs: rec.profiledWallMs,
    cpuDetail: rec.cpuDetail,
  }
  console.error(name, JSON.stringify(result.scenarios[name]))
}
await browser.close()
build?.srv.close()
writeFileSync(outFile, JSON.stringify(result, null, 1))
console.log(`wrote ${outFile}`)
