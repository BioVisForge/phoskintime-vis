# Panel inventory and parity references

Each viewer panel is checked against PhosKinTime's own plotting code at
`e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b` (branch `sci/2026-12`). Line numbers are `def` lines at
that commit. At `96d9309` only `protwise/plotting/plotting.py` moved, by +1 line.
This table is generated from `src/lib/panels/registry.ts`, which carries the same references in
code.

Coverage: **full** = same quantities and formulas; **partial** = same data, some elements
missing or not in the bundle; **substituted** = an honest replacement for a chart type, listed in
`docs/substitutions.md`; **viewer-extra** = no PhosKinTime plot exists.

| Panel id | Title | Workflow | PhosKinTime reference @ e634e17 | Coverage | Patterns |
|---|---|---|---|---|---|
| `pw-model-fit` | Model fit | protwise | `protwise/plotting/plotting.py:200` `Plotter.plot_model_fit` | full | — |
| `pw-gof` | Goodness of fit | protwise | `protwise/plotting/plotting.py:312` `Plotter.plot_gof` | full | P9, P4, P3, P6 |
| `pw-kl` | KL divergence per gene | protwise | `protwise/plotting/plotting.py:379` `Plotter.plot_kld` | full | — |
| `pw-reg-mse` | Regularization and MSE | protwise | `protwise/plotting/plotting.py:1008` `Plotter.plot_regularization / plot_model_error` | full | — |
| `pw-pca` | PCA of the model solution | protwise | `protwise/plotting/plotting.py:115` `Plotter.plot_pca` | substituted | P11 |
| `pw-tsne` | t-SNE of the model solution | protwise | `protwise/plotting/plotting.py:150` `Plotter.plot_tsne` | partial | P11 |
| `pw-parallel` | Parallel coordinates | protwise | `protwise/plotting/plotting.py:46` `Plotter.plot_parallel` | full | P7 |
| `pw-knockouts` | Knockouts | protwise | `protwise/plotting/plotting.py:404` `Plotter.plot_knockouts` | partial | P5, P4 |
| `pw-perturbations` | Perturbation cloud | protwise | `protwise/plotting/plotting.py:527` `Plotter.plot_model_perturbations (first figure)` | partial | P6, P10 |
| `pw-time-state-grid` | Time × state grid | protwise | `protwise/plotting/plotting.py:825` `Plotter.plot_time_state_grid` | substituted | P2 |
| `pw-phase-space` | Phase space | protwise | `protwise/plotting/plotting.py:898` `Plotter.plot_phase_space` | full | P11, P6 |
| `pw-param-pairs` | Parameter pairs | protwise | `protwise/plotting/plotting.py:476` `Plotter.plot_top_param_pairs` | full | P9, P3 |
| `pw-sensitivity` | Sensitivity (Morris) | protwise | `protwise/plotting/plotting.py:527` `Plotter.plot_model_perturbations (μ*, σ, radar, pie)` | substituted | P3 |
| `pw-param-profiles` | Parameter profiles | protwise | `protwise/plotting/plotting.py:180` `Plotter.plot_profiles (no callers)` | partial | — |
| `nm-gof` | Goodness of fit (overall and per layer) | networkmodel | `networkmodel/export.py:291` `plot_goodness_of_fit` | full | P9, P4, P3, P6 |
| `nm-timeseries` | Per-gene time series | networkmodel | `networkmodel/export.py:821` `save_gene_timeseries_plots` | full | — |
| `nm-all-trajectories` | All trajectories | networkmodel | — (viewer extra) | viewer-extra | P6 |
| `nm-residuals` | Residuals | networkmodel | `networkmodel/export.py:1593` `export_residuals` | full | P2, P12 |
| `heatmap` | Time × state heatmap (log2 FC) | any | — (viewer extra) | viewer-extra | P8 |
| `nm-kinase` | Kinase activity | networkmodel | `networkmodel/export.py:1441` `export_kinase_activities (RHS: backend.py:291 rhs)` | partial | — |
| `nm-param-dist` | Parameter distributions | networkmodel | `networkmodel/Insights.py:391` `run_parameter_diagnostics (_hist)` | partial | — |
| `nm-param-corr` | Parameter correlations | networkmodel | `networkmodel/export.py:1511` `export_param_correlations` | substituted | — |
| `nm-param-parallel` | Parameter vectors (parallel coordinates) | networkmodel | — (viewer extra) | viewer-extra | P7 |
| `nm-convergence` | Convergence | networkmodel | `networkmodel/export.py:1380` `process_convergence_history (no callers)` | partial | P10, P6 |
| `nm-multistart` | Multistart | networkmodel | `networkmodel/BayesianInference.py:287` `_plot_multistart` | partial | P2, P3 |
| `nm-pareto` | Pareto front | networkmodel | — (viewer extra) | viewer-extra | P3 |
| `nm-profile` | Profile likelihood | networkmodel | `networkmodel/BayesianInference.py:575` `_plot_profile` | partial | — |
| `nm-post-trace` | Posterior trace | networkmodel | `networkmodel/BayesianInference.py:1384` `_plot_posterior (trace)` | full | — |
| `nm-post-density` | Posterior histogram | networkmodel | `networkmodel/BayesianInference.py:1384` `_plot_posterior (density = 15-bin histogram)` | full | — |
| `nm-post-ridge` | Posterior ridgeline | networkmodel | `networkmodel/BayesianInference.py:1253` `_plot_ridgeline_parameter_distributions` | full | P12 |
| `nm-post-ci` | Credible intervals | networkmodel | `networkmodel/BayesianInference.py:1384` `_plot_posterior (credible_intervals)` | full | — |
| `nm-post-predictive` | Posterior predictive bands | networkmodel | — (viewer extra) | viewer-extra | P5 |
| `nm-sensitivity` | Sensitivity (Morris) | networkmodel | `networkmodel/sensitivity.py:552` `_plot_sensitivity_indices` | full | P3 |
| `nm-steady` | Steady state | networkmodel | `networkmodel/SteadyStateAnalysis.py:124` `plot_steady_state_all` | partial | — |
| `nm-insights` | Insights | networkmodel | `networkmodel/Insights.py:129` `run_network_diagnostics / run_trajectory_feature_export` | partial | — |
| `nm-matrices` | Network matrices | networkmodel | — (viewer extra) | viewer-extra | — |

## Not found upstream (and what the viewer does)

| Expected plot | Finding | Viewer |
|---|---|---|
| Pareto front | only `export_pareto_front_to_excel` (export.py:54) | `nm-pareto`, viewer extra |
| Posterior predictive bands | `posterior_predictive.csv` holds only the scalar objective | `nm-post-predictive`, viewer extra over stored predictive samples |
| Network-matrix heatmaps | only degree histograms and correlation heatmaps | `nm-matrices`, viewer extra (Cell) |
| protwise steady-state plots | `protwise/steady` has no plotting code | none (proposal: save the data) |
| `plot_s_rates_report` (export.py:1106) | exists | not drawn: the bundle draft has no S(t) table yet (proposal) |

---

# Detailed findings (survey of the plotting code)

The section below is the full read-only survey of PhosKinTime's plotting code. It covers the data
each plot consumes and the exact constants, and it lists every place the code differs from what the
task description expected.


Source: `/home/abhinav/Documents/phoskintime-sci`, branch `sci/2026-12`, commit `e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b`.
Read-only survey. No workflows were run. Paths are relative to the repo root. Line numbers are `def` lines unless noted otherwise.

## Summary table

| panel | workflow | file:line | function | status |
|---|---|---|---|---|
| Model fit (early/late split) | protwise | protwise/plotting/plotting.py:200 | `Plotter.plot_model_fit` | found |
| Future fit (variant of model fit) | protwise | protwise/plotting/plotting.py:949 | `Plotter.plot_future_fit` | found (no callers) |
| PCA 3-D + scree | protwise | protwise/plotting/plotting.py:115, :85 | `Plotter.plot_pca`, `Plotter.pca_components` | found |
| t-SNE | protwise | protwise/plotting/plotting.py:150 | `Plotter.plot_tsne` | found |
| Parallel coordinates | protwise | protwise/plotting/plotting.py:46 | `Plotter.plot_parallel` | found |
| Knockouts | protwise | protwise/plotting/plotting.py:404 | `Plotter.plot_knockouts` | found |
| Perturbation cloud (Morris ensemble) | protwise | protwise/plotting/plotting.py:527 | `Plotter.plot_model_perturbations` (first figure) | found |
| Time x state grid | protwise | protwise/plotting/plotting.py:825 | `Plotter.plot_time_state_grid` | found |
| Phase space | protwise | protwise/plotting/plotting.py:898 | `Plotter.plot_phase_space` | found |
| Parameter pairs | protwise | protwise/plotting/plotting.py:476 | `Plotter.plot_top_param_pairs` | found |
| Sensitivity mu* bar, sigma bar, mu*-sigma scatter, radar, pie | protwise | protwise/plotting/plotting.py:527 (figures at 754-823) | `Plotter.plot_model_perturbations` | found |
| GOF (+-1.96 / +-2.576 x std) | protwise | protwise/plotting/plotting.py:312 | `Plotter.plot_gof` | found |
| KL divergence per gene | protwise | protwise/plotting/plotting.py:379 | `Plotter.plot_kld` | found |
| Regularization bar | protwise | protwise/plotting/plotting.py:1008 | `Plotter.plot_regularization` | found |
| MSE bar | protwise | protwise/plotting/plotting.py:1055 | `Plotter.plot_model_error` | found |
| Parameter profiles | protwise | protwise/plotting/plotting.py:180 | `Plotter.plot_profiles` | found (no callers) |
| protwise/steady plots | protwise | protwise/steady/*.py | - | not found (no plotting code) |
| protwise/knockout plots | protwise | protwise/knockout/helper.py | - | not found (helpers only; the plot is `plot_knockouts`) |
| GOF overall + per layer (robust sigma) | networkmodel | networkmodel/export.py:291 (inner `_plot_one` :360, `_robust_sigma` :311) | `plot_goodness_of_fit` | found |
| GOF per solution from Excel | networkmodel | networkmodel/export.py:509 | `plot_gof_from_pareto_excel` | found (no callers) |
| Per-gene time series | networkmodel | networkmodel/export.py:821 | `save_gene_timeseries_plots` | found |
| Parameter distributions (c_k box, tf_scale violin) | networkmodel | networkmodel/export.py:1658 | `export_parameter_distributions` | found |
| Parameter distributions (per group histogram) | networkmodel | networkmodel/Insights.py:391 (`_hist` :72) | `run_parameter_diagnostics` | found |
| Parameter correlations (c_k heatmap, gene-param heatmap, pairplot) | networkmodel | networkmodel/export.py:1511 | `export_param_correlations` | found |
| Kinase activity (top 10) | networkmodel | networkmodel/export.py:1441 | `export_kinase_activities` | found |
| Phosphorylation rate S(t) report (AUC bar, early/late, heatmap, small multiples) | networkmodel | networkmodel/export.py:1106 | `plot_s_rates_report` | found |
| Residuals | networkmodel | networkmodel/export.py:1593 | `export_residuals` | found |
| Convergence | networkmodel | networkmodel/export.py:1380 | `process_convergence_history` | found (no callers) |
| Pareto front | networkmodel | - | - | not found (only an Excel export, `export_pareto_front_to_excel` export.py:54) |
| Multistart | networkmodel | networkmodel/BayesianInference.py:287 | `_plot_multistart` | found |
| Profile likelihood | networkmodel | networkmodel/BayesianInference.py:575 | `_plot_profile` | found |
| Posterior trace | networkmodel | networkmodel/BayesianInference.py:1384 | `_plot_posterior` | found |
| Posterior density | networkmodel | networkmodel/BayesianInference.py:1384 | `_plot_posterior` (a histogram, not a KDE) | found |
| Posterior ridgeline | networkmodel | networkmodel/BayesianInference.py:1253 | `_plot_ridgeline_parameter_distributions` | found |
| Posterior credible intervals | networkmodel | networkmodel/BayesianInference.py:1384 | `_plot_posterior` | found |
| Posterior predictive bands | networkmodel | - | - | not found (only a CSV with the scalar objective is written) |
| Sensitivity mu* bar | networkmodel | networkmodel/sensitivity.py:552 | `_plot_sensitivity_indices` | found |
| Sensitivity perturbation cloud (quantile bands) | networkmodel | networkmodel/sensitivity.py:576 | `_plot_perturbation_cloud` | found |
| Steady state (per protein + summaries) | networkmodel | networkmodel/SteadyStateAnalysis.py:124 | `plot_steady_state_all` | found |
| Insights (network degree hists, top dynamic amplitudes) | networkmodel | networkmodel/Insights.py:129, :540 | `run_network_diagnostics`, `run_trajectory_feature_export` | found |
| Network matrices heatmap (W / kinase-site / TF) | networkmodel | - | - | not found (only correlation heatmaps and the per-protein S(t) heatmap) |
| Mode plots | networkmodel | networkmodel/mode_outputs.py:70 | `save_mode_plots` | found (called only from tests) |
| Dashboard (plotly) | networkmodel | networkmodel/dashboard_app.py:103, :124, :141, :168 | `_fig_scalar_objective`, `_fig_convergence`, `_plot_timeseries_obs_pred`, `main` | found |

Count: 38 rows found (4 of them have no callers: `plot_future_fit`, `plot_profiles`, `plot_gof_from_pareto_excel`, `process_convergence_history`; `save_mode_plots` is called only from tests). 5 rows not found: protwise/steady plots, protwise/knockout-specific plots, Pareto front, posterior predictive bands, network-matrix heatmap.

---

## Shared protwise constants (config/constants.py)

- `TIME_POINTS` (protein/phospho), lines 79-85: default `[0.0, 0.5, 0.75, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 60.0, 120.0, 240.0, 480.0, 960.0]` (14 points; config key `time.protein`).
- `TIME_POINTS_RNA`, lines 86-92: default `[4.0, 8.0, 15.0, 30.0, 60.0, 120.0, 240.0, 480.0, 960.0]` (9 points; config key `time.rna`).
- `PERTURBATIONS_TRACE_OPACITY`, line 217: `float(_plot.get("perturb_trace_opacity", 0.02))`.
- `COLOR_PALETTE`, line 219: `[mcolors.to_hex(plt.get_cmap("tab20")(i)) for i in range(0, 20, 2)]`, the 10 even-index tab20 colours (`#1f77b4, #ff7f0e, #2ca02c, #d62728, #9467bd, #8c564b, #e377c2, #7f7f7f, #bcbd22, #17becf`). Site i uses `COLOR_PALETTE[i]`. There is no wrap-around, so more than 10 sites raises an IndexError in `plot_model_fit` and `plot_model_perturbations`. `plot_time_state_grid` cycles the palette.
- `available_markers`, line 220: all matplotlib marker strings except `"."`, `","` and `" "`, in dict order.
- `model_type`, line 118: the display name of the model, used in GOF, KLD, regularization and MSE titles and file names.
- `Y_METRIC`, line 127: default `"total_signal"` (the Morris response for protwise).
- Sensitivity: `PERTURBATIONS_VALUE` (line 65, default 0.5), `NUM_TRAJECTORIES` (line 71, default 1000), `PARAMETER_SPACE` = num_levels (line 72, default 400).

All protwise figures are saved by `_save_fig` (plotting.py:38) at `dpi=300`.

---

# protwise

## Model fit
`protwise/plotting/plotting.py:200` `Plotter.plot_model_fit(model_fit, Pr_data, P_data, R_data, sol, num_psites, psite_labels, time_points)`
Caller: `protwise/paramest/core.py:148`.

Data:
- `model_fit` is the flat vector `[RNA (n_rna) | protein (n_t) | phospho (num_psites x n_t)]`. It is split by `split_flat_fit` (`protwise/models/diffrax_solver.py:162`), which returns `flat[:n_r], flat[n_r:n_r+n_t], flat[n_r+n_t:].reshape(num_psites, n_t)`.
- `sol` is the full ODE solution on `time_points`: column 0 is mRNA (R) and column 1 is protein (P).
- `Pr_data` holds the protein observations (14), `P_data` the phospho observations (num_psites x 14), and `R_data` the mRNA observations (9, plotted at `TIME_POINTS_RNA`).

Split, confirmed as index 8:
- 220: `cutoff_idx = 8`
- 221: `fig, axes = plt.subplots(1, 2, figsize=(16, 8), sharey=True)`
- The left panel uses `time_points[:cutoff_idx]`, which is 0 to 16 min by default.
- The right panel uses `time_points[cutoff_idx:]`, which is 30 to 960 min.
- mRNA observations are split at a different index, 3, not 8. Line 226 has `ax.plot(TIME_POINTS_RNA[:3], R_data[:3], ...)` on the left (4, 8, 15 min). Line 249 has `ax.plot(TIME_POINTS_RNA[3:], R_data[3:], ...)` on the right (30 to 960 min).

Styling:
- Model lines are solid: `sol[:,0]` in black at alpha 0.7, lw 1; `sol[:,1]` in red at alpha 0.7, lw 1; `P_fit[i]` in `color_palette[i]` at lw 1.
- Data are dashed `'--'` with `marker='s', markersize=5, mew=0.5`, lw 0.75. Edge colour (mec) is black for mRNA and psites and red for protein.
- Y label `"FC"`. X label `"Time (minutes)"`. X ticks are the time points, labelled `int(tp)` if tp > 1 else `tp`, at rotation 45 and fontsize 6. Grid alpha 0.05. Suptitle is the gene name at fontsize 16. The legend is on the right panel only.
- The model mRNA line is drawn from `sol` (protein time grid), not from `R_fit`. `R_fit` and `Pr_fit` are computed but unused. The protein model line is `sol[:,1]`, while the psite model lines come from `P_fit` (the split `model_fit`).

Plotly HTML twin (274-310): one unsplit figure. All traces are `lines+markers`, data dashed. Layout `plotly_white`, 900x900, y title `"Fold Changes"`. Output `{gene}_model_fit_.html`.

## Future fit (uncalled)
`protwise/plotting/plotting.py:949` `Plotter.plot_future_fit`. The same layout with `cutoff_idx = 8` (line 962). It has no callers in the repo. It plots psite model lines from `sol[:, i + 1]` (lines 973, 994). Column 1 is protein, so these are off by one compared with `plot_model_fit`. Line 991 plots `time_points[cutoff_idx:cutoff_idx + 6]`, which hard-codes 6 late points.

## PCA, scree, t-SNE, parallel coordinates
Caller: `protwise/paramest/core.py:136-145`. Each of these takes `sol_full`, the ODE solution with shape (n_timepoints = 14, n_states). Samples are time points and features are states.

- `plot_pca` (:115): `PCA(n_components=3)`, `ev = explained_variance_ratio_ * 100`. A 3-D scatter coloured by time index with `cmap='tab20'`, `edgecolor='black'`, alpha 0.7. A red "Temporal Path" at alpha 0.3 is a `CubicSpline` through the points indexed by time, evaluated on `np.linspace(0, n-1, 1000)`. Each point is labelled with its 1-based index. Axes are `PC1 (x.x%)` and so on. The colourbar is labelled "Time Index". It draws only when `components == 3`.
- `pca_components` (:85): scree plot. `PCA(n_components=min(solution.shape))`. Individual bars use `color='b'` and alpha 0.6, in %. The cumulative line is red with `marker='o'`. A green dashed vertical line marks `required_components = argmax(cumsum >= target_variance) + 1`, with `target_variance=0.99` at the call site.
- `plot_tsne` (:150): `perplexity = min(perplexity, len(solution) - 1)`, and the call site passes `perplexity=5`. `TSNE(n_components=2, perplexity=..., random_state=42)`. The scatter uses `cmap='tab20'` by index. The cubic-spline temporal path is blue at alpha 0.7, and points have 1-based labels.
- `plot_parallel` (:46): `pandas.plotting.parallel_coordinates(df, class_column='Time', colormap=tab20)`. Each time point (1..n) is one polyline across the states. Figure width is `min(max(1.2*n_states, 8), 24)` and height is 6, or 8 if there are more than 20 states. X tick labels are hidden if there are more than 40 labels; otherwise they are rotated 45 at fontsize 6. Labels come from `generate_labels(num_psites, ODE_MODEL)` (config/constants.py:274).

## Knockouts
`protwise/plotting/plotting.py:404` `Plotter.plot_knockouts(results_dict, num_psites, psite_labels)`. Caller: `protwise/paramest/core.py:198`. It produces one figure per knockout combination, with `results_dict = {'WT': (t, sol, p_fit), 'KO': (t, sol, p_fit)}`. Combinations come from `generate_knockout_combinations` and names are built in core.py:168-179 ("Transcription KO", "Translation KO", "Phospho KO", "PhosphoSite KO <sites>", joined by `_`).
- 416: a 2x2 grid with `sharex='col'`: `(ax_rp_zoom, ax_rp_full), (ax_ph_zoom, ax_ph_full)`.
- 418: `time_cutoff = 8`. The zoom column uses `t[:8]` and the full column uses `t[8:]`, so "full" is really "late".
- The top row shows mRNA (`sol[:,0]`) and protein (`sol[:,1]`). The bottom row shows phospho, `split_flat_fit(p_fit, ...)[2]`.
- Each condition takes the next marker from `available_markers`. Lines are lw 0.5 with marker size 6 and black marker edges. Colours come from the matplotlib default cycle, not the palette.
- Titles: "Transcription and Translation" and "Phosphorylation". Y label "FC". The late-panel x tick labels use `int(tp)`.

## Perturbation cloud (protwise Morris ensemble)
`protwise/plotting/plotting.py:527` `Plotter.plot_model_perturbations(problem, Si, cutoff_idx, time_points, n_sites, best_model_psite_solutions, best_mrna_solutions, best_protein_solutions, psite_labels, protein_data_ref, psite_data_ref, rna_ref, model_fit_sol)`
Caller: `protwise/sensitivity/analysis.py:283`, with `cutoff_idx = 8` (analysis.py:275).

Data selection (analysis.py):
- `morris.sample(problem, N=NUM_TRAJECTORIES, num_levels=PARAMETER_SPACE, local_optimization=True, seed=seed)` (line 188).
- Bounds come from `compute_bound` (line 28): `[v*(1-perturbation), v*(1+perturbation)]` with default perturbation 0.5.
- Each sample's RMSE against the data (lines 245-253): `diff = |pred - ref| / ref.size`, then `mse = mean(diff**2)` per layer, then `rmse = sqrt((rna_mse + psite_mse + protein_mse) / 2.0)`. The divisor is 2.0 for three terms, and each difference is also divided by the array size.
- The RNA predictions are `all_mrna_solutions[:, -len(TIME_POINTS_RNA):]`, the last 9 protein-grid points, compared against RNA data (this is P1 in KNOWN_ISSUES).
- Top `K = ceil(NUM_TRAJECTORIES * 10 / PARAMETER_SPACE)` by lowest RMSE (line 259), which is 25 with the defaults.

Figure 1 (`{gene}_sensitivity_perturbations.png`):
- Two panels split at `cutoff_idx`.
- Each ensemble trace has alpha `PERTURBATIONS_TRACE_OPACITY` (0.02) and lw 0.5. Psite traces use `COLOR_PALETTE[site]`, mRNA traces are gray and protein traces are red.
- The best-fit model (`model_fit_sol` columns 0 = R, 1 = P, 2+i = sites) is drawn at lw 1 in black, red and the palette colour.
- Data are dashed with square markers. mRNA data are again split at RNA index 3 (lines 600, 696).

## Sensitivity (protwise: mu*, sigma, mu*-sigma, radar, pie)
Same function (`plotting.py:527`). The indices come from `SALib.analyze.morris.analyze(problem, param_values, Y, num_levels=num_levels, conf_level=0.99, scaled=True, ...)` (analysis.py:226-234). `Y = _compute_Y(solution, num_psites)` (analysis.py:82), with metric `Y_METRIC`:
- `total_signal` (default): the sum of R, P and all sites over all t.
- `mean_activity`: that sum divided by `2*n_t + n_t*num_psites`.
- `variance`: a population variance over all entries.
- `dynamics`: the sum of squared successive differences.
- `l2_norm`.
- `Y` is passed through `nan_to_num(nan/inf -> 0)` (line 222).

Figures:
- 755: `ax.bar(problem['names'], Si['mu_star'], yerr=Si['mu_star_conf'], color='skyblue')`, y label "mu* (Importance)". Output `_sensitivity_bar_plot_mu.png`.
- 763: `ax.bar(problem['names'], Si['sigma'], color='orange')`, y label "σ (Standard Deviation)".
- 777: `ax.scatter(Si['mu_star'], Si['sigma'], color='green', s=100)` with parameter-name text (ha right, va bottom, fontsize 12). There are no threshold or quadrant lines.
- Radar (794-811): `angles = linspace(0, 2π, N, endpoint=False)`, closed by repeating the first value. `ax.fill(angles, mu_star, color='skyblue', alpha=0.4)` and `ax.fill(angles, sigma, color='orange', alpha=0.4)`. Raw values, with no normalisation and the radial tick labels hidden.
- Pie (818): `ax.pie(Si['mu_star'], labels=names, autopct='%1.1f%%', startangle=90, colors=plt.cm.Paired.colors)`. Shares are mu*/sum(mu*).
- Parameter names come from `get_param_names(num_psites, model)` (config/constants.py:256).

## Time x state grid
`protwise/plotting/plotting.py:825` `Plotter.plot_time_state_grid(samples, time_points, state_names)`. `samples` has shape (K best trajectories, n_t, n_states), stacked as `[mRNA, protein, sites...]` (analysis.py:269-273).
- 837: only states whose name matches `re.fullmatch(r"[A-Za-z][0-9]?$", name)` are kept. That is one letter plus an optional single digit, so it drops site names such as "P10" or "Y1045" (S1 to S9 pass).
- 868-883: `sns.catplot(kind="strip", x="Time", y="Value", hue="State", col="State", col_wrap=4, height=3, sharey=False, alpha=0.3, jitter=0.2, size=2)`. Time is categorical in order (labels `int(t)` if t > 1 else `t`). Palette is `COLOR_PALETTE` cycled.

## Phase space
`protwise/plotting/plotting.py:898` `Plotter.plot_phase_space(samples, state_names)`. It applies the same name regex filter (912), then draws one figure per state pair (`combinations`). Each simulation is a line of state_i against state_j, with `alpha=0.5, lw=0.5`, coloured by `cm.get_cmap("tab20", n_samples)(sim)`. Grid alpha 0.05. Output `{gene}_sensitivity_phase_space_{x}_vs_{y}.png`.

## Parameter pairs
`protwise/plotting/plotting.py:476` `Plotter.plot_top_param_pairs(excel_path)`. Caller: `protwise/runner/main.py:264`.
- It reads every `*_perturbations` sheet (written by `common/utils/display.py:201`). Columns are parameter values followed by a MultiIndex (time, state) block and `RMSE`.
- Parameter columns are those that are strings, not "RMSE", do not start with "(", and match `re.fullmatch(r"[A-Za-z]\d?$", col)` (line 497).
- `df_clean = df[param_cols].dropna().drop_duplicates()`, then `corr = df_clean.corr().abs()`, which is Pearson.
- Every pair is plotted (despite "top", there is no ranking or cutoff). `sns.regplot(..., scatter_kws={'alpha':0.7,'s':10}, line_kws={'color':'red','alpha':0.5}, ci=95)`. The title is `"{gene}: {a} vs {b}\nCorrelation = {|r|:.2f}"`.

## GOF (protwise)
`protwise/plotting/plotting.py:312` `Plotter.plot_gof(merged_data)`. Caller: `protwise/runner/main.py:262`. `merged_data` comes from `merge_obs_est` (`common/utils/display.py:52`): one row per (Gene, Psite) with columns `x1_obs..x14_obs` and `x1_est..x14_est`. The 1..14 range is hard-coded in the column slice.

Band formula, confirmed:
- 319: `overall_std = merged_data.loc[:, 'x1_obs':'x14_obs'].values.std()`
- 320: `ci_offset_95 = 1.96 * overall_std`
- 321: `ci_offset_99 = 2.576 * overall_std`
- This is `numpy.ndarray.std()`, so ddof = 0 (population). It runs over the flattened matrix of all observed values: every gene, psite and time point together. It is the std of the observations, not of the residuals, and it is not centred per gene.

Drawing:
- Points are scattered with `color=gene_color_map[gene]` from `sns.color_palette("husl", n_unique_genes)`, `edgecolor='black'`, `s=100`, alpha 0.5.
- Lines run from `min_val` to `max_val`, the minimum and maximum over obs and est together. The identity line is gray and solid, lw 1.5. The ±95% lines are red dashed, lw 1 (label "95% CI"). The ±99% lines are gray dashed, lw 1 (label "99% CI").
- A gene is labelled once, the first time one of its points falls outside ±ci_offset_95 (`est > obs + d95 or est < obs - d95`, line 341). Labels are spread with `adjust_text`.
- Axis limits are each axis's own min and max ±10% of range.
- X "Observed", Y "Fitted". Title `"{model_type} Model"`.

## KL divergence per gene
`protwise/plotting/plotting.py:379` `Plotter.plot_kld(merged_data)`. Caller: `main.py:263`.
- 388: `normalized_obs = obs_data.div(obs_data.sum(axis=1), axis=0)`. Row normalisation: each (gene, psite) row of the 14 time points is divided by its row sum. The same is done for est (389).
- 390: `kl_div = normalized_obs.apply(lambda row: entropy(row, normalized_est.loc[row.name]), axis=1)`. This is `scipy.stats.entropy(pk, qk)` with no `base`, so the natural log (nats). It computes KL(obs || est), and scipy renormalises pk and qk again internally.
- 393: `kl_by_gene = kl_df.groupby('Gene')['KL'].mean().sort_values()`, the mean over a gene's psites, sorted ascending.
- 396: `colors = ['lightcoral' if val > 0.03 else 'dodgerblue' ...]`. The threshold 0.03 is confirmed and is strictly greater-than. The chart is horizontal bars with x "KL Divergence" and y "Protein".

## Regularization bar
`protwise/plotting/plotting.py:1008` `Plotter.plot_regularization(excel_path)`. It reads `*_params` sheets, takes the gene name as `sheet[:-7]` (sheet names are the gene truncated to 25 characters, display.py:106), and uses `df['Regularization'].iloc[0]`.
- Sorted descending.
- `barh(..., color='skyblue', edgecolor='black', height=0.6)`. Figure height is `max(8, 0.5*n_genes)`. Each bar is labelled with its value, `f"{v:.2f}"`, at x = v + 1% of the maximum.
- The title formula is `R = (λ_reg/m) Σ p_j²` ("Tikhnov" is misspelled in the source).

## MSE bar
`protwise/plotting/plotting.py:1055` `Plotter.plot_model_error(excel_path)`. The docstring says RMSE, but the code reads column `'MSE'` (`.iloc[0]`), which `display.py:112` fills from `res["errors"]`.
- Bars are `color='coral'`, with the other styling as for the regularization chart.
- The title formula is `MSE = (1/n) Σ (y_i - ŷ_i)²`.

## Parameter profiles (uncalled)
`protwise/plotting/plotting.py:180` `Plotter.plot_profiles(data)`. It draws each non-"Time" column against `data["Time"]` with `marker='o'`, x "Time (min)" and y "Kinetic Rates". There are no callers in protwise. A different `plot_profiles` in `scripts/figures/egfr_cbc2026/run_egfr_inference.py:184` is unrelated.

## protwise/steady, protwise/knockout
Not found. A grep for `plt.|savefig|sns.|add_trace|plot` in `protwise/steady/*.py` and `protwise/knockout/helper.py` returns no plotting code. The steady modules only set up initial conditions.

---

# networkmodel

## Parameter groups (networkmodel)
- Layout, from `networkmodel/params.py:32`: `for k in ["A_i", "B_i", "C_i", "D_i", "E_i", "c_k", "tf_scale", "Dp_i"]`. This sets the slice order in raw theta. `"alpha"`/`"beta"` are explicitly forbidden in theta (params.py:63).
- All groups are stored raw and mapped through `softplus` in `unpack_params` (params.py:69-87). `tf_scale` is a scalar (`softplus(...)[0]`).
- Sizes: `A_i, B_i, C_i, D_i, E_i` have one value per protein (`idx.proteins`). `c_k` has one per kinase (`idx.kinases`). `Dp_i` has one per phosphosite (`idx.total_sites`, ordered by protein then `idx.sites[i]`). `tf_scale` has 1.
- Name strings: `build_parameter_names` (Insights.py:301) and `_build_parameter_names` (PosteriorObjective.py:51) produce `c_k[<kinase>]`, `Dp_i[<protein>_<site>]`, `tf_scale` and `<group>[<protein>]`. These are the names in posterior and profile CSVs. Insights' physical table uses `parameter_group`, `entity_type` (kinase, phosphosite, global, protein) and `entity` (`protein:site` for Dp_i) (Insights.py:319-348).
- Physical bounds come from `BOUNDS_CONFIG` (`networkmodel/config.py:55`) or `custom_bounds`, converted with `inv_softplus`.
- Units: none are declared anywhere. A grep for `unit`, `1/min` and `min^-1` in networkmodel/ and config.toml finds no unit metadata. The only unit-like strings are axis labels such as "Time (min)", "Conc (a.u.)" and "Activity (a.u.) = Abundance × c_k".
- The meanings are inconsistent across the code (KNOWN_ISSUES N8):
  - `runner.py:1634-1640` labels E_i "Initial Condition Multipliers (E)" and A_i "Transcription Rates".
  - `runner.py:1652` labels Dp "De-phosphorylation Rates (Dp)".
  - `export.py:734-742` uses "Synthesis_A", "mRNA_Degradation_B", "Translation_C", "Protein_Degradation_D", "Phospho_Degradation_Dp_*", "De-Phosphorylation_E" and "Global_TF_Scale".
  - `export.py:1560-1564` uses "Synthesis (A)", "RNA Decay (B)", "Translation (C)", "Prot Decay (D)" and "Dephos (E)".
  - Per N8, the RHS uses E_i as protein-level dephosphorylation and Dp_i as per-site decay.
  - **The viewer must not hard-code meanings. It should display the group names as they are and take labels from the data.**

## Fold-change baseline (N7)
- `networkmodel/simulate.py:75` `measure_trajectory`:
  - 81-82: `_bidx(t0) = argmin |times - t0|`.
  - 84-86: `prot_b = _bidx(0.0)`, `rna_b = _bidx(4.0)`, `pho_b = _bidx(0.0)`.
  - RNA: `fc_r = max(R,1e-12) / max(R[rna_b],1e-12)`.
  - Protein: total = P0 + Σ sites (standard models) or Σ of all states (MODEL 2), divided by the total at t≈0.
  - Phospho, per site: `sig / sig[pho_b]`. For MODEL 2 the site signal is the bit-masked sum of states.
  - All are clamped at 1e-12.
- The same base indices are set for the loss in `runner.py:920-922` (`loss_data["prot_base_idx"] = _base_idx(solver_times, 0.0)`, rna 4.0, pho 0.0) and in `PosteriorObjective.py:281-283`.
- The observed data are not rescaled to 1 at these baselines, which is the N7 issue.

## GOF overall and per layer
`networkmodel/export.py:291` `plot_goodness_of_fit(df_prot_obs, df_prot_pred, df_rna_obs, df_rna_pred, df_phos_obs, df_phos_pred, output_dir, file_prefix="")`. Caller: `runner.py:1550`.
- Merge (472-484): inner joins on `[protein, time]` (protein, RNA) and `[protein, psite, time]` (phospho), standardised to `fc_obs` and `fc_pred`. Each row is tagged with `Type` ∈ {Protein, RNA, Phosphorylation}, then `dropna`.
- It draws an overall plot (`goodness_of_fit.png`) and one per Type (`goodness_of_fit_{Type}.png`). σ is recomputed for each subset.

`_robust_sigma` (311-331), confirmed:
```
321 r = np.asarray(residuals, dtype=float)
322 r = r[np.isfinite(r)]
323 if r.size < 10:
324     s = float(np.std(r))          # ddof=0
325     return s if s > 0 else 1e-12
326 med = np.median(r)
327 mad = np.median(np.abs(r - med))
328 s = 1.4826 * mad
329 if s <= 0:
330     s = float(np.std(r))          # second fallback when MAD == 0
```
- Residuals are `resid = fc_pred - fc_obs` (line 395).
- The MAD is taken of the residuals, centred on the median residual.
- The fallback (`np.std`, ddof 0, centred on the mean) applies when there are fewer than 10 finite residuals, and also when the MAD is 0.
- σ floors at 1e-12.

Bands:
- 398 `z95 = 1.959963984540054`
- 399 `z99 = 2.5758293035489004`
- `d = z*sigma`.
- The ±d95 lines are gray `--` (lw 1.2, alpha 0.8, "95% band"). The ±d99 lines are gray `:` ("99% band").
- Lines run over `[xmin, xmax]`, the minimum and maximum of obs ∪ pred.
- The identity line is `"k--"`, alpha 0.5, lw 1.5.

Metrics:
- 414-415: `slope, intercept, r_value, ... = linregress(x, y); r2 = r_value ** 2`. **R² is the squared Pearson correlation of the OLS regression, not 1 - SSres/SStot.**
- 416: `rmse = sqrt(mean((y - x)**2))`, the RMSE about the identity line.
- The text box shows `R²`, `RMSE` and `σ_Δ`.

Points:
- Protein `#2E86AB` "o", RNA `#A23B72` "s", Phosphorylation `#F18F01` "^". s = 50, alpha 0.6, black edges at 0.5.
- Labels:
  - Points outside the band (`|resid| >= d95`) get up to 25 labels.
  - Points near the band (`0.9*d95 <= |resid| < d95`, with `border_frac = 0.10`) get up to 15 labels.
  - In each group the most extreme point comes first and each label appears once.
  - The label is `protein|psite` for phospho and `protein` otherwise.
- `set_aspect("equal")`. Title `"Goodness of Fit: Global ODE Model (Overall)"` or `"... (Protein)"`, etc.

`plot_gof_from_pareto_excel` (export.py:509) calls this function for each `sol_id` in an Excel workbook, with prefix `sol_{sid}_`. It has no callers.

## Per-gene time series
`networkmodel/export.py:821` `save_gene_timeseries_plots(gene, ..., prot_times, rna_times, phos_times, filename_prefix="ts", phos_mode="per_psite", max_psites=None)`. Caller: `runner.py:1555`, with `prot_times=args.time_points_protein`, `rna_times=args.time_points_rna` and `filename_prefix="fit"`; phos_times is not passed.
- Three panels, `sharey=True` (Protein, mRNA, Phosphorylation). X "Time", linear. Y "FC".
- Observations: `marker="s"`, lw 1, alpha 0.35, colour lightened with `_lighten(c, 0.65)`, which gives `(1-a)*rgb + a`.
- Predictions: lw 2, alpha 1.0.
- Colours: protein `C0`, RNA `C1`, phospho `C2` (mean mode).
- In per-psite mode the colour is `f"C{hash(ps) % 10}"` (line 1006). Python string hashing is salted per process, so **psite colours are not reproducible between runs**.
- The `max_psites` cap is commented out.

## Parameter distributions
`networkmodel/export.py:1658` `export_parameter_distributions(res, slices, idx, output_dir)`. Caller: `runner.py:1482`.
- `X_kin = _physical_rows(X, slices, "c_k")` holds the softplus physical values for every row of `res.X` (all solutions).
- `sns.boxplot` per kinase, sorted by median descending, colour lightblue. Y "Activity Multiplier (c_k)".
- `tf_scale` is shown as `sns.violinplot`, colour lightgreen.

There are also per-group histograms in `networkmodel/Insights.py:391` `run_parameter_diagnostics` → `_hist` (Insights.py:72). Bins are `min(30, max(5, int(sqrt(n))))`, dpi 180, and there is one figure `parameter_distribution_{group}.png` per `parameter_group`, using physical values from the picked solution.

## Parameter correlations
`networkmodel/export.py:1511` `export_param_correlations(res, slices, idx, output_dir, best_idx=None)`. Caller: `runner.py:1474` (`best_idx=I`).
- c_k across solutions: `df_kin.corr()`, which is Pearson. `sns.heatmap(cmap="RdBu_r", center=0, vmin=-1, vmax=1, square=True)`. Output `correlation_kinases_pareto.png`.
- Gene parameters (A to E of a single solution, `best_idx`) are correlated across proteins: `sns.heatmap(cmap="viridis", annot=True, fmt=".2f", square=True)`. Output `correlation_gene_params.png`.
- `sns.pairplot(df_genes, kind="reg", line red, scatter alpha 0.1)`. Output `distribution_gene_params.png`.

## Kinase activity (N17)
Export: `networkmodel/export.py:1441` `export_kinase_activities(sys, idx, output_dir, t_max=120, n_points=121)`. Caller: `runner.py:1470` (`t_max=120`).
- 1452: `t_grid = np.linspace(0, t_max, n_points)`
- 1455-1456: `orig_t = sys.kin.grid`, `orig_K = sys.kin.Kmat`
- 1465: `interp_func = interp1d(orig_t, base_profile, kind='linear', fill_value="extrapolate")`
- 1470-1471: `act_trace = smooth_profile * sys.c_k[k_idx]`
- 1488-1489: `auc = df_act.drop("time", axis=1).sum(); top_k = auc.nlargest(10).index`. The "AUC" is a plain sum over the uniform grid, not a trapezoid.
- Y label "Activity (a.u.) = Abundance × c_k". Saved at dpi 100. The CSV is `kinase_activities_dynamic.csv`.

RHS: `networkmodel/backend.py:291` `rhs(t, y, args)`:
```
293 def _stepwise(row):
294     idx = jnp.searchsorted(kin_grid, t, side="right") - 1
295     idx = jnp.clip(idx, 0, kin_grid.shape[0] - 1)
296     return row[idx]
298 K_raw = jax.vmap(_stepwise)(kin_Kmat)
299 Kt = K_raw * par["c_k"]
300 S_all = W @ Kt
```
- This is piecewise-constant and right-continuous: the value at grid[j] holds on [grid[j], grid[j+1]). Before grid[0] it is clamped to the first value, and after the last point to the last value.
- `kin_grid`/`kin_Kmat` come from `sys.kin.grid`/`sys.kin.Kmat` (backend.py:246-247).
- `KinaseInput.grid = TIME_POINTS_PROTEIN` (network.py:193). Kmat defaults to ones and is filled from the data with `max(fc, 1e-6)` (network.py:203).
- `KinaseInput.eval` (network.py:205), used by the steady-state summaries, is the same step function.
- `export_S_rates` (export.py:1034) writes S = W·(Kmat ⊙ c_k) at the grid nodes only, so it matches the RHS at the nodes.
- To match the RHS, the viewer should draw kinase activity as a step function on `sys.kin.grid`, not as a linear interpolation.

## Phosphorylation-rate report S(t)
`networkmodel/export.py:1106` `plot_s_rates_report(csv_path, out_pdf, log_x=True, top_k_sites_per_protein=24, max_sites_per_page=12, ncols=3, normalize_per_site=False, heatmap_per_protein=True, heatmap_cap_sites=80, agg_duplicates="mean")`. Caller: `runner.py:1492`, with exactly these arguments.

Data: `S_rates_picked.csv` (long format: protein, psite, time, S). S = W·(K ⊙ c_k) at the kinase grid nodes (export.py:1054-1068).

Pages of the PDF:
1. Top `min(30, n)` sites by AUC, `np.trapezoid(S, t)` (1183), as a horizontal bar chart.
2. Early-against-late scatter. Early is the mean S for t ≤ 2.0 and late is the mean S for t ≥ 120.0 (1209-1210), with a dashed identity line.
3. For each protein:
   - A heatmap of sites × times: `imshow(aspect="auto", interpolation="nearest")` with the default viridis colormap, rows ranked by AUC and capped at 80.
   - Small multiples, 3 columns and 12 per page, top 24 sites. X scale is `symlog` if any t == 0, otherwise log (1230).

## Residuals
`networkmodel/export.py:1593` `export_residuals(sys, idx, df_prot, df_rna, df_phos, output_dir)`. Caller: `runner.py:1478`.
- It re-simulates at the unique data times.
- `residual = pred_fc - fc` (1631).
- Three panels (Protein, RNA, Phospho) of residual against time (`sns.scatterplot`, alpha 0.5), with a red dashed line at y = 0.
- Text: `Bias = mean(residual)` and `RMSE = sqrt(mean(residual²))`.
- Output `residuals_analysis.png` and `residuals_table.csv`.

## Convergence
`networkmodel/export.py:1380` `process_convergence_history(res, output_dir)`. **No callers in the repo**; it is only mentioned in a dashboard comment.
- For each generation it takes the minimum feasible F per objective. Columns are hard-coded as `["min_prot_mse","min_rna_mse","min_phos_mse"]`, which fails for the current scalar F.
- The plot has three lines and `plt.yscale("log")`.
- Dashboard counterpart: `networkmodel/dashboard_app.py:124` `_fig_convergence`, which is `px.line` of a user-selected numeric column against the index.

## Pareto front
Not found. I searched `pareto` with `plot|scatter|savefig|fig` in networkmodel/*.py. There is only `export_pareto_front_to_excel` (export.py:54), which writes the sheets summary, params_genes, deg_sites, params_kinases and traj_* with a `scalar_score` dense rank. The closest plot is `networkmodel/dashboard_app.py:103` `_fig_scalar_objective`, a `px.scatter` of `scalar_objective` against solution index with the picked index marked at size 12.

## Multistart
`networkmodel/BayesianInference.py:287` `_plot_multistart(summary, params, names, plot_dir)`. Caller: `run_multistart` (:283), which `runner.py:1162` calls.
- `objective_distribution.png`: a histogram of finite `final_objective`, `bins=max(1, min(10, n))`.
- `ranked_objective.png`: sorted objective against rank, `marker="o"`.
- `parameter_objective_tradeoff.png`: the first parameter of successful starts against the objective. The rows are aligned by position (`finite.sort_values("start_id")...[:len(good)]`), not joined on `start_id`.

## Profile likelihood
`networkmodel/BayesianInference.py:575` `_plot_profile(df, path)`. Callers: `run_profile_likelihood` (:564) and `run_profile_likelihood_standalone_processes` (:454). The runner uses the standalone version (runner.py:1219).
- The grid is `np.linspace(lower_eff[idx], upper_eff[idx], grid_size)` in **raw softplus space** (:527).
- `delta_objective = objective_value - min(finite objective_value)` (:556). This is an objective (MSE) difference, not -2 log L (N13).
- The plot has the objective on the left axis (marker o) and the delta on a `twinx` right axis (`tab:orange`, marker x). No χ² threshold line is drawn.

## Posterior (trace, density, ridgeline, credible intervals, predictive)
Summary rows (BayesianInference.py:870-874, repeated at 893-897 for raw and 1151-1155 for standalone):
- `mean`
- `median`
- `sd = vals.std(ddof=0)`
- `ci_05 = np.quantile(vals, 0.05)`
- `ci_95 = np.quantile(vals, 0.95)`

These are a **90% equal-tailed interval**. `ess = len(vals)` and `r_hat = NaN` are placeholders.

`networkmodel/BayesianInference.py:1384` `_plot_posterior(samples, summary, plot_dir)`:
- Trace: `ax.plot(values)` per parameter against the sample index (chains are concatenated and not coloured separately). Output `density/trace_{col}.png`.
- "Density": `ax.hist(values, bins=15)` with y label "frequency". This is a histogram, not a KDE.
- Credible intervals: `errorbar(x, median, yerr=[median-ci_05, ci_95-median], fmt="o", capsize=4)`, y label "posterior median and 90% interval". Output `credible_intervals.png`. It includes `sigma`.

`networkmodel/BayesianInference.py:1253` `_plot_ridgeline_parameter_distributions(..., max_params_per_fig=25, include_sigma=False)`:
- The KDE is `_smooth_density_1d` (:1208), a Gaussian with Silverman bandwidth `1.06 * sd(ddof=1) * n^(-1/5)`, floored at `max(span/200, 1e-8)`. The grid has 256 points over [min - 0.1·span, max + 0.1·span]. The density is normalised to a peak of 1.
- Each parameter's x is normalised to `(x - vmin)/(vmax - vmin)` and clipped to [0, 1]. Ridge height is 0.75 and the fill alpha is 0.55.
- The quantile bar is `np.quantile(values, [0.05, 0.5, 0.95])` (:1335), with "median=..." text at x = 1.03. Xlim is (0, 1.22).
- Batches of 25 go to `ridge/posterior_ridge_{batch:03d}.png`.

Predictive bands: **not found**. `posterior_predictive.csv` holds only `scalar_objective` and `data_mode` (and `chain`) (:909, :1166). No predictive trajectories or quantile bands are computed or plotted.

## Sensitivity (networkmodel)
`networkmodel/sensitivity.py:345` `run_sensitivity_analysis(sys, idx, fitted_params, output_dir, metric="l2_norm", seed=None)`. Caller: runner.py, with `seed=args.seed`.
- `morris.sample(N=SENSITIVITY_TRAJECTORIES (1000), num_levels=SENSITIVITY_LEVELS (400), local_optimization=True, seed=seed)`.
- `analyze(..., conf_level=0.95)`. The default `scaled=False` applies, unlike protwise (0.99, scaled=True).
- Bounds come from `compute_bounds` (:69), with perturbation `SENSITIVITY_PERTURBATION` default 0.2.
- The response comes from `_compute_scalar_metric` (:194). It concatenates all predicted FC values and applies one of `total_signal`, `absolute_total_signal`, `mean`, `absolute_mean`, `variance` (np.var, ddof 0), `l2_norm` or `max_abs`.
- `_plot_sensitivity_indices` (:552): the top 30 by mu_star as horizontal bars (ascending). There are no error bars, although `mu_star_conf` is in the CSV.

`_plot_perturbation_cloud` (:576), for top_n_proteins = 40 and top_k_sites = 6:
- Trajectories are the top `SENSITIVITY_TOP_CURVES` (50) by **largest response `y_val`** (`_select_top_trajectories`, :302). This differs from protwise, which takes the lowest RMSE.
- Proteins are ranked by the maximum over t of the std across simulations (pandas std, ddof 1), taking the larger of protein and RNA.
- `_summarize_band`: quantiles `[0.01, 0.05, 0.5, 0.95, 0.99]`. The outer fill is q01-q99 at alpha 0.12 and the inner fill q05-q95 at alpha 0.18. The median is drawn at lw 2.
- Spaghetti lines have alpha 0.03 and lw 1.
- The phospho panel shows the sum over psites per (sim, t), plus median lines for the 6 most variable sites.
- Output `sensitivity_perturbations/cloud_{protein}.png`.

## Steady state
`networkmodel/SteadyStateAnalysis.py:124` `plot_steady_state_all(t, Y, sys, idx, output_dir, pinn_config=None)`. Caller: `runner.py:1593`.
- Time comes from `simulate_until_steady` (:34): `t = [0] + logspace(log10(1e-3), log10(t_max), n_points-1)` with n_points = 1000. The runner sets `t_max = 24*14*60` (14 days).
- Per protein there are three panels: RNA `#1f77b4`, total protein `#2ca02c`, and phospho (total `#d62728` plus dashed per-site lines at alpha 0.6).
- If `t[-1] > 100` the x axis is `symlog` with `linthresh=10.0`. Y "Conc (a.u.)".
- The per-protein panels use the standard state layout (`st+1` unphosphorylated, `st+2 ... st+2+ns` sites) even when MODEL == 2 (combinatorial), so those panels are wrong in that mode.

Summaries:
- `|dy/dt|` histogram (100 bins). It uses `sys.rhs`, the legacy numba RHS that differs from the JAX one (N10), or a finite difference for pure NeuralODE.
- Top 50 phospho fraction, `Pph/(Ptot+1e-12)`.
- Top 30 kinases by drive, `Σ W_ik·Kt_k`.
- Top 30 by dominant-site count.
- Kt against drive scatter. The union of the top 15 by drive, the top 15 by Kt and the top 10 by mismatch `Kt/(drive+eps)` (with Kt > 1e-6) is labelled.
- S_all histogram (100 bins).
- `Kt = sys.kin.eval(t_last) * sys.c_k`, a step function.

## Insights
`networkmodel/Insights.py`:
- `run_network_diagnostics` (:129) is called by runner.py:825. It draws `site_indegree_hist.png` (upstream kinases per site, the number of non-zeros in each W row) and `kinase_outdegree_hist.png` (the number of non-zeros in each W column), using `_hist` with bins `min(30, max(5, int(sqrt(n))))`.
- `run_parameter_diagnostics` (:391) draws per-group histograms (see Parameter distributions).
- `run_trajectory_feature_export` (:540) draws `top_{layer}_amplitudes.png` with `_barh_top` (:85), top 30 by `amplitude = max - min`. The features are computed in `_trajectory_feature_row` (:464): baseline = y[0], final, min, max, amplitude, auc (trapezoid), auc_centered, time_to_peak, time_to_min, max_abs_slope, net_change, final_over_baseline, recovery_fraction, monotonicity, n_direction_changes, and response_class (induced, repressed or flat, with flat when `|dominant| < 1e-8`).
- `run_model_insights` (:602) is an orchestrator.

## Network matrices heatmap
Not found. I grepped for `heatmap|imshow|.spy(|pcolormesh|matshow` in networkmodel/ and protwise/. The only heatmaps are the c_k and gene-parameter correlation heatmaps (export.py:1533, :1573) and the per-protein S(t) heatmap (export.py:1310). W, TF and the kinase-site matrices are summarised only as degree histograms (Insights) and CSVs. `scripts/figures/egfr_cbc2026/reproduce_poster_plots.py:232` `drive_heatmap` is a script outside the workflow.

---

# Appendix: unlisted plotting functions

| file:line | function | what |
|---|---|---|
| protwise/plotting/plotting.py:38 | `Plotter._save_fig` | savefig dpi 300 + close |
| networkmodel/export.py:883 | `save_gene_timeseries_plots._lighten` | colour helper |
| networkmodel/mode_outputs.py:70 | `save_mode_plots` | 4x3 `{layer}_prediction.png`, pred_fc against time as a single line with marker o (tests only) |
| networkmodel/dashboard_app.py:103 | `_fig_scalar_objective` | plotly scatter of objective against solution index, picked marker |
| networkmodel/dashboard_app.py:124 | `_fig_convergence` | plotly line |
| networkmodel/dashboard_app.py:141 | `_plot_timeseries_obs_pred` | plotly obs (markers+lines) and pred (lines) |
| networkmodel/dashboard_app.py:168 | `main` | Frechet line (:307), weight histograms `px.histogram(x="Weight")` (:417, :427) |
| networkmodel/pinn/diagnostics.py:36 | `_write_hist` | bins `min(60, max(10, sqrt n))`, dpi 180 |
| networkmodel/pinn/diagnostics.py:50 | `_write_barh_top` | top 40 horizontal bars |
| networkmodel/pinn/diagnostics.py:74 | `write_pinn_parameter_reports` | PINN parameter histograms (values, abs, delta) and top-abs horizontal bars (:259-286) |
| networkpruning/plotting.py:16 | `plot_preprocessing_result` | hyperedge score histogram, retained/removed bars, kinase degree histogram, sparse tensor bars |
| dashboard/components/plot_viewer.py, dashboard/workflow_panels/*.py | - | `st.image` of the saved PNGs only, no plotting |
| scripts/analysis/export_subnetworks.py:147 | `save_subnetwork_png` | subnetwork drawing |
| scripts/analysis/temporal_sensitivity.py:192 | `plot_temporal_heatmap` | heatmap |
| scripts/figures/egfr_cbc2026/egfr_forward_ensemble_72h.py:142 | `plot_ensemble` | |
| scripts/figures/egfr_cbc2026/phoskintime_dynestyx_smoothing.py:538 | `plot_uncertainty_overlay` | |
| scripts/figures/egfr_cbc2026/phoskintime_dynestyx_smoothing_all_egfr_stiff.py:610 | `plot_uncertainty_overlay` | |
| scripts/figures/egfr_cbc2026/phoskintime_phase_portraits_72h.py:340, :368, :375, :384 | `set_plot_style`, `panels`, `save_figure`, `phase_axes` | |
| scripts/figures/egfr_cbc2026/phoskintime_upstream_flux_from_phase.py:139, :158 | `_style`, `_draw_plots` | |
| scripts/figures/egfr_cbc2026/reproduce_poster_plots.py:66, :94, :132, :176, :212, :232, :262, :280, :330, :433, :494 | `save`, `egfr_timeseries`, `goodness_of_fit`, `residuals`, `multistart`, `drive_heatmap`, `kinase_scatter`, `contributions`, `network_biology`, `posterior`, `steady_state.rhs` | poster reproductions |
| scripts/figures/egfr_cbc2026/run_egfr_inference.py:184, :232 | `plot_profiles`, `summarize_posterior` | |
| scripts/legacy/compare_mechanisms.py:897, :1518, :2464, :3702, :3796, :3953, :4053 | `_scale_site_param_by_protein`, `_picked_points_on_displayed_curve`, `_plotly_network_from_edges`, `_plotly_animated_network`, `_node_trace_for_frame`, `_export_network_animation_matplotlib._segments_for_type`, `._update` | legacy script with a lot of module-level plotting |

`config/constants.py:181` `validate_ode_inputs` matched the grep only because it uses `plt` for the colormap; it does not plot. `networkmodel/export.py:12` imports `matplotlib.animation`, but nothing uses it.

---

# Discrepancies against the expected details

1. **protwise GOF std**: ddof = 0, computed over all observed values (every gene, psite and time point) flattened. It is not a residual std and not per gene (plotting.py:319).
2. **networkmodel R²** is `linregress(x, y).rvalue**2`, the squared correlation, not 1 - SSres/SStot (export.py:414-415). RMSE is about the identity line, as expected.
3. **networkmodel robust σ**: the MAD is taken of the residuals (`pred - obs`), median-centred. The `np.std` fallback (ddof 0) also applies when the MAD is 0, not only when there are fewer than 10 residuals. σ is recomputed for each layer subset.
4. **Model-fit split**: protein and phospho split at index 8 (t < 30 against t ≥ 30), but mRNA observations split at RNA index 3. With the default grids both splits fall at the 16/30 or 15/30 boundary. Knockouts also use 8. The protwise Morris RMSE divides by 2.0 for three terms.
5. **"Density"** in the posterior plots is a 15-bin histogram. The KDE exists only in the ridgeline.
6. **Credible intervals** are 5%/95% (90%), not 2.5%/97.5%.
7. **Posterior predictive bands do not exist.** Only the networkmodel sensitivity cloud has bands (1/5/50/95/99%).
8. **Pareto-front and network-matrix plots do not exist.** `process_convergence_history`, `plot_gof_from_pareto_excel`, `plot_profiles` and `plot_future_fit` exist but are never called. `plot_future_fit` has an off-by-one in the psite column.
9. **N19 is stale**: `run_sensitivity_analysis` now takes `seed`, and the runner passes `args.seed`. It falls back to `SEED` only when `seed` is None (sensitivity.py:354).
10. **N17 is confirmed**: the export uses linear interpolation with `fill_value="extrapolate"` on `t ∈ linspace(0, 120, 121)`. The RHS and the steady state use a right-continuous step (`searchsorted(side="right") - 1`, clipped). The kinase "AUC" ranking is a plain sum.
11. **Selection differs between workflows**: the networkmodel perturbation cloud keeps the top 50 by largest response `y_val`, while protwise keeps the top K = 25 by lowest RMSE.
12. **Colour stability**: networkmodel per-psite time-series colours use `hash(psite) % 10`, so they change between runs. protwise indexes `COLOR_PALETTE[i]` with no wrap, so more than 10 sites fails.
13. **No parameter units are declared anywhere**, and the labels for E_i and Dp_i contradict each other across runner, export and the RHS (N8).
