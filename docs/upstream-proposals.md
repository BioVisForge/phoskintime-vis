# Proposed upstream issues for bibymaths/phoskintime

These issues are ready to paste into GitHub. Each gets the label `upstream`. **None has been filed.** They come from building
phoskintime-vis against `sci/2026-12` @ `e634e17` / `96d9309` (see `docs/upstream-status.md`).

---

## 1. Publish a versioned run-bundle schema (`phoskintime bundle create|verify|inspect`)

**Labels:** `upstream`, `enhancement`

PhosKinTime-Vis (and any other consumer) should depend on a versioned contract, never on result
folders, workbooks or pickles. There is no `phoskintime bundle` command and no
`common/bundle/schema/` today. The only bundle-like artefact is the pickled dashboard bundle
(`networkmodel/dashboard_bundle.py`).

Proposal: adopt or adapt the draft in phoskintime-vis `contracts/phoskintime/1.0-draft/`:

- `<run>.pkt/` folder or `<run>.pkt.zip` with `manifest.json`, `provenance/` (metadata.json, config_resolved.yaml, command.txt, console.log), `tables/*.parquet`, `arrays/*.npy`, and from 1.1 `resim/`.
- `manifest.json` validated by `common/bundle/schema/manifest-1.0.schema.json` (JSON Schema 2020-12): `bundle_schema`, `bundle_id`, producer (`phoskintime_version`, `git_commit`, `git_dirty`), `workflows`, `model` (`model_id`, `variant`), `config_sha256`, `inputs`, `files[]` (path, sha256, bytes, kind, table, rows, columns with dtype/unit/nullable, `passthrough.source_path/sheet`), `parameter_order_sha256`, `state_order_sha256` (sha256 of the newline-joined names in order), `missing[]`/`skipped[]` with reasons, `warnings[]`.
- Core tables: `trajectories`, `parameters`, `state_index`, `metrics`, `sensitivity`, `embeddings`, `convergence`. Optional: `multistart`, `pareto`, `profile_likelihood`, `kinase_activity`, `knockouts`, `perturbations`, `perturbation_samples`, `steady_state`, `parameter_profiles`, `matrix_labels`; arrays `posterior_draws` (chain × draw × parameter) and `matrix_*`.
- Every other output converted 1:1 to Parquet under `tables/passthrough/`, with its original path and sheet recorded.
- Nulls: missing values are written as Parquet nulls, never 0 or NaN-as-data.
- `phoskintime bundle verify` recomputes every sha256. `inspect` prints the manifest summary.

Acceptance: a bundle from PhosKinTime's synthetic test fixtures validates against the published
schema, and phoskintime-vis's e2e suite passes on it (the `upstream-contract` CI job is ready
for this).

---

## 2. Manifest fields `known_issues_open` and `fold_change_baseline`

**Labels:** `upstream`, `enhancement`

While the KNOWN_ISSUES fixes land, every result should say which issues were still open when it
was produced.

- `known_issues_open`: a list of `{id, severity, status, title, text}` for every KNOWN_ISSUES.md row whose state is not "Fixed" at the producing commit, plus `known_issues_source: {path, commit, sha256}`. Parsing the table is enough. Include the text, so the viewer can show it offline.
- `layers[].fold_change_baseline: {time, method, note}`: the baseline time actually used per layer (today t = 0 for protein/phospho and t = 4.0 for RNA, hard-coded in `simulate.py:84-86`, `runner.py:920-922`, `PosteriorObjective.py:281-283`). This makes N7 visible in every bundle and in before/after comparisons.

phoskintime-vis already shows both fields (header chip, comparison provenance and issue diff) and
treats an absent field differently from an empty list.

---

## 3. Parameter `label`, `group` and `unit` in the manifest

**Labels:** `upstream`, `enhancement`, relates to **N8**

The viewer must not hard-code what `A_i`, `E_i`, `Dp_i` or `c_k` mean. Today the meanings
disagree between the RHS, `runner.py:1634-1652`, `export.py:734-742`/`1560-1564`,
`INTERPRETATION.md` and `config.toml` (N8), and **no units are declared anywhere**.

Proposal: `manifest.parameters[] = {name, label, group, unit, description}` and
`manifest.parameter_groups[] = {id, label, unit, description}`, generated from one table in the
code (the same one the RHS docstring uses). Use `null` where a label is unknown: the viewer then
shows the raw name instead of a wrong label. Use the names already used in posterior CSVs
(`A_i[G001]`, `c_k[K01]`, `Dp_i[G001_S10]`, `tf_scale`).

---

## 4. Save the data behind plots that cannot be rebuilt today

**Labels:** `upstream`, `enhancement`

Once matplotlib plotting leaves PhosKinTime, these figures can only be redrawn if their data is
saved:

| Plot | Data needed in the bundle | Today |
|---|---|---|
| protwise model fit / GOF / KL | observed **mRNA and protein** per gene and time, aligned with predictions (`trajectories`) | observed values only exist inside plotting calls and `merge_obs_est` |
| protwise steady-state dynamics | trajectories to steady state per protein | not saved; `protwise/steady` has no plot or export |
| networkmodel steady state | `steady_state` (t, state, value, \|dy/dt\|) with the RHS used named (N10) | PNG only |
| kinase activity | **as the RHS uses it**: the kinase grid `sys.kin.grid` and the step values `Kmat ⊙ c_k` (right-continuous), as `representation = rhs_step`; keep `export_linear` only labelled as such (N17) | only the linear interpolation on 0–120 min (`export.py:1465`) |
| PCA / t-SNE | coordinates and explained variance per component (scree) | PNG only |
| perturbation clouds, parameter pairs | per-sample parameter vectors with RMSE (`perturbation_samples`) and trajectories (`perturbations`) | partly in workbook sheets |
| parameter correlations / c_k box | parameter vectors of every Pareto solution | Excel sheets |
| S(t) report (`plot_s_rates_report`) | `S_rates_picked.csv` as a table | CSV, not versioned |
| additive drive contributions | W_ik·Kt_k(t) per site and kinase, which would allow an honest streamgraph (composition over time) | not saved |

---

## 5. `pktengine` HTTP API shape the viewer needs

**Labels:** `upstream`, `enhancement`

A slim engine re-simulates a bundle for what-if analysis. The viewer needs the endpoints below. A
draft OpenAPI is in phoskintime-vis `contracts/pktengine/0.1-draft/openapi.yaml`, and a mock in
`scripts/mock-engine.mjs`.

- `GET /health` → `{status, engine, version, commit, api_version, capabilities: {simulate, batch, whatif_ops: [set_parameter, knockout], knockout_targets, model_variants, output_formats: [arrow, json], bundle_schemas}}`
- `GET /bundles` → bundles it can simulate, keyed by the manifest's `bundle_id`.
- `POST /simulate` `{bundle_id, parameters: {name: value}, knockouts: [{target, id}], times?}` → Arrow IPC stream (or JSON) of `state, layer, protein, time, value`, with `x-engine` / `x-engine-version` headers.
- `POST /simulate/batch` `{requests: [...]}`.
- `POST /verify` `{bundle_id}` → `{reproduces, max_abs_diff, tolerance, n_compared}`: does the engine reproduce the stored best-fit trajectories? The viewer calls it on connect and shows the answer.
- Bind to 127.0.0.1 only. CORS must allow the `null` origin (`file://`).
- It must use the **JAX fitting RHS**. An SBML-based engine is only acceptable once N10 is fixed and a parity test against `pktengine` passes.
- Bundle schema 1.1 adds `resim/` (initial conditions, kinase grid, W, fixed inputs) so that `/verify` can succeed without the original data folder.
