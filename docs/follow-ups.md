# Follow-ups from feat/wasm-perf

Measured, not fixed in this branch. Numbers: `docs/performance.md`, `docs/performance-profile.md`.

## a) GOF 600 dpi PNG export takes ≈ 19 s

Same on main (18.5–19.0 s, Chromium). 18.3 s is the offscreen render: in export mode GOF's two dot
layers (4,912 points each) are vector SVG, one SveltePlot `<path>` per dot, and mounting ≈ 10,000
mark components is ≈ 16.5 s of Svelte/SveltePlot work (CPU profile, `pngGof` scenario in
`scripts/profile.mjs`). Compose 0.75 s, encode 0.63 s.

**Proposal:** in export mode, build the dot layer's SVG as text (one string per layer: the same
`<path transform="translate(x, y)" d="…">` with the same resolved styles SveltePlot writes), insert
it with `{@html}` inside the mark group, and skip the per-dot components.

**Test first:** for every panel and fixture, export SVG and PDF with the current code, store them as
fixtures, and require the new path to give **byte-for-byte identical** SVG (and identical PDF
content streams) before switching. Expected: GOF PNG/PDF/SVG ≈ 19 s → ≈ 2 s. Risk: SveltePlot's
per-dot style resolution (`resolveStyles`) must be reproduced exactly; the byte test catches any drift.

## b) GOF on-screen floor ≈ 550 ms (target 0.5 s)

After the fast dot layer, GOF opened from the overview takes 713 ms (Chromium) / 782 ms (Firefox),
of which ≈ 140 ms is waiting for the trajectories decode in that scenario. The rest is SveltePlot
laying out four plot frames (overall + three facets), axes, legends and the stats table.

| Option | Expected gain (estimate, not measured) | Risk |
|---|---|---|
| Render the overall plot first, the per-layer facets one frame later (render queue) | first useful paint ≈ 300 ms; total unchanged | Low. Tests that wait for "rendered" must wait for both. |
| Cache axis layout (ticks, label widths) per (scale domain, size, font) | ≈ 50–100 ms per re-render of an unchanged axis; nothing on first render | Medium: invalidation on theme/font changes; touches SveltePlot internals (helper outside its API). |
| Facets as one canvas layer with SVG axes only (no per-facet Mark trees) | ≈ 150–250 ms | Medium–high: a second facet layout to keep identical to SveltePlot's; pixel tests needed. |
| Defer the stats table and flagged labels to idle time | ≈ 30–60 ms | Low, but the panel's "rendered" state must include them for exports. |

Each needs a profile before and after (`node scripts/profile.mjs chromium --only gof`).

## c) Firefox gesture frames: p95 33–50 ms (target 20 ms)

During pan/zoom the data layers only draw a transformed bitmap; frames over one vsync come from
SveltePlot recomputing scales and re-rendering axes and SVG marks on every view change. Playwright
cannot record a CPU profile in Firefox. **Next step:** a manual run in stock Firefox with the
Firefox Profiler (about:profiling, "JavaScript" + "Layout" presets) on the GOF overall plot of
`gof-100k` while zooming with Ctrl + wheel; attribute the time to SveltePlot (scales, axes, ticks),
Svelte (effects) and layout/paint. Possible fixes after that: throttle view updates to one per frame
(already for canvas, not for the SVG axes), or transform the SVG axes during a gesture as the canvas
layers are.

## d) Posterior ridgeline ≈ 1.5 s

`nm-post-ridge`: 25 KDEs (313 ms after the loop rewrite; `Math.exp`-bound) and 6,400 area/line
points through SveltePlot's Mark pipeline (≈ 1 s). Options: a fast line/area layer like FastDots
(canvas; pixel parity against SveltePlot's canvas Line/Area would need its own tolerance study since
these are SVG today), computing the 25 KDEs in the existing worker in parallel with the first paint,
or rendering the visible ridges first.

## e) Zooming plots with many SVG lines: parameter parallel coordinates

Measured with `scripts/frames.mjs` (Chromium): zoom/pan p95 50–83 ms per frame on
`nm-param-parallel` (2,400 dots on the fast layer, but 200 polylines of 12 points drawn by
SveltePlot's Line as SVG). Every view change re-runs SveltePlot's Mark pipeline for the lines and
re-renders 200 `<path>` elements. Options: draw the lines with the existing FastLines canvas
layer on screen (exports unchanged, as for the dots; pixel parity against SveltePlot's canvas
Line needs its own check), or during a gesture transform the line group like the canvas preview.
