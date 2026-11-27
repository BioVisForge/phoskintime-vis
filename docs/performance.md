# Measured performance

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
