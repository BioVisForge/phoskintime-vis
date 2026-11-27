/**
 * Panel registry. Each panel declares the tables/columns it needs, the minimum schema version,
 * its PhosKinTime parity reference (file, function, def line, commit) and the SveltePlot
 * patterns it uses (docs/plot-patterns.md). Panels are enabled by what a bundle contains.
 *
 * Parity references point at phoskintime sci/2026-12 @ e634e17. When PhosKinTime removes its
 * plotting code, keep these references: they record the last commit that had the function.
 */
import type { PanelDef, Requirement } from './types'
import { PKT_COMMIT } from './common'
import ModelFit from './protwise/ModelFit.svelte'
import Pca from './protwise/Pca.svelte'
import Tsne from './protwise/Tsne.svelte'
import Parallel from './protwise/Parallel.svelte'
import Knockouts from './protwise/Knockouts.svelte'
import Perturbations from './protwise/Perturbations.svelte'
import TimeStateGrid from './protwise/TimeStateGrid.svelte'
import PhaseSpace from './protwise/PhaseSpace.svelte'
import ParamPairs from './protwise/ParamPairs.svelte'
import PwSensitivity from './protwise/Sensitivity.svelte'
import PwGof from './protwise/Gof.svelte'
import Kl from './protwise/Kl.svelte'
import RegMse from './protwise/RegMse.svelte'
import Profiles from './protwise/Profiles.svelte'
import NmGof from './networkmodel/Gof.svelte'
import TimeSeries from './networkmodel/TimeSeries.svelte'
import AllTrajectories from './networkmodel/AllTrajectories.svelte'
import ParamDist from './networkmodel/ParamDist.svelte'
import ParamCorr from './networkmodel/ParamCorr.svelte'
import ParamParallel from './networkmodel/ParamParallel.svelte'
import Kinase from './networkmodel/Kinase.svelte'
import Residuals from './networkmodel/Residuals.svelte'
import Convergence from './networkmodel/Convergence.svelte'
import Pareto from './networkmodel/Pareto.svelte'
import Multistart from './networkmodel/Multistart.svelte'
import Profile from './networkmodel/Profile.svelte'
import PosteriorTrace from './networkmodel/PosteriorTrace.svelte'
import PosteriorDensity from './networkmodel/PosteriorDensity.svelte'
import PosteriorRidge from './networkmodel/PosteriorRidge.svelte'
import PosteriorCi from './networkmodel/PosteriorCi.svelte'
import PosteriorPredictive from './networkmodel/PosteriorPredictive.svelte'
import NmSensitivity from './networkmodel/Sensitivity.svelte'
import Steady from './networkmodel/Steady.svelte'
import Insights from './networkmodel/Insights.svelte'
import Matrices from './networkmodel/Matrices.svelte'
import Heatmap from './shared/Heatmap.svelte'

const ref = (file: string, fn: string, line: number) => ({ file, fn, line, commit: PKT_COMMIT })
const PW = 'protwise/plotting/plotting.py'
const EX = 'networkmodel/export.py'
const BI = 'networkmodel/BayesianInference.py'
const TRAJ: Requirement = { table: 'trajectories', columns: ['layer', 'protein', 'state', 'time', 'value_obs', 'value_pred', 'sample_id'] }
const PARAMS: Requirement = { table: 'parameters', columns: ['name', 'value', 'sample_id'] }

export const PANELS: PanelDef[] = [
  // ------------------------------------------------------------------ protwise
  { id: 'pw-model-fit', title: 'Model fit', workflow: 'protwise', section: 'protwise: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_model_fit', 200), coverage: 'full', patterns: [],
    description: 'Best-fit model (solid) and observations (dashed, squares) per state, split at index 8 of the time grid with a shared y axis. Null observations are gaps.', component: ModelFit },
  { id: 'pw-gof', title: 'Goodness of fit', workflow: 'protwise', section: 'protwise: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_gof', 312), coverage: 'full', patterns: ['P9', 'P4', 'P3', 'P6'],
    description: 'Observed vs fitted with identity and ±1.96 / ±2.576 × std(observed) lines; outliers ringed; optional OLS layer; brush to list points and see their trajectories.', component: PwGof },
  { id: 'pw-kl', title: 'KL divergence per gene', workflow: 'protwise', section: 'protwise: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_kld', 379), coverage: 'full', patterns: [],
    description: 'Row-normalised KL(obs ‖ est) in nats, mean per gene, flagged above 0.03.', component: Kl },
  { id: 'pw-reg-mse', title: 'Regularization and MSE', workflow: 'protwise', section: 'protwise: fit', requires: [{ table: 'metrics', columns: ['protein', 'metric', 'value'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_regularization / plot_model_error', 1008), coverage: 'full', patterns: [],
    description: 'Per-protein regularization and MSE as sorted horizontal bars with value labels.', component: RegMse },
  { id: 'pw-pca', title: 'PCA of the model solution', workflow: 'protwise', section: 'protwise: structure', requires: [{ table: 'embeddings', columns: ['method', 'protein', 'time', 'x', 'y'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_pca', 115), coverage: 'substituted', patterns: ['P11'],
    description: 'PC1 vs PC2 over time with direction-of-time arrows (finite differences). PhosKinTime draws 3-D with a spline path.', component: Pca },
  { id: 'pw-tsne', title: 't-SNE of the model solution', workflow: 'protwise', section: 'protwise: structure', requires: [{ table: 'embeddings', columns: ['method', 'protein', 'time', 'x', 'y'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_tsne', 150), coverage: 'partial', patterns: ['P11'],
    description: 't-SNE coordinates as stored, with a straight path (no spline) and direction-of-time arrows.', component: Tsne },
  { id: 'pw-parallel', title: 'Parallel coordinates', workflow: 'protwise', section: 'protwise: structure', requires: [TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_parallel', 46), coverage: 'full', patterns: ['P7'],
    description: 'One polyline per time point across the states; raw values (as PhosKinTime) or per-state extent.', component: Parallel },
  { id: 'pw-knockouts', title: 'Knockouts', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'knockouts', columns: ['protein', 'knockout', 'state', 'time', 'value'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_knockouts', 404), coverage: 'partial', patterns: ['P5', 'P4'],
    description: 'Wild type vs each knockout with the signed difference shaded. PhosKinTime overlays conditions in a 2 × 2 zoom/late grid.', component: Knockouts },
  { id: 'pw-perturbations', title: 'Perturbation cloud', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'perturbations', columns: ['protein', 'perturbation', 'state', 'time', 'value'] }, TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_model_perturbations (first figure)', 527), coverage: 'partial', patterns: ['P6', 'P10'],
    description: 'Quantile band and median across perturbation samples with min/max rules, best fit on top; raw sample lines on canvas when toggled.', component: Perturbations },
  { id: 'pw-time-state-grid', title: 'Time × state grid', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'perturbations', columns: ['protein', 'state', 'time', 'value'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_time_state_grid', 825), coverage: 'substituted', patterns: ['P2'],
    description: 'One Tukey box per time point and state across perturbation samples (replaces the strip grid).', component: TimeStateGrid },
  { id: 'pw-phase-space', title: 'Phase space', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'perturbations', columns: ['protein', 'perturbation', 'state', 'time', 'value'] }, TRAJ], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_phase_space', 898), coverage: 'full', patterns: ['P11', 'P6'],
    description: 'State X vs state Y per perturbation sample, best fit with direction-of-time arrows.', component: PhaseSpace },
  { id: 'pw-param-pairs', title: 'Parameter pairs', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'perturbation_samples', columns: ['protein', 'perturbation', 'parameter', 'value'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_top_param_pairs', 476), coverage: 'full', patterns: ['P9', 'P3'],
    description: 'Every parameter pair with |r| and an OLS line (95 % band); brush one pair to select samples and see their trajectories.', component: ParamPairs },
  { id: 'pw-sensitivity', title: 'Sensitivity (Morris)', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'sensitivity', columns: ['protein', 'parameter', 'mu_star', 'sigma'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_model_perturbations (μ*, σ, radar, pie)', 527), coverage: 'substituted', patterns: ['P3'],
    description: 'μ* (with confidence), σ, μ*–σ; radar and pie replaced by grouped bars and share bars.', component: PwSensitivity },
  { id: 'pw-param-profiles', title: 'Parameter profiles', workflow: 'protwise', section: 'protwise: perturbation', requires: [{ table: 'parameter_profiles', columns: ['protein', 'parameter', 'parameter_value', 'state', 'time', 'value'] }], minSchema: '1.0',
    parity: ref(PW, 'Plotter.plot_profiles (no callers)', 180), coverage: 'partial', patterns: [],
    description: 'Model output as one parameter is varied.', component: Profiles },

  // ------------------------------------------------------------------ networkmodel
  { id: 'nm-gof', title: 'Goodness of fit (overall and per layer)', workflow: 'networkmodel', section: 'networkmodel: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(EX, 'plot_goodness_of_fit', 291), coverage: 'full', patterns: ['P9', 'P4', 'P3', 'P6'],
    description: 'Robust-σ bands (1.4826·MAD), R² as squared Pearson r, identity RMSE; per-layer facets; optional OLS layer; brush to see trajectories.', component: NmGof },
  { id: 'nm-timeseries', title: 'Per-gene time series', workflow: 'networkmodel', section: 'networkmodel: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(EX, 'save_gene_timeseries_plots', 821), coverage: 'full', patterns: [],
    description: 'Protein, mRNA and phospho panels for one gene: observations and best-fit predictions.', component: TimeSeries },
  { id: 'nm-all-trajectories', title: 'All trajectories', workflow: 'networkmodel', section: 'networkmodel: fit', requires: [TRAJ], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: ['P6'],
    description: 'All predicted series per layer: quantile bands by default, every line on canvas when toggled, selected gene highlighted.', component: AllTrajectories },
  { id: 'nm-residuals', title: 'Residuals', workflow: 'networkmodel', section: 'networkmodel: fit', requires: [TRAJ], minSchema: '1.0',
    parity: ref(EX, 'export_residuals', 1593), coverage: 'full', patterns: ['P2', 'P12'],
    description: 'Residual vs time per layer with bias and RMSE, plus box and ridge distributions per layer.', component: Residuals },
  { id: 'heatmap', title: 'Time × state heatmap (log2 FC)', workflow: 'any', section: 'overview', requires: [TRAJ], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: ['P8'],
    description: 'Dense time × state grid of log2 predicted fold change, diverging around 0, no interpolation.', component: Heatmap },
  { id: 'nm-kinase', title: 'Kinase activity', workflow: 'networkmodel', section: 'networkmodel: inputs', requires: [{ table: 'kinase_activity', columns: ['kinase', 'time', 'value', 'representation'] }], minSchema: '1.0',
    parity: ref(EX, 'export_kinase_activities (RHS: backend.py:291 rhs)', 1441), coverage: 'partial', patterns: [],
    description: 'Top 10 kinases, drawn as the RHS uses them (step) when the bundle has that representation; otherwise the interpolated export with an N17 warning.', component: Kinase },
  { id: 'nm-param-dist', title: 'Parameter distributions', workflow: 'networkmodel', section: 'networkmodel: parameters', requires: [PARAMS], minSchema: '1.0',
    parity: ref('networkmodel/Insights.py', 'run_parameter_diagnostics (_hist)', 391), coverage: 'partial', patterns: [],
    description: 'Histogram of best-fit values per parameter group (labels and units from the manifest). PhosKinTime also box-plots c_k across Pareto solutions, which the bundle does not contain.', component: ParamDist },
  { id: 'nm-param-corr', title: 'Parameter correlations', workflow: 'networkmodel', section: 'networkmodel: parameters', requires: [PARAMS], minSchema: '1.0',
    parity: ref(EX, 'export_param_correlations', 1511), coverage: 'substituted', patterns: [],
    description: 'Within-group correlation across posterior draws and across-protein correlation of per-protein groups.', component: ParamCorr },
  { id: 'nm-param-parallel', title: 'Parameter vectors (parallel coordinates)', workflow: 'networkmodel', section: 'networkmodel: parameters', requires: [{ table: 'parameters', columns: ['name', 'lower', 'upper'] }], arrays: ['posterior_draws'], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: ['P7'],
    description: 'Posterior draws across a group’s parameters, bounds-normalised (near-bound diagnostic), extent or log.', component: ParamParallel },
  { id: 'nm-convergence', title: 'Convergence', workflow: 'networkmodel', section: 'networkmodel: optimisation', requires: [{ table: 'convergence', columns: ['run', 'iteration', 'objective'] }], minSchema: '1.0',
    parity: ref(EX, 'process_convergence_history (no callers)', 1380), coverage: 'partial', patterns: ['P10', 'P6'],
    description: 'Objective per iteration for every start, best-so-far and per-iteration min–max rules.', component: Convergence },
  { id: 'nm-multistart', title: 'Multistart', workflow: 'networkmodel', section: 'networkmodel: optimisation', requires: [{ table: 'multistart', columns: ['start', 'objective', 'selected', 'converged'] }], minSchema: '1.0',
    parity: ref(BI, '_plot_multistart', 287), coverage: 'partial', patterns: ['P2', 'P3'],
    description: 'Objective histogram, ranked objective (brush to choose starts) and a Tukey box with points.', component: Multistart },
  { id: 'nm-pareto', title: 'Pareto front', workflow: 'networkmodel', section: 'networkmodel: optimisation', requires: [{ table: 'pareto', columns: ['solution', 'objective', 'value', 'selected'] }], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: ['P3'],
    description: 'Two objectives of the stored front, picked solution ringed; brush to choose solutions.', component: Pareto },
  { id: 'nm-profile', title: 'Profile likelihood', workflow: 'networkmodel', section: 'networkmodel: optimisation', requires: [{ table: 'profile_likelihood', columns: ['name', 'grid_value', 'delta', 'space', 'statistic'] }], minSchema: '1.0',
    parity: ref(BI, '_plot_profile', 575), coverage: 'partial', patterns: [],
    description: 'Δ objective along each profiled parameter’s grid, with the grid space and statistic stated by the bundle (N13).', component: Profile },
  { id: 'nm-post-trace', title: 'Posterior trace', workflow: 'networkmodel', section: 'networkmodel: posterior', requires: [PARAMS], arrays: ['posterior_draws'], minSchema: '1.0',
    parity: ref(BI, '_plot_posterior (trace)', 1384), coverage: 'full', patterns: [],
    description: 'Draws against sample index, chains concatenated (coloured by chain).', component: PosteriorTrace },
  { id: 'nm-post-density', title: 'Posterior histogram', workflow: 'networkmodel', section: 'networkmodel: posterior', requires: [PARAMS], arrays: ['posterior_draws'], minSchema: '1.0',
    parity: ref(BI, '_plot_posterior (density = 15-bin histogram)', 1384), coverage: 'full', patterns: [],
    description: '15-bin histogram per parameter with 5/50/95 % quantiles.', component: PosteriorDensity },
  { id: 'nm-post-ridge', title: 'Posterior ridgeline', workflow: 'networkmodel', section: 'networkmodel: posterior', requires: [PARAMS], arrays: ['posterior_draws'], minSchema: '1.0',
    parity: ref(BI, '_plot_ridgeline_parameter_distributions', 1253), coverage: 'full', patterns: ['P12'],
    description: 'Marginal densities in batches of 25 with PhosKinTime’s KDE and 5–95 % bars; per-parameter or shared (log) x.', component: PosteriorRidge },
  { id: 'nm-post-ci', title: 'Credible intervals', workflow: 'networkmodel', section: 'networkmodel: posterior', requires: [PARAMS], arrays: ['posterior_draws'], minSchema: '1.0',
    parity: ref(BI, '_plot_posterior (credible_intervals)', 1384), coverage: 'full', patterns: [],
    description: 'Median and 90 % (5–95 %) interval per parameter, grouped by the manifest group.', component: PosteriorCi },
  { id: 'nm-post-predictive', title: 'Posterior predictive bands', workflow: 'networkmodel', section: 'networkmodel: posterior', requires: [TRAJ], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: ['P5'],
    description: 'Quantile bands over stored predictive samples, with the fit vs predictive-median difference shaded.', component: PosteriorPredictive },
  { id: 'nm-sensitivity', title: 'Sensitivity (Morris)', workflow: 'networkmodel', section: 'networkmodel: sensitivity and state', requires: [{ table: 'sensitivity', columns: ['output', 'parameter', 'mu_star', 'sigma'] }], minSchema: '1.0',
    parity: ref('networkmodel/sensitivity.py', '_plot_sensitivity_indices', 552), coverage: 'full', patterns: ['P3'],
    description: 'Top 30 μ* bars, σ bars and a brushable μ*–σ scatter per output.', component: NmSensitivity },
  { id: 'nm-steady', title: 'Steady state', workflow: 'networkmodel', section: 'networkmodel: sensitivity and state', requires: [{ table: 'steady_state', columns: ['protein', 'state', 'time', 'value'] }], minSchema: '1.0',
    parity: ref('networkmodel/SteadyStateAnalysis.py', 'plot_steady_state_all', 124), coverage: 'partial', patterns: [],
    description: 'Per-protein dynamics to steady state and the |dy/dt| distribution (legacy RHS, N10).', component: Steady },
  { id: 'nm-insights', title: 'Insights', workflow: 'networkmodel', section: 'networkmodel: sensitivity and state', requires: [TRAJ], minSchema: '1.0',
    parity: ref('networkmodel/Insights.py', 'run_network_diagnostics / run_trajectory_feature_export', 129), coverage: 'partial', patterns: [],
    description: 'Network degree histograms and top-30 trajectory amplitudes per layer.', component: Insights },
  { id: 'nm-matrices', title: 'Network matrices', workflow: 'networkmodel', section: 'networkmodel: sensitivity and state', requires: [], arrays: ['matrix_W_site_kinase'], minSchema: '1.0',
    parity: null, coverage: 'viewer-extra', patterns: [],
    description: 'Non-zero entries of the stored network matrices as cells (viewer extra).', component: Matrices },
]

export function patternUsage(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const p of PANELS) for (const id of p.patterns) (out[id] ??= []).push(p.id)
  return out
}
