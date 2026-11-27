# 0006: Faster panels on the CPU: profile first, fast data layers, no WebAssembly

Status: accepted (2026-11-27)

## Context

The task was to make the existing panels faster without a GPU, with Rust compiled to
WebAssembly for the data kernels (quantiles, KDE, box statistics, envelopes, deltas, M4
decimation, a spatial index) and for a CPU rasteriser (tiny-skia) shared by screen and PNG
export. The rule was to move only work that the profile shows to be a bottleneck.

## What the profile showed

`docs/performance-profile.md`, measured with `scripts/profile.mjs` (Chromium: CPU profile of a
source-mapped build, each sample attributed to its source file; Firefox: stage spans):

| Stage | Share of open → first panel (Chromium, 3.1 s) | Verdict |
|---|---|---|
| SveltePlot's per-datum Mark pipeline (`Mark.svelte`, reactive props, scales) | ≈ 2.3 s | **the bottleneck** |
| Parquet decode (hyparquet) | 130 ms, in a worker | leave |
| zip inflate (fflate) | 140 ms, main thread | small: inflate lazily, off the main thread |
| transforms (quantiles, KDE, box, envelopes, GOF, deltas) | 18 ms | leave (see below for two panels) |
| sha256 (WebCrypto) | 9 ms | leave |
| Canvas2D drawing | 93 ms (mostly one `getComputedStyle` per dot inside SveltePlot) | fixed by the fast layer |

Removing GOF's two dot marks alone brought open → first panel to 836 ms (Chromium) and
1,103 ms (Firefox): the targets. In two panels the transforms did matter: posterior CI
(`credible()` sorted every 2,000-draw column three times: 446 ms) and the posterior ridgeline (25
KDEs, 414 ms). Firefox exports of the raw-lines panel took 23.5 s, of which 18.7 s were Canvas2D
strokes: the layer was drawn 5 times per render, and the panel was rendered 3 times because the
85 mm fit check refused it in Firefox.

## Decisions

### 1. Fast data layers instead of WebAssembly kernels

Large canvas Dot marks (GOF, residuals, parameter parallel coordinates, the GOF brush highlight)
are drawn on screen by `src/lib/plot/fast/FastDots.svelte`. It resolves the few channels a dot
needs once, into flat arrays, and draws them with the same Canvas2D operations, in the same order,
as SveltePlot's `DotCanvas`. SveltePlot still draws scales, axes, legends, text, the brush and
tooltips: it receives **proxy rows**, a subset of the data with the same extent on every
continuous channel and the same distinct values (in first-appearance order) on every categorical
channel, through its own `Dot` at opacity 0. Domains, colours, legends and facets are therefore
built exactly as for the full data.

- Exports never use the fast layer: PDF, SVG, TikZ and CSV come from the data through SveltePlot
  as before (byte-identical output), and PNG is the rasterised SVG as before.
- Pixel parity is a test (`tests/e2e/fast-layers.spec.ts`): every canvas of every fast panel is
  compared with SveltePlot's canvas (`?fast=0`) at the same size. Tolerance: at most 2/255 per
  channel on at most 0.1 % of the channels. Measured: **0 differing pixels** on every canvas.
- One intended difference: SveltePlot's `DotCanvas` reads `strokeWidth` from `mark.options`
  before `Mark` has set them, so canvas dots on screen always had 1.6 px outlines while the
  export used the mark's 0.3 px. The fast layer uses the mark's `strokeWidth`: the screen now
  matches the export. The test checks this canvas with a switch that reproduces DotCanvas
  (`__PKV_DOTCANVAS_COMPAT__`) and then finds 0 differing pixels: nothing else differs.
- Fallback: `?fast=0` turns the fast layers off (everything through SveltePlot, as before); both
  paths are covered by the e2e suite in Chromium and Firefox.

### 2. One draw per frame, and only when the pixels change

Canvas layers (FastDots, FastLines) record their draw in an effect and draw once per animation
frame (`src/lib/plot/fast/frames.ts`); a layer skips the draw when the values of its scales,
its size, data and style are unchanged (SveltePlot builds new scale objects whenever any mark
changes, a brush rectangle for example). Dot layers above 20,000 dots draw in 10 ms slices into
a buffer canvas and copy it when complete: the same operations on one context, so the same pixels,
without a long frame. The export waits for pending draws instead of a fixed 250 ms poll.

### 3. Pan and zoom

The GOF overall plot and the raw-lines plots zoom with Ctrl/⌘ + wheel or the toolbar, pan in
pan mode, and reset by double-click or the toolbar (`src/lib/plot/zoom/`). The view is defined in
pixel space, so a datum's new pixel is an affine function of its old pixel for linear, log and
symlog scales: during a gesture canvas layers show their last bitmap through that map (one
`drawImage`, independent of the number of marks) and redraw when it pauses. Marks are clipped
to the frame while zoomed. Exports always show the full data range.

### 4. JavaScript fixes where transforms were costly (bitwise identical)

- `sortedFinite`/`quantiles`: sort once with a typed-array sort, then restore the input order of
  ±0 so the array equals the comparator sort element for element (unit-tested): `credible()`
  446 → 55 ms for 200 columns.
- KDE: the same arithmetic in the same order over a typed array (oracle test against the old
  loop): 414 → 313 ms for 25 ridges. The rest is `Math.exp`; see below.
- Raw lines: series keys ranked once instead of two string concatenations per comparison (same
  order, tested on the fixture).
- Zip: entries inflated on first read with fflate's asynchronous `unzip` (a worker in browsers)
  instead of all at open; the trajectories table is decoded as soon as a bundle opens.
- Brush: bounds read once per update (not through the reactive proxy per point), the selection
  applied when the pointer pauses (120 ms; the rectangle follows at once), best-fit rows built
  once, highlight dots on the fast layer.

### 5. Firefox exports

The fit-to-width check measured SVG text with `getBoundingClientRect()`, which in Firefox pads
SVG text by about 1 px per side ("1K": 19.38 px vs a 17.35 px glyph box). Figures that fit in
Chromium were refused at 85 mm in Firefox. Text is now measured by its glyph box (`getBBox()`)
mapped through its screen transform, the same box in both browsers. With one draw per frame
and one render, the Firefox raw-lines PNG export went from 23.5 s to ≈ 3.3 s.

### 6. No WebAssembly, no Rust toolchain in the build

- **Kernels.** Not justified by the profile: transforms are 10–120 ms per scenario; the two
  costly cases were fixed in JS with bitwise-identical results. KDE is now bound by `Math.exp`
  (≈ 12 ns per kernel evaluation); a WASM loop with `libm::exp` would at best save part of the
  loop overhead and would change the last bits (rtol 1e-12 instead of identical). M4 decimation
  removes nothing here (each raw-lines series has 14 points, the plot has hundreds of pixel
  columns). A spatial index is not needed: filtering 102,868 points by a brush rectangle takes ≈ 3.6 ms (V8, measured), and runs once when the pointer pauses; there is no hover picking on these panels.
- **Rasteriser.** tiny-skia 0.12 (compiled to wasm32, `opt-level=3`, plain `extern "C"`
  exports, no glue) was measured against Canvas2D on the raw-lines workload (8,000 series ×
  14 points, one stroked path at 0.15 alpha, `bench/wasm-raster/`):

  | Size, line width | Canvas2D Chromium | tiny-skia Chromium | Canvas2D Firefox | tiny-skia Firefox |
  |---|---|---|---|---|
  | 800 × 500, 0.6 px (screen) | 93 ms | 3,984 ms | 85 ms | 3,687 ms |
  | 2,000 × 1,250, 3.75 px (600 dpi) | 1,345 ms | 2,667 ms | 1,279 ms | 3,263 ms |
  | 4,000 × 2,500, 7.5 px (1200 dpi) | 2,515 ms | 4,211 ms | 2,245 ms | 5,750 ms |

  tiny-skia was 2–40× slower and its anti-aliasing differs from both browsers' (69 % of the
  channels differ at hairline widths), so screen and export would no longer match the browser's
  own rendering. The 424 KB module (before `wasm-opt`) would have used a third of the remaining
  size budget. Not adopted; the spike stays in `bench/wasm-raster/` to reproduce the numbers.
- Consequently no `kernels/` crate, no `rust-toolchain.toml`, no wasm-bindgen, no Rust CI job,
  no WASM parity suites: there is no WASM code in the app. The 10 parity tests run unchanged.
- **Workers / OffscreenCanvas** for drawing were not adopted either: after the changes above no
  screen draw blocks a frame for long (pan/zoom and brush stay at the frame rate in Chromium), and
  Firefox's Canvas2D cost at export resolution (≈ 1.1 s for one 56,000-point layer) is the same
  in a worker; it would only move it.

## Size

Single file: 1,866,036 B (main) → 1,887,890 B (+21,854 B, +1.2 %): fast layers, zoom, frame
scheduler and the opt-in profiling spans. Budget 2.5 MB. No `.wasm`, no JS glue.

## Consequences

- SveltePlot remains the source of truth for scales, axes and exports; the fast layer depends on
  its exported helpers (`projectX/Y`, `isValid`, `resolveColor`) and its facet context. A
  SveltePlot upgrade must re-run `tests/e2e/fast-layers.spec.ts`.
- Lines and areas (posterior ridgeline, parameter parallel lines) still go through SveltePlot's
  Mark pipeline; the ridgeline panel (≈ 1.3 s) is the slowest left.
- `scripts/profile.mjs` and `scripts/frames.mjs` reproduce every number in
  `docs/performance-profile.md` and `docs/performance.md`.
