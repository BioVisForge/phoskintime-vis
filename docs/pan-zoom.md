# Pan and zoom on scatter plots

Every plot that draws dot marks can be panned and zoomed on screen. One implementation
(`src/lib/plot/zoom/`: `ZoomGroup`, `ZoomPlot`, `ZoomToolbar`, `ZoomLayer`), switched on by the
`zoom` prop of the plot wrapper (`<Plot zoom>` or `<Plot zoom="key">`); no panel has its own copy.

## Controls

| Action | Mouse | Keyboard (plot focused: Tab to it) | Toolbar |
|---|---|---|---|
| Zoom in / out | Ctrl/⌘ + wheel over the plot (Shift: x only) | `+` / `−` | `+` / `−` |
| Pan | drag in pan mode (any wheel zooms in pan mode) | arrow keys (a tenth of the frame) | `pan` (plots with a brush; plots without one are always in pan mode) |
| Reset | double-click in pan mode | `0` | `reset` |
| Facets | | | `link facets` (faceted plots) |

- **Continuous axes only.** A categorical axis (parameter names, subsets) is not zoomed; the plot
  zooms along its continuous axis.
- **Facets.** Facets share their scales, so by default they zoom together ("link facets" on).
  Unlinked, each facet becomes its own plot with its own view and toolbar (a plot faceted by `fy`
  as well keeps its facets linked).
- **Brush.** Plots with a brush start in brush mode; `pan` switches dragging to panning. After a
  zoom the brush still selects in data coordinates (the selection is the data inside the brushed
  rectangle, whatever the view).
- **Large dot sets** (≥ 1,000 dots) are drawn by the fast canvas layer: during a gesture it shows
  its last bitmap transformed, and redraws when the gesture pauses. No number changes.
- **Exports** show the full data range. In the export dialog, **Export current view** exports
  zoomed plots as shown (unlinked facets as separate plots) and the caption states the shown axis
  ranges ("Current view, not the full data range: …"). CSV always holds the full data.

## Plots

Fixtures: `network` (networkmodel), `small-protwise` (protwise), both for the comparison. Each row is
covered by `tests/e2e/pan-zoom.spec.ts` in Chromium and Firefox.

| Panel | Plot (zoom key) | Axes zoomed | Facets | Brush |
|---|---|---|---|---|
| nm-gof Goodness of fit | Overall | x, y | | yes |
| nm-gof | per-layer | x, y | 3 (layers) | |
| nm-gof | selected-trajectories (shown after a brush) | x, y | | |
| nm-residuals Residuals | main | x, y | 3 (layers) | |
| nm-timeseries Per-gene time series | main | x, y | layers | |
| nm-all-trajectories All trajectories (raw lines on) | one plot per layer | x, y | | |
| nm-param-parallel Parameter vectors | main | x (y: parameters) | | |
| nm-multistart Multistart | ranked | x, y | | yes |
| nm-multistart | distribution (dots when < 30 starts) | y (x: one band) | | |
| nm-pareto Pareto front | main | x, y | | yes |
| nm-profile Profile likelihood | main | x, y | 6 (parameters) | |
| nm-post-ci Credible intervals | main | x (y: parameters) | | |
| nm-post-predictive Posterior predictive | main | x, y | | |
| nm-sensitivity Sensitivity (μ*–σ) | mu-sigma | x, y | | yes |
| pw-gof Goodness of fit | Overall | x, y | | yes |
| pw-model-fit Model fit | one plot per part | x, y | | |
| pw-pca PCA | main | x, y | | |
| pw-tsne t-SNE | main | x, y | | |
| pw-parallel Parallel coordinates | main | x (y: states) | | |
| pw-time-state-grid Time × state grid | main | y (x: time points as categories) | states (fx and fy: linked) | |
| pw-phase-space Phase space | main | x, y | | |
| pw-param-pairs Parameter pairs | one plot per pair; focus | x, y | | focus: yes |
| pw-sensitivity Sensitivity (μ*–σ) | mu-sigma | x, y | | yes |
| pw-sensitivity | ranking | x (y: parameters) | | |
| pw-param-profiles Parameter profiles | main | x, y | parameters | |
| Comparison: GOF per layer | gof | x (y: subsets) | | |
| Comparison: trajectory overlay | overlay | x, y | | |
| Comparison: parameter changes | params | x, y | | |
| What-if (feature flag, engine) | main | x, y | | |
