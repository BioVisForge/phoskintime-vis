# Substitutions and deliberate differences

Where the viewer does not draw exactly what PhosKinTime draws, the reason is recorded here.
Numbers are always computed with PhosKinTime's formulas (see `tests/parity/`). Only the visual
form changes, or the data the bundle can supply.

## Chart types replaced by honest equivalents

| PhosKinTime | Viewer | Why |
|---|---|---|
| Sensitivity **radar** (`plot_model_perturbations`, plotting.py:794-811 @ e634e17): μ* and σ as filled polygons on angular axes | μ* and σ as two dots per parameter on one linear axis, joined by a rule | A radar's area depends on the arbitrary order of the axes and exaggerates large values quadratically. A shared linear axis shows the same two numbers without that distortion. |
| Sensitivity **pie** (plotting.py:818): μ* shares with `autopct` | Sorted bars of μ* as % of Σμ* | Angles are hard to compare. Sorted bars show the same shares, with an axis. |
| protwise **time × state strip grid** (`plot_time_state_grid`, plotting.py:825) | One Tukey box per time point and state (P2), with every sample overlaid when n < 30 | It shows the spread across perturbation samples directly. The strip plot's jitter hides the quantiles. The regex filter `[A-Za-z][0-9]?$` that drops sites like `Y1045` is **not** applied, so all states are shown. |
| protwise **3-D PCA with a cubic-spline path** (`plot_pca`, plotting.py:115) | PC1 vs PC2 with straight segments and finite-difference arrows (P11) | A spline through 14 stored time points invents intermediate states. 3-D views cannot be read in a static export. The scree plot is not drawn: the bundle stores coordinates, not the variance spectrum (proposal). |
| t-SNE spline path | straight segments plus arrows | Same reason: no invented intermediate states. |
| Parallel coordinates with vertical axes (`pandas.plotting.parallel_coordinates`) | Horizontal axes (SveltePlot `normalizeParallelX`), raw values by default | Rotated layout only. Values and polylines are the same. |
| Knockout 2 × 2 zoom/late grid (`plot_knockouts`) | One plot per knockout and state, wild type vs knockout with the signed difference shaded (P5), symlog time axis | The difference between conditions is what the plot is read for. Both curves are model outputs on the same grid, so the shaded area interpolates nothing. |

## Differences forced by the data in the bundle

| Plot | Difference |
|---|---|
| Parameter correlations, `export_param_correlations` | PhosKinTime correlates c_k **across Pareto solutions**. The draft bundle has no per-solution parameter vectors, so the viewer correlates **across posterior draws** (marked *substituted*). Proposal: export Pareto parameter vectors. |
| Parameter distributions, `export_parameter_distributions` | The c_k box plot across Pareto solutions is not drawn (same data gap). The per-group histograms of `Insights.run_parameter_diagnostics` are drawn with the same bin rule. |
| KL divergence, `plot_kld` | PhosKinTime's rows have no nulls. Bundle rows can have them, so KL uses the time points where both values exist and the panel states how many were skipped. On complete rows it is identical (parity test). |
| Kinase activity, `export_kinase_activities` | When the bundle has an `rhs_step` representation, the panel draws the right-continuous step the RHS integrates (`backend.py:293-299`) instead of the linear interpolation (N17). With only `export_linear`, the panel draws it and says it is not what the model integrates. |
| Posterior trace, `_plot_posterior` | Chains are concatenated as in PhosKinTime, and coloured by chain (PhosKinTime does not separate them). |
| Convergence, `process_convergence_history` | It has no callers and assumes three objective columns. The viewer follows its intent (log-scale best value per iteration) on the bundle's `convergence` table. |
| GOF, protwise | The stats table also shows R² and RMSE with the networkmodel definitions. PhosKinTime's protwise plot shows only the bands. |

## Regression bands (P9)

SveltePlot's `RegressionY` draws an OLS line with an **analytic** confidence band. `confidence`
is set **explicitly to 0.95**; SveltePlot's default is 0.99 (`marks/helpers/Regression.svelte`
in v0.14.2). PhosKinTime's `seaborn.regplot(ci=95)` draws a **bootstrap** 95 % band. The line
itself is the same: the parity test checks slope, intercept and r against
`scipy.stats.linregress` to 1e-9. The band widths can differ slightly between the analytic and
bootstrap methods. The regression is an **extra layer** on GOF plots: the identity line and the
robust-σ bands stay as PhosKinTime draws them.

## Things the viewer refuses to do

- No smoothing curves (`basis`, `monotone`, splines) on data or model values. Step curves are used where the model is piecewise constant.
- No interpolation between sparse observations: observed-vs-predicted differences are points, not areas.
- No raster interpolation or blur on data (`interpolate="none"`, `image-rendering: pixelated`).
- No stacking of fold changes or ratios (P1 rejected, see `docs/plot-patterns.md`).
- No numbers shown as 0 where the bundle has null.
