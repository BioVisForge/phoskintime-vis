# Measured performance

## feat/wasm-perf: before → after (2026-11-27)

Single-file build from `file://`, headless Chromium 159.0.8154.6 and Firefox 159.0, fixture
`network` (and `gof-100k` for 102,868 GOF points), development host at load < 3. Medians of 3
runs (`scripts/profile.mjs`; raw data in `docs/profile/before.*.json` and `after.*.json`). Where
the time went before: `docs/performance-profile.md`. What changed and why: decision 0006.

**Targets**

| Target | Chromium | Firefox |
|---|---|---|
| open → first panel ≤ 1.0 s (Chromium) / ≤ 1.5 s (Firefox) | 1,000 ms: met (at the limit) | 1,230 ms: met |
| GOF ≤ 0.5 s | 713 ms: **not met** | 782 ms: **not met** |
| pan/zoom/brush on 100k+ marks ≤ 20 ms per frame (p95) | **partly met**: GOF (overall and facets) and raw lines p95 ≤ 16.8 ms; residuals zoom p95 33.4 ms | **not met**: p95 33–50 ms on GOF and residuals (median 17.1–33.2 ms); raw lines 17.1 ms |
| no regression | none found (see below) | none found |

GOF floor: measured as the GOF panel opened from the overview, while the trajectories table is
still being decoded (≈ 140 ms in the worker; the table is now prefetched at open, so a user who
spends half a second on the overview no longer waits for it). The rest (≈ 550 ms) is
SveltePlot laying out four plot frames (overall + three facets), their axes, the stats table and
the flagged labels; GOF with its two dot layers removed entirely took 561 ms (experiment in the
profile), so the dots now cost ≈ 150 ms and the remaining floor is SveltePlot's, not the data's.

Firefox frames (and the residuals zoom in Chromium): during a gesture the data layers only draw a
transformed bitmap; the frames over one vsync are SveltePlot recomputing scales and re-rendering
axes and SVG marks for every view change, which Firefox does more slowly than Chromium. The
measured floor is therefore SveltePlot's per-view-change cost: one frame (16.7 ms) in Chromium
for most plots, two to three (33–50 ms) in Firefox. Plots with many SVG lines are slower in both
(parameter parallel coordinates, 200 polylines: Chromium p95 50 ms, Firefox 117–134 ms;
follow-up e). After a gesture, faceted plots redraw their three 34k-dot layers in slices that
share one 10 ms budget per frame (one frame over 20 ms at most, 66–100 ms). After a brush the selected states' trajectories plot is mounted once
(Chromium 183–233 ms, Firefox 300–350 ms: the "after the gesture" column), when the pointer pauses.

| Measure | Chromium | Firefox |
|---|---|---|
| Open zip → first panel drawn (Fit quality, nm-gof) | 3,101 ms → 1,000 ms (−68 %) | 4,466 ms → 1,230 ms (−72 %) |
| GOF panel alone (from the overview) | 2,608 ms → 713 ms (−73 %) | 3,992 ms → 782 ms (−80 %) |
| “Raw lines” on: 8,000 series on canvas | 640 ms → 397 ms (−38 %) | 903 ms → 413 ms (−54 %) |
| Comparison load (2nd bundle → all sections drawn) | 1,761 ms → 1,769 ms (+0 %) | 2,385 ms → 2,315 ms (−3 %) |
| 600 dpi PNG export, raw-lines panel (85 mm) | 3,580 ms → 3,123 ms (−13 %) | 23,502 ms → 3,369 ms (−86 %) ¹ |
| PDF export, raw-lines panel (85 mm) | 4,477 ms → 4,034 ms (−10 %) | 24,915 ms → 4,575 ms (−82 %) ¹ |
| Open zip → all files sha256-verified | 4,706 ms → 1,650 ms (−65 %) | 7,633 ms → 2,197 ms (−71 %) |

| Panel in isolation (scripts/perf.mjs) | Chromium | Firefox |
|---|---|---|
| nm-gof | 2,215 ms → 425 ms (−81 %) | 3,697 ms → 520 ms (−86 %) |
| nm-residuals | 1,731 ms → 547 ms (−68 %) | 2,816 ms → 892 ms (−68 %) |
| nm-post-ridge | 1,612 ms → 1,527 ms (−5 %) | 3,209 ms → 2,788 ms (−13 %) |
| nm-param-parallel | 580 ms → 336 ms (−42 %) | 1,096 ms → 576 ms (−47 %) |
| nm-post-ci | 539 ms → 178 ms (−67 %) | 349 ms → 203 ms (−42 %) |
| nm-param-corr | 513 ms → 554 ms (+8 %) | 826 ms → 844 ms (+2 %) |
| nm-convergence | 458 ms → 435 ms (−5 %) | 671 ms → 663 ms (−1 %) |
| nm-sensitivity | 278 ms → 287 ms (+3 %) | 406 ms → 377 ms (−7 %) |
| nm-all-trajectories | 275 ms → 248 ms (−10 %) | 344 ms → 331 ms (−4 %) |
| nm-param-dist | 229 ms → 212 ms (−7 %) | 328 ms → 333 ms (+2 %) |
| nm-steady | 204 ms → 199 ms (−2 %) | 202 ms → 197 ms (−2 %) |
| nm-post-trace | 196 ms → 195 ms (−1 %) | 392 ms → 341 ms (−13 %) |
| nm-profile | 181 ms → 196 ms (+8 %) | 370 ms → 375 ms (+1 %) |
| nm-timeseries | 170 ms → 151 ms (−11 %) | 239 ms → 258 ms (+8 %) |
| heatmap | 159 ms → 168 ms (+6 %) | 250 ms → 222 ms (−11 %) |
| nm-multistart | 158 ms → 131 ms (−17 %) | 214 ms → 240 ms (+12 %) |
| nm-insights | 157 ms → 146 ms (−7 %) | 224 ms → 221 ms (−1 %) |
| nm-post-predictive | 146 ms → 141 ms (−3 %) | 209 ms → 197 ms (−6 %) |
| nm-matrices | 116 ms → 114 ms (−2 %) | 233 ms → 318 ms (+36 %) |
| nm-pareto | 100 ms → 94 ms (−6 %) | 165 ms → 165 ms (+0 %) |
| nm-post-density | 74 ms → 69 ms (−7 %) | 118 ms → 115 ms (−3 %) |
| nm-kinase | 66 ms → 56 ms (−15 %) | 96 ms → 97 ms (+1 %) |

Single file: 1,866,036 B on main → 1,895,297 B in the final build of this branch (+29,261 B, +1.6 %; budget 2.5 MB). The per-panel runs above used the build before pan/zoom on every scatter plot (1,887,743 B).

**Frame intervals during gestures, chromium 159.0.8154.6** (60 Hz: 16.7 ms is one frame; host load 3.2 → 1.4)

| Gesture | frames | median | p95 | max | after the gesture: max (frames > 20 ms) |
|---|---|---|---|---|---|
| GOF overall, 4,912 points (network): Ctrl+wheel zoom in, 30 steps | 109 | 16.7 | 16.8 | 33.2 | 16.8 (0) |
| GOF overall, 4,912 points (network): pan, 40 steps | 43 | 16.7 | 16.7 | 16.8 | 16.8 (0) |
| GOF overall, 4,912 points (network): brush, 40 steps | 43 | 16.7 | 16.8 | 16.8 | 183.3 (1) |
| GOF overall, 102,868 points (gof-100k): Ctrl+wheel zoom in, 30 steps | 91 | 16.7 | 16.7 | 16.8 | 16.7 (0) |
| GOF overall, 102,868 points (gof-100k): pan, 40 steps | 44 | 16.7 | 16.8 | 16.8 | 16.8 (0) |
| GOF overall, 102,868 points (gof-100k): brush, 40 steps | 44 | 16.7 | 16.7 | 16.8 | 250 (1) |
| GOF per-layer facets, 102,868 points (gof-100k): Ctrl+wheel zoom in, 30 steps | 90 | 16.7 | 16.7 | 33.3 | 66.6 (1) |
| GOF per-layer facets, 102,868 points (gof-100k): pan, 40 steps | 45 | 16.7 | 16.8 | 16.8 | 83.2 (1) |
| Residuals, 102,868 points in 3 facets (gof-100k): Ctrl+wheel zoom in, 30 steps | 90 | 16.7 | 33.4 | 50 | 83.3 (1) |
| Residuals, 102,868 points in 3 facets (gof-100k): pan, 40 steps | 86 | 16.7 | 16.7 | 33.4 | 66.6 (1) |
| Parameter parallel coordinates, 2,400 dots (network): Ctrl+wheel zoom in, 30 steps | 91 | 16.7 | 50.1 | 50.1 | 16.8 (0) |
| Parameter parallel coordinates, 2,400 dots (network): pan, 40 steps | 87 | 16.7 | 50.1 | 50.1 | 16.8 (0) |
| raw lines, 56,000 points per plot (network): Ctrl+wheel zoom in, 30 steps | 61 | 16.7 | 16.8 | 16.8 | 16.8 (0) |
| raw lines, 56,000 points per plot (network): pan, 40 steps | 40 | 16.7 | 16.8 | 16.8 | 16.7 (0) |

**Frame intervals during gestures, firefox 159.0** (60 Hz: 16.7 ms is one frame; host load 1.4 → 0.9)

| Gesture | frames | median | p95 | max | after the gesture: max (frames > 20 ms) |
|---|---|---|---|---|---|
| GOF overall, 4,912 points (network): Ctrl+wheel zoom in, 30 steps | 58 | 17.1 | 34.2 | 50.3 | 17.1 (0) |
| GOF overall, 4,912 points (network): pan, 40 steps | 44 | 17.1 | 33.3 | 50.3 | 17.1 (0) |
| GOF overall, 4,912 points (network): brush, 40 steps | 43 | 17.1 | 17.1 | 33.2 | 300.2 (1) |
| GOF overall, 102,868 points (gof-100k): Ctrl+wheel zoom in, 30 steps | 56 | 17.1 | 49.3 | 50.3 | 17.1 (0) |
| GOF overall, 102,868 points (gof-100k): pan, 40 steps | 42 | 17.1 | 33.2 | 34.1 | 17.1 (0) |
| GOF overall, 102,868 points (gof-100k): brush, 40 steps | 43 | 33.2 | 33.2 | 34.2 | 416.9 (2) |
| GOF per-layer facets, 102,868 points (gof-100k): Ctrl+wheel zoom in, 30 steps | 65 | 17.1 | 50.3 | 67.3 | 83.4 (1) |
| GOF per-layer facets, 102,868 points (gof-100k): pan, 40 steps | 41 | 17.1 | 33.2 | 33.2 | 83.4 (1) |
| Residuals, 102,868 points in 3 facets (gof-100k): Ctrl+wheel zoom in, 30 steps | 64 | 17.1 | 50.3 | 66.3 | 100.4 (2) |
| Residuals, 102,868 points in 3 facets (gof-100k): pan, 40 steps | 41 | 33.2 | 34.2 | 99.5 | 99.4 (1) |
| Parameter parallel coordinates, 2,400 dots (network): Ctrl+wheel zoom in, 30 steps | 62 | 17.1 | 133.6 | 149.7 | 17.1 (0) |
| Parameter parallel coordinates, 2,400 dots (network): pan, 40 steps | 43 | 100.5 | 116.6 | 117.5 | 17.1 (0) |
| raw lines, 56,000 points per plot (network): Ctrl+wheel zoom in, 30 steps | 37 | 17 | 17.1 | 17.1 | 17.1 (0) |
| raw lines, 56,000 points per plot (network): pan, 40 steps | 40 | 17.1 | 17.1 | 17.1 | 17.1 (0) |

Per-panel rows are single runs. The two that read slower were re-measured with 5 runs each,
main vs this branch (median): nm-param-corr Chromium 888 → 861 ms, Firefox 1,105 → 1,120 ms;
nm-matrices Chromium 325 → 336 ms, Firefox 538 → 383 ms: no regression.

¹ Before, Firefox refused the 85 mm export of this panel (fit check; decision 0006) and was
timed with the dialog's "1.5 column" fix, i.e. with two renders. After, it exports at 85 mm.

**Still slow (not changed by this work):** the 600 dpi PNG of the GOF panel takes ≈ 19 s on main
and on this branch: in export mode its ≈ 10,000 dots are vector SVG elements (exports unchanged
by design); mounting them is ≈ 16.5 s of Svelte/SveltePlot work (CPU profile, `pngGof` scenario). A string-built
SVG for vector dot exports, byte-compared with today's output, is the next step. The posterior
ridgeline (≈ 1.5 s) still sends 6,400 area/line points through SveltePlot's Mark pipeline.

Frame intervals: `scripts/frames.mjs` (real mouse/wheel input, rAF logger; raw data
`docs/profile/frames.*.json`).

## Before feat/wasm-perf

Measured with `scripts/perf.mjs`: the single-file build opened from `file://` in headless
Playwright browsers on the development machine. Fixture `network`:
network (100 proteins, 400 states x 20 samples = 8,000 series, 112,000 rows; 200 parameters; posterior 4x500x200). These are single runs, so expect variance between machines and runs.
Raw numbers: `docs/performance-baseline.json` (before the export/UI work, `feat/foundation`) and
`docs/performance.json` (after, `feat/export-ui`).

## Before → after the export and UI work

| Measure | Chromium 159.0.8154.6 | Firefox 159.0 |
|---|---|---|
| Open zip → first panel drawn (Fit quality, nm-gof) | 3,313 → 2,935 ms (-11 %) | 5,387 → 4,765 ms (-12 %) |
| Open zip → all files sha256-verified | 5,078 → 4,768 ms (-6 %) | 7,965 → 7,615 ms (-4 %) |
| Heaviest panel in isolation (nm-gof) | 2,454 → 2,252 ms (-8 %) | 4,247 → 3,756 ms (-12 %) |
| “Raw lines” on: 8,000 series on canvas | 524 → 545 ms (+4 %) | 861 → 827 ms (-4 %) |
| Comparison load (2nd bundle → all sections drawn) | 1,361 → 1,440 ms (+6 %) | 6,621 → 1,910 ms (-71 %) |
| Single-file size | 995,518 → 1,866,036 B (+87 %) | same file |

There are no timing regressions above 10 %. Two caveats: the before and after first-panel
measurements land on different pages (before: the old single page; after: the Fit quality
section), and panels now mount only for the open section. The Firefox comparison load is much
faster because comparison mode is its own section instead of sitting below every panel.

The **size increase (+87 %) is intended and within the 2.5 MB budget**:

| Part | Bytes in the single file |
|---|---|
| jsPDF + svg2pdf.js (vector PDF export) | ≈ 483,000 (measured: build without them is 1,371,426 B) |
| PKV Sans Regular + Bold, base64 | ≈ 246,000 (2 × 92 kB TTF, hinted; see decision 0004) |
| new UI shell, export pipeline, TikZ emitter | ≈ 130,000 |

jsPDF's optional `html2canvas`, `dompurify` and `canvg` are excluded (aliased to an empty
module).

Slowest panels in isolation after the change (Chromium): nm-gof 2,265 ms, nm-residuals 1,760 ms, nm-post-ridge 1,702 ms, nm-param-parallel 608 ms, nm-param-corr 544 ms, nm-post-ci 535 ms.

## Export timings (Chromium, 85 mm, 8 pt, network fixture)

| Action | Time |
|---|---|
| Export all 22 network panels as TikZ zip | 40 s |
| Export all 22 network panels as 300 dpi PNG | 42 s |
| Export all 15 protwise panels as TikZ zip | 8 s |
| svg2pdf + jsPDF, one path of 50,000 / 112,000 points | 164 / 300 ms (decision 0002) |
| LuaLaTeX compile, 20,000 / 80,000 marks in one axis | 11.7 / 43.6 s (decision 0003) |

## Earlier optimisations (first milestone)

| Change | Before | After |
|---|---|---|
| Dot marks above 1,000 points drawn on canvas (Svelte runtime cost grows faster than linearly with per-point SVG elements) | ~36 s main-thread block | ~5 s |
| Panels mount one per frame (render queue); tables handed to waiting panels one per frame | first panel 5,295 ms | 3,327 ms |
| Ridgeline: offset baselines instead of 25 `fy` facets | 20,956 ms | 1,612 ms |
| Raw lines: FastLines canvas layer instead of a 112k-point SveltePlot Line | 9,503 ms | 516 ms |
