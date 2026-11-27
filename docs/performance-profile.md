# Performance profile: where the time goes (before `feat/wasm-perf`)

Measured 2026-11-27 on the development host (96 cores, load ≈ 3 during the runs), fixture
`network` (100 proteins, 400 states × 20 samples = 8,000 series, 112,000 trajectory rows;
200 parameters; posterior 4 × 500 × 200), single-file build opened from `file://`, headless
Chromium 159.0.8154.6 and Firefox 159.0, viewport 1360 × 1000. Medians of 3 runs.

How: `node scripts/profile.mjs chromium|firefox` (raw data in `docs/profile/`).

- **Stage spans (both browsers).** With `__PKV_PROFILE__` set, the app records its own stage
  times (`src/lib/perf/spans.ts`; a no-op otherwise): zip inflate, Parquet decode (timed inside
  the worker), sha256, transforms (quantiles, KDE, box, envelopes, GOF, deltas), data shaping
  (columns → row objects), Canvas2D drawing of the FastLines layer, export render, compose and encode.
- **CPU profile (Chromium only).** An extra run of a source-mapped build records a V8 CPU
  profile and a rendering trace. Each main-thread sample is attributed to a stage by the
  original source file of its innermost frame (e.g. `node_modules/svelteplot/dist/Mark.svelte`
  → Svelte/SveltePlot). Playwright cannot record a CPU profile in Firefox, so there the
  remainder (wall time − instrumented stages) is "Svelte/SveltePlot, SVG, layout, paint".

## Summary

| Scenario | Chromium | Firefox | Target | Dominant cost |
|---|---|---|---|---|
| Open zip → first panel (Fit quality, nm-gof) | 3,101 ms | 4,466 ms | ≤ 1,000 / ≤ 1,500 ms | SveltePlot per-datum mark processing |
| GOF panel alone | 2,608 ms | 3,992 ms | ≤ 500 ms | SveltePlot per-datum mark processing |
| Raw lines on (8,000 series) | 640 ms | 903 ms | no regression | sort with string keys; Canvas2D stroke |
| Comparison load | 1,761 ms | 2,385 ms | no regression | Svelte/SveltePlot |
| 600 dpi PNG, raw-lines panel | 3,580 ms | 23,502 ms¹ | no regression | Chromium: waiting + SVG→canvas; Firefox: Canvas2D stroke at 6.25× |
| PDF, raw-lines panel | 4,477 ms | 24,915 ms¹ | no regression | Chromium: jsPDF image deflate + waiting; Firefox: Canvas2D stroke |

¹ In Firefox the 85 mm export of this panel is refused by the fit check (text lays out about
1 mm wider: "needs about 86 mm"); timed with the offered "Use 1.5 column (114 mm)" fix, so the
panel is rendered twice. Each export-resolution render strokes the 112k-point path once (≈ 9 s).

## Chromium: main-thread CPU by stage (ms, one profiled run)

| Stage | Open | GOF | Raw lines | Compare | PNG 600 dpi | PDF |
|---|---|---|---|---|---|---|
| **Svelte/SveltePlot reactivity + SVG** | **2,274** | **2,264** | 328² | **1,302** | 457 | 485 |
| Parquet decode (hyparquet, worker, off main thread) | 130 | 137 | – | 280 | – | – |
| zip inflate (fflate, main thread) | 144 | – | – | 95 | – | – |
| sha256 (WebCrypto) | 9 | – | – | 9 | – | – |
| transforms (quantiles, KDE, box, envelopes, GOF, deltas) | 18 | 19 | – | 76 | 36 | 67 |
| data shaping (columns → row objects) | 20 | 20 | 143² | 168 | 18 | 19 |
| data-mark drawing (Canvas2D) | 93 | 103 | 49–203³ | – | 202 | 211 |
| browser native: style, layout, paint (trace: style / layout / paint) | 90 (16 / 31 / 21) | 21 | 12 | 54 | 71 | 45 |
| garbage collection | 107 | 110 | 19 | 163 | 36 | 75 |
| export compose + encode | – | – | – | – | 1,103 | 2,041⁴ |
| idle (waiting inside the measured window) | 222 | 26 | 10 | 72 | 1,546 | 1,576 |

² The raw-lines time in "Svelte" is `AllTrajectories.svelte` building the per-layer arrays:
112,000 indices sorted with a comparator that concatenates two strings per comparison.
³ 49 ms of JS in the CPU profile; 203 ms as a span (includes the canvas allocation and the stroke).
⁴ Of which 1,157 ms is fflate deflating the embedded raster image inside jsPDF, 467 ms jsPDF itself.

### What "Svelte/SveltePlot" is

Top source files by self time in the GOF run: `svelteplot/dist/Mark.svelte` 684 ms,
`svelte/…/reactivity/props.js` 484 ms, `svelteplot/dist/helpers/scales.js` 191 ms,
`svelte/…/runtime.js` 155 ms, `svelteplot/dist/helpers/resolve.js` 131 ms,
`isDataRecord.js` 63 ms, `facets.js` 50 ms. `Mark.svelte` resolves every datum against all
≈ 20 channels, reading each option through the reactive props proxy, twice (resolve, then
scale). In a faceted plot every facet's Mark does this for the whole data set and then
filters. GOF has 4,912 points in the overall plot and the same 4,912 again in a plot with
3 facets, so that's ≈ 20,000 full passes per render. SveltePlot's DotCanvas then calls
`getComputedStyle` once per dot to resolve `var(--pkv-ink)` (most of the 93–103 ms drawing).

### Experiment: the same build with GOF's two Dot marks given empty data

| | Chromium | Firefox |
|---|---|---|
| Open → first panel | 3,101 → **836 ms** | 4,466 → **1,103 ms** |
| GOF alone | 2,608 → **561 ms** | 3,992 → **682 ms** |

Everything else in the panel (axes, band lines, flagged rings and labels, table, facets) stays.
This is the floor for a data layer that bypasses the Mark pipeline, before the cost of drawing
the 9,824 dots again (≈ 10–30 ms on canvas with colours resolved once).

## Firefox: instrumented stages (ms)

| Stage | Open | GOF | Raw lines | Compare | PNG 600 dpi¹ | PDF¹ |
|---|---|---|---|---|---|---|
| wall | 4,466 | 3,992 | 903 | 2,385 | 23,502 | 24,915 |
| zip inflate | 125 | – | – | 123 | – | – |
| Parquet decode (worker) | 141 | 138 | – | 290 | – | – |
| sha256 (async, overlaps other work) | 77 | – | – | 396 | – | – |
| transforms | 120 | 10 | – | 46 | 102 | 109 |
| data shaping | 37 | 16 | – | 111 | 46 | 46 |
| Canvas2D drawing (FastLines) | – | – | 448 | – | **18,730** | **18,629** |
| export render (incl. drawing) / compose / encode | – | – | – | – | 21,675 / 122 / 1,429 | 21,580 / 119 / 2,968 |
| remainder: Svelte/SveltePlot, SVG, layout, paint | ≈ 4,100 | ≈ 3,960 | ≈ 450 | ≈ 1,600 | – | – |

## Per panel in isolation (`scripts/perf.mjs`, single run each)

| Panel | Chromium | Firefox | Marks through SveltePlot's Mark pipeline |
|---|---|---|---|
| nm-gof | 2,215 | 3,697 | Dot 4,912 + Dot 4,912 × 3 facets |
| nm-residuals | 1,731 | 2,816 | Dot 4,912 × 3 facets, BoxY 4,912, ridges |
| nm-post-ridge | 1,612 | 3,209 | AreaY + Line, 25 × 256 = 6,400 points |
| nm-param-parallel | 580 | 1,096 | Dot (chains × parameters) |
| nm-post-ci / nm-param-corr | 539 / 513 | 349 / 826 | |
| nm-convergence | 458 | 671 | |

Open → all files verified: 4,706 / 7,633 ms. Single file: 1,869,277 B.

## Pan / zoom / brush

No panel has pan or zoom. Brushing exists in GOF, Pareto, Multistart, Sensitivity (network) and
ParamPairs (protwise); the largest brushable set in the fixtures is GOF's 4,912 points. No
existing panel or fixture has 100k+ brushable marks. The 100k+ data layer (raw lines) has no
interaction.

## Conclusions

- **Leave alone:** Parquet decode (hyparquet, 130–290 ms, already in a worker, off the main
  thread), sha256 (WebCrypto, 9 ms of main thread), transforms (10–120 ms in every scenario; the
  data is 5k–112k values). Moving the transforms to WASM would save at most tens of ms per
  scenario: below the run-to-run noise of these measurements.
- **The bottleneck is SveltePlot's per-datum Mark pipeline:** 60–75 % of open, GOF and
  comparison time, and the same for the slowest panels. Removing the GOF dot marks alone meets
  the open-time targets in both browsers.
- **Firefox Canvas2D at export resolution** is the second real bottleneck: ≈ 9 s per stroke of
  the 112k-point raw-lines path at 6.25× (Chromium ≈ 0.1 s).
- **Export waiting:** ≈ 1.5 s of every Chromium export is idle polling for the offscreen render
  to settle; the Chromium PDF spends 1.2 s deflating the raster image.
- **Smaller:** zip inflate on the main thread (125–145 ms, inflates every file at open);
  raw-lines array building (143 ms, string-concatenating comparator); `getComputedStyle`
  per dot in SveltePlot's DotCanvas.
