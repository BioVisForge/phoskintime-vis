# Measured performance

Measured with `scripts/perf.mjs` on 2026-11-26: the single-file build (`dist-single/index.html`,
995,577 bytes) opened from `file://` in headless Playwright browsers on the
development machine. Fixture `network`: network (100 proteins, 400 states x 20 samples = 8,000 series, 112,000 rows; 200 parameters; posterior 4x500x200). These are one-run measurements. Expect
variance between machines and runs. Raw numbers: `docs/performance.json`.

| Measure | Chromium 159.0.8154.6 | Firefox 159.0 |
|---|---|---|
| Open zip → first panel drawn (nm-gof: 4,912 obs/pred points, plus 3 per-layer facets) | 3,347 ms | 5,442 ms |
| Open zip → all 18 files sha256-verified | 5,117 ms | 8,038 ms |
| Heaviest panel in isolation | nm-gof 2,486 ms | nm-gof 4,262 ms |
| “Raw lines” on: 8,000 series × 14 points on canvas (FastLines) | 516 ms | 897 ms |
| Comparison load (open 2nd bundle → all comparison sections drawn) | 1,523 ms | 6,605 ms |
| Built single page size | 995,577 B | — |

Slowest panels in isolation (Chromium): nm-gof 2,486 ms, nm-post-ridge 1,612 ms, nm-residuals 1,325 ms, nm-param-parallel 596 ms, nm-param-corr 557 ms, nm-post-ci 539 ms, nm-convergence 471 ms, nm-sensitivity 283 ms.

Parquet decoding alone (112,000 rows): 58 ms in Chromium and 86 ms in Firefox (median, `docs/decisions/0001-parquet-reader.md`).

## What changed the numbers (measured before → after, Chromium)

| Change | Before | After |
|---|---|---|
| Dot marks above 1,000 points drawn on canvas (GOF, residuals, parameter vectors). Svelte's runtime cost grew faster than linearly with the number of per-point SVG elements (`push_teardown_context` dominated the profile). | main thread blocked ~36 s after opening `network` | ~5 s |
| Panels mount one per frame (render queue), and tables are handed to waiting panels one per frame | first panel 5,295 ms | 3,327 ms |
| Ridgeline: offset baselines instead of 25 `fy` facets | 20,956 ms | 1,612 ms |
| Raw lines: FastLines canvas layer from typed arrays instead of a 112k-point SveltePlot Line | 9,503 ms | 516 ms |

## Remaining costs

- GOF is the heaviest panel: two point marks of 4,912 points each, processed by SveltePlot's mark pipeline. All points are kept (no downsampling).
- Firefox is about 1.5–4× slower than Chromium throughout. Comparison load is the largest gap (6.6 s vs 1.5 s).
- The drawing layer for very many lines is swappable (`src/lib/panels/shared/FastLines.svelte`). A WebGL layer with the same props can replace it at 10k+ series.
