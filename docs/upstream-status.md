# Upstream status: where PhosKinTime is today

Read on 2026-11-26 from the local checkout `phoskintime-sci` (branch `sci/2026-12`, chosen by the
repository owner as the reference). Nothing in that checkout was modified; only `git`, `grep` and
file reads were used.

| | Commit | Notes |
|---|---|---|
| First read (panel inventory, parity references) | `e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b` (2026-11-26) | All parity references in `src/lib/panels/registry.ts` and `docs/panel-inventory.md` point here. |
| Re-read (known-issue states) | `96d9309b2edcf48b6e0f93aa0d4270b9b745ac20` (2026-11-26 18:01) | The branch moved during this work. `KNOWN_ISSUES.md` was updated with the fixes. In plotting code, only `protwise/plotting/plotting.py` changed (+1 line in `_save_fig`), so its `def` lines are one higher at this commit. |
| Also checked | `global` `ab76936`, `main` `6b8dab7` | Same answers as below. |

PhosKinTime version at both commits: `0.6.0.dev0` (`pyproject.toml`).

## Bundle exporter and schema

- **`phoskintime bundle` command: does not exist** on `sci/2026-12`, `global` or `main`. `config/cli.py` has no `bundle` command, and no branch contains `bundle_schema`.
- **`common/bundle/schema/manifest-*.schema.json`: does not exist** on any branch.
- The closest existing artefact is `networkmodel/dashboard_bundle.py`: a **pickle** "dashboard bundle" for the Streamlit dashboard. It is not a versioned contract and the viewer must not read it (no pickles).
- Consequence: this repository uses its own **DRAFT** contract, `contracts/phoskintime/1.0-draft/`, marked DRAFT throughout and filed as a proposal in `docs/upstream-proposals.md`. All fixtures are **spec fixtures** made by `tests/fixtures/make_fixtures.py`, not by PhosKinTime.

## Engine

- **`pktengine` or any engine server: does not exist** (no `pktengine` match on any branch).
- The What-if view (Milestone 2) is therefore built against `scripts/mock-engine.mjs`, which implements the draft API in `contracts/pktengine/0.1-draft/openapi.yaml`. It is behind the `?engine=mock` feature flag.
- **SBML:** `scripts/export/export_model_to_sbml.py` exists (networkmodel MODEL 0 only). KNOWN_ISSUES **N10 is still open**: the legacy numba RHS used for the SBML export differs from the JAX fitting RHS. There is also **X9**: `export_model_documentation.py` cannot start. No SBML connector is offered in the UI.

## KNOWN_ISSUES.md at `96d9309`

At `e634e17` every row said "Not fixed", although fix commits for N1 and P1 already existed on the branch. `96d9309` brought the file up to date. Status markers: ✔ verified, ◐ reviewer-verified, ? suspected.

### Open (these change model results when fixed)

| ID | Sev | Status | State | Topic |
|---|---|---|---|---|
| N2 | H | ✔ | Not fixed | bio bounds override configured bounds |
| N3 | H | ✔ | Not fixed | configured loss not used (weighted MSE active) |
| N4 | H | ◐ | Not fixed | observation weights fixed at 1.0 |
| N5 | H | ✔ | Not fixed | configured ODE tolerances not used |
| N6 | H | ✔ | Not fixed | posterior likelihood (no N·log σ, one σ) |
| N7 | H | ◐ | Not fixed | fold-change baseline (t=0 / t=4) vs data not 1 at baseline |
| N8 | H | ◐ | Not fixed | E_i / Dp_i meaning and labels disagree |
| N9 | M | ◐ | Not fixed | combinatorial decay k·D_i |
| N10 | M | ◐ | Not fixed | legacy numba RHS ≠ JAX RHS (steady state, SBML) |
| N12 | M | ◐ | Not fixed | PINN NaN handling |
| N13 | M | ◐ | Not fixed | profile grid in raw softplus space; MSE delta, not −2 log L |
| N17 | M | ◐ | Not fixed | kinase activity export linear vs RHS step |
| N18 | L | ◐ | Not fixed | RNA initial condition and dropped observations |
| N19 | L | ◐ | Not fixed (stale: sensitivity now takes `--seed`, see P7/S7) | sensitivity seed |
| N20 | M | ◐ | Not fixed (decision memo) | MODEL 1 state meaning |
| N21 | M | ? | Not fixed (needs a test) | orphan redirection |
| X8 | M | ✔ | Not fixed | inference keys read from the wrong config table |
| P3 | H (when on) | ✔ | Not fixed | `normalize_model_output` |
| P4 | M-H | ◐ | Not fixed | initial conditions are not steady states |
| P8 | M | ◐ | Not fixed | NaN targets; positional column slicing |
| P9 | M | ◐ | Not fixed | hard-coded dephosphorylation rate |
| X6 | M | ✔ | Not fixed | raw data not reproducible |
| X9 | M | ✔ | Not fixed | model-documentation export broken |
| X12 | M | ✔ | Not fixed (decision memo) | bootstraps unused |
| X13 | M | ✔ | Partly fixed (ffacf79, a293070, f874f2e; acb2c80 reverted in c85bc46) | recompilation |

### Fixed on `sci/2026-12`

| ID | Fixed in |
|---|---|
| N1 | ca5becf (JAX RHS sequential branch) |
| N11 | a131695 |
| N16 | 883fdfb |
| P1 | aecc428, 591f7f7 (for the configured grids) |
| P2 | 16725f8, a34adec |
| P7 (S7) | be80c54 (one seed for Morris) |
| X11 | f4340d8, 5cb76b6 |

KinOpt/TFOpt findings (K1–K12, T1–T5) refer to code that has left this repository (`6eb04fa`) and do not affect bundles.

Several issues already in this list are fixed, so bundles produced from now on will differ from earlier ones. That is why the `known_issues_open` manifest field is proposed: comparison mode shows which IDs differ between two runs.

## Plotting functions that still exist (panel parity references)

All of them were found at `e634e17`, and all still exist at `96d9309`. Full detail is in `docs/panel-inventory.md`. Summary:

- `protwise/plotting/plotting.py`, class `Plotter`: `plot_parallel` 46, `pca_components` 85, `plot_pca` 115, `plot_tsne` 150, `plot_profiles` 180 (no callers), `plot_model_fit` 200, `plot_gof` 312, `plot_kld` 379, `plot_knockouts` 404, `plot_top_param_pairs` 476, `plot_model_perturbations` 527, `plot_time_state_grid` 825, `plot_phase_space` 898, `plot_future_fit` 949 (no callers), `plot_regularization` 1008, `plot_model_error` 1055. These are `def` lines at `e634e17`; add 1 at `96d9309`.
- `networkmodel/export.py`: `plot_goodness_of_fit` 291, `plot_gof_from_pareto_excel` 509 (no callers), `save_gene_timeseries_plots` 821, `plot_s_rates_report` 1106, `process_convergence_history` 1380 (no callers), `export_kinase_activities` 1441, `export_param_correlations` 1511, `export_residuals` 1593, `export_parameter_distributions` 1658.
- `networkmodel/BayesianInference.py`: `_plot_multistart` 287, `_plot_profile` 575, `_smooth_density_1d` 1208, `_plot_ridgeline_parameter_distributions` 1253, `_plot_posterior` 1384.
- `networkmodel/sensitivity.py`: `_plot_sensitivity_indices` 552, `_plot_perturbation_cloud` 576.
- `networkmodel/SteadyStateAnalysis.py`: `plot_steady_state_all` 124.
- `networkmodel/Insights.py`: `run_network_diagnostics` 129, `run_parameter_diagnostics` 391, `run_trajectory_feature_export` 540.

When PhosKinTime removes these functions, keep the references: they record the last commit that had them.

## Vendored contracts

| Directory | Source | Status |
|---|---|---|
| `contracts/phoskintime/1.0-draft/` | written here from the viewer spec | **DRAFT**, no upstream schema exists |
| `contracts/pktengine/0.1-draft/` | written here | **DRAFT**, no upstream engine exists |

`npm run sync-contracts -- <phoskintime checkout or git ref>` replaces a draft once upstream publishes `common/bundle/schema/manifest-*.schema.json`.
