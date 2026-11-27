# SveltePlot patterns: decision record

Patterns P1–P12 come from the owner's addendum. Their examples were read from svelteplot at
**v0.14.2** (`88a7c88`, the pinned version), `src/routes/examples/<group>/<name>.svelte`, together
with the mark sources (`marks/helpers/Box.svelte`, `marks/helpers/Regression.svelte`,
`marks/Raster.svelte`, `marks/DifferenceY.svelte`, `transforms/density.ts`). The addendum cites
`main` @ `3eb6929`. The APIs used here are the same at both versions.

Each panel declares its patterns in `src/lib/panels/registry.ts` (`patterns: [...]`), and
`patternUsage()` lists them. Comparison-mode sections declare theirs in `src/lib/ui/Compare.svelte`.

## Per pattern

| # | Pattern | Used in | Rejected in (reason) |
|---|---|---|---|
| P1 | Streamgraph | — | **Everywhere so far.** The draft bundle stores no additive composition over time. Kinase contributions W_ik·K_k(t) to a site's drive would add up, but the bundle does not store them, and computing them in the viewer would hard-code the RHS (the contract-only rule forbids that). Combinatorial phospho-state occupancies (MODEL 2) are not in any fixture. Never usable for fold changes or ratios. Proposed upstream: export additive drive contributions. |
| P2 | Box plot (Tukey, `BoxY`) | `pw-time-state-grid`, `nm-residuals`, `nm-multistart`, compare `params` (log2 ratio per group) | Credible intervals (`nm-post-ci`) stay quantile-based: a box would imply IQR/whiskers instead of 5–95 %. |
| P3 | Constrained brush | `pw-gof`, `nm-gof` (→ trajectories), `pw-param-pairs` (→ sample trajectories), `pw-sensitivity` / `nm-sensitivity` (μ*–σ → parameter list), `nm-pareto`, `nm-multistart` (→ choose solutions/starts) | Overview + detail zoom on time axes: not added. Time axes are short (14 points); symlog already shows early and late. |
| P4 | Custom glyphs (`CustomMark`) | GOF outliers beyond the 95 % band (rings), knockout markers, comparison-mode known-issue triangles per run | Pie-style glyphs: never. Psite-state glyphs on protein rows: not used yet (no panel needs them). |
| P5 | Difference (`DifferenceY`) | compare `overlay` (A vs B), `pw-knockouts` (WT vs KO), `nm-post-predictive` (fit vs predictive median), What-if (baseline vs engine) | Observed vs predicted: never as an area. Observations are sparse, so differences are shown as points (residual panels). |
| P6 | Many lines + highlight | `nm-all-trajectories` (8,000 series on canvas when toggled, selected gene last), `pw-perturbations` (samples on canvas, best fit on top), `pw-phase-space`, `nm-convergence`, compare `delta-lines`, GOF brush → highlighted trajectories | — |
| P7 | Parallel coordinates | `pw-parallel` (raw values by default, per-state extent toggle), `nm-param-parallel` (bounds-normalised on a log scale, extent, log10) | `curve="monotone-y"` from the example is **not** used: straight segments only. |
| P8 | Raster | `heatmap` (time × state log2 FC), compare `delta-raster` (B − A) | `interpolate="random-walk"` and `blur` from the example are **rejected** for data: they invent values. Used with `interpolate="none"` and `imageRendering="pixelated"`. Sparse W matrix: `Cell` instead (`nm-matrices`). Scattered data (Pareto, posterior): never. |
| P9 | Faceted regression | `nm-gof` (per-layer facets, optional OLS layer), `pw-gof`, `pw-param-pairs`, compare `params` (log10 A vs B) | Parameter pairs are **not** faceted on one shared scale: parameters have different magnitudes, so each pair gets its own small plot. `confidence={0.95}` is set explicitly everywhere (the default is 0.99). |
| P10 | Min/max rules | `pw-perturbations` (min–max per exact time point, always paired with the 5–95 % band), `nm-convergence` (min–max across starts per iteration) | `binX` with an interval is **rejected**: PhosKinTime time grids are irregular. Grouping is by exact stored time (`envelopes()` in `src/lib/transforms/envelope.ts`). Rules are vertical (`RuleX`, y1 = min, y2 = max) at each point, because an exact time point has no bin width. |
| P11 | Vector field | `pw-pca`, `pw-tsne`, `pw-phase-space`: direction-of-time arrows from finite differences between consecutive stored points, drawn at segment midpoints and labelled as such | Flow fields interpolated between trajectories: never. A true conditional flow field needs the engine's RHS (Milestone 2, not available upstream). |
| P12 | Ridgeline | `nm-post-ridge` (replaces `_plot_ridgeline_parameter_distributions`), `nm-residuals` (per layer) | SveltePlot's `densityX` is **not** used. Its kernels and bandwidth differ from PhosKinTime's, so the viewer ports `_smooth_density_1d` (Gaussian, Silverman bandwidth, 256 points over min − 10 % … max + 10 %, peak-normalised) and draws the result with `AreaY` + `Line` + `RuleY` + `Text`. The example's `fy` facets were replaced by PhosKinTime's own layout, one axis with each ridge on its own baseline (y + 0.75·density): with 25 `fy` facets the panel took 20,956 ms to render in Chromium, and with offset baselines 1,612 ms. Bounds: as PhosKinTime does, the grid is **clipped** to each posterior's own [min, max] (`np.clip`), with no reflection, so no density is drawn below the smallest draw. Fill is neutral. x-scale toggle: per-parameter normalised (PhosKinTime), shared log, shared linear. `curve="basis"` from the example is not used. Not used yet: multistart parameter distributions (no per-start parameter vectors in the bundle) and perturbation-sample distributions per state (the box grid covers it). |

## Per panel

| Panel | Patterns | Replaces (PhosKinTime @ e634e17) | Why / why not |
|---|---|---|---|
| pw-model-fit | — | `plot_model_fit` (plotting.py:200) | Single protein; lines and squares are enough. P5 rejected: observed vs predicted is sparse. |
| pw-gof | P9, P4, P3, P6 | `plot_gof` (312) | Identity and 1.96 / 2.576 × std(obs) lines kept; OLS is an optional extra layer. |
| pw-kl | — | `plot_kld` (379) | Bars. |
| pw-reg-mse | — | `plot_regularization` (1008), `plot_model_error` (1055) | Bars. |
| pw-pca, pw-tsne | P11 | `plot_pca` (115), `plot_tsne` (150) | See substitutions. |
| pw-parallel | P7 | `plot_parallel` (46) | Raw values by default (as pandas). |
| pw-knockouts | P5, P4 | `plot_knockouts` (404) | Replaces reading signs by eye. |
| pw-perturbations | P6, P10 | `plot_model_perturbations` fig. 1 (527) | Band by default, raw sample lines on canvas. |
| pw-time-state-grid | P2 | `plot_time_state_grid` (825) | n = 30 per box in fixtures (≥ 30, so points are not overlaid). |
| pw-phase-space | P11, P6 | `plot_phase_space` (898) | Arrows on the best fit only. |
| pw-param-pairs | P9, P3 | `plot_top_param_pairs` (476) | Per-pair axes; brush → sample trajectories. |
| pw-sensitivity | P3 | `plot_model_perturbations` μ*/σ/radar/pie (527) | Radar and pie substituted. |
| pw-param-profiles | — | `plot_profiles` (180, no callers) | Partial counterpart. |
| nm-gof | P9, P4, P3, P6 | `plot_goodness_of_fit` (export.py:291) | Robust σ per layer; facets per layer. |
| nm-timeseries | — | `save_gene_timeseries_plots` (821) | Stable site colours (PhosKinTime's `hash(psite) % 10` is not). |
| nm-all-trajectories | P6 | — (viewer extra) | Quantile bands by default; canvas for 8,000 lines. |
| nm-residuals | P2, P12 | `export_residuals` (1593) | Bias / RMSE as PhosKinTime; box and ridge added. |
| heatmap | P8 | — (viewer extra) | Dense regular grid only. |
| nm-kinase | — | `export_kinase_activities` (1441) | Step curve (`curve="step-after"`) when available, never smoothed. |
| nm-param-dist | — | `Insights.run_parameter_diagnostics` (391) | Histograms. |
| nm-param-corr | — | `export_param_correlations` (1511) | Cell heatmap; substitution of the sample set. |
| nm-param-parallel | P7 | — (viewer extra) | Bounds-normalised near-bound diagnostic. |
| nm-convergence | P10, P6 | `process_convergence_history` (1380, no callers) | — |
| nm-multistart | P2, P3 | `_plot_multistart` (BayesianInference.py:287) | n = 20 < 30, so starts are overlaid. |
| nm-pareto | P3 | — (viewer extra; only Excel export upstream) | Brush to pick solutions. |
| nm-profile | — | `_plot_profile` (575) | Grid space and statistic from the bundle (N13). |
| nm-post-trace, nm-post-density | — | `_plot_posterior` (1384) | Density is a 15-bin histogram as upstream. |
| nm-post-ridge | P12 | `_plot_ridgeline_parameter_distributions` (1253) | Direct replacement. |
| nm-post-ci | — | `_plot_posterior` credible intervals | Quantile-based by rule; P2 rejected. |
| nm-post-predictive | P5 | — (viewer extra) | Fit vs predictive median. |
| nm-sensitivity | P3 | `_plot_sensitivity_indices` (sensitivity.py:552) | Top 30 μ*. |
| nm-steady | — | `plot_steady_state_all` (SteadyStateAnalysis.py:124) | — |
| nm-insights | — | `Insights.run_network_diagnostics` (129), `run_trajectory_feature_export` (540) | — |
| nm-matrices | — (P8 rejected) | — (viewer extra) | Sparse → `Cell`. |
| compare: provenance | P4 | — | Issue triangles per run. |
| compare: overlay | P5, P6 | — | Primary use of P5. |
| compare: delta-lines | P6 | — | Selected state highlighted. |
| compare: delta-raster | P8 | — | Diverging, centred at 0, no interpolation. |
| compare: params | P9, P2 | — | OLS on log10 values; boxes of log2 ratio per group. |
| What-if (flag) | P5 | — | Baseline vs engine scenario, labelled with the engine name and version. |

## Performance rule

Marks drawing more than about 1,000 elements use canvas when "raw lines" is on: `nm-all-trajectories`
(8,000 series × 14 points), `pw-perturbations`, `pw-phase-space`, `nm-convergence` and the
compare delta lines. Measured numbers are in `docs/performance.md`.
