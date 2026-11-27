# phoskintime-vis

Offline viewer and run-comparison tool for **PhosKinTime run bundles**, built with Svelte 5 and
[SveltePlot](https://svelteplot.dev). It opens a bundle (`<run>.pkt/` folder or `<run>.pkt.zip`),
checks it, redraws PhosKinTime's plots from the stored data, and **compares runs**: for example a
run before and after a scientific fix, with an exportable before/after report. A What-if view
for a future simulation engine sits behind a feature flag.

Companion to [bibymaths/phoskintime](https://github.com/bibymaths/phoskintime).

## Exports

Every panel's ⋯ menu exports **PNG** (true 600 dpi by default, 300 and 1200 selectable, with
pHYs and provenance text chunks), **PDF** (vector, real text, embedded font, provenance
metadata), **SVG** (size in mm), **CSV** (the plotted data, with a provenance and units header)
and **TikZ/PGFPlots** (a zip with a `tikzpicture`, a standalone document, full-precision data
files and a README). "Export options…" sets the journal size (85 / 114 / 174 mm or custom), the
base font size in pt, the dpi, and title, caption and footer. "Export all panels" (command
palette) writes one zip. Exports always use the light print theme and the bundled font. Text is
never scaled below the chosen size without confirmation: when labels do not fit, the dialog offers
shorter labels, fewer ticks, the next width preset or "scale anyway". See
`docs/decisions/0002-pdf-export.md` and `docs/decisions/0003-tikz-export.md`.

## Navigation

Sections follow scientific questions: Overview, Fit quality, Dynamics, Parameters,
Uncertainty, Sensitivity, Steady state & network, and Compare when two bundles are open. The
protein / psite / layer bar drives every dependent panel and the URL, so a link such as
`index.html#/dynamics/nm-timeseries?protein=G007` reproduces the view. Ctrl/⌘ + K opens the
command palette. The light and dark themes and two densities are in the top bar.

## Contract-only design

This repository depends **only on versioned contracts**, never on PhosKinTime's internals:

1. the **bundle schema** (manifest JSON Schema plus table definitions) in `contracts/phoskintime/<version>/`
2. the **engine API** (HTTP) in `contracts/pktengine/<version>/`, later

It never imports PhosKinTime code, never reads raw result folders, workbooks or pickles, and never
hard-codes biological meaning for parameter names. Labels, groups and units come from the
bundle manifest. When a label is missing, the raw name is shown (see KNOWN_ISSUES N8 upstream).

Layers: `src/lib/contracts` (schema validation + one **version adapter** per schema major) →
`src/lib/sources` (`DataSource`: folder, zip, engine) → `src/lib/model` (internal typed model) →
`src/lib/panels` (a **panel registry**: each panel declares the tables it needs, its minimum
schema version, its PhosKinTime parity reference and its plot patterns). Parquet decoding runs in
a worker (`src/lib/workers`).

## Supported bundle schema versions

| Schema | Status |
|---|---|
| 1.0 | **DRAFT** contract written in this repository (`contracts/phoskintime/1.0-draft/`). PhosKinTime has not published a schema yet; see `docs/upstream-status.md`. |
| 1.x (x > 1) | loads with a notice; unknown fields are ignored |
| ≥ 2.0 | refused with a clear message |

## Quick start

```bash
nvm use                      # Node 24
npm ci
python -m pip install -r tests/requirements-dev.txt   # dev only: numpy, pyarrow, scipy, pandas (pyarrow needs snappy)
# set PYTHON=/path/to/venv/python if your default python3 lacks these
npm run fixtures             # synthetic spec-fixture bundles in tests/fixtures/out/
npm run build:single         # dist-single/index.html: one file, works offline from file://
xdg-open dist-single/index.html   # then open a .pkt.zip or .pkt folder
```

Other scripts: `dev`, `build` (Pages build), `test` (unit), `test:parity`, `test:e2e`
(Playwright, Chromium + Firefox, `file://`), `test:visual` (screenshot baselines), `lint`,
`check`, `sync-contracts`, `docs:assets` (screenshots, gallery and sample exports into the
ignored `docs/screenshots/` and `docs/samples/exports/`).

Mock engine for the What-if preview: `node scripts/mock-engine.mjs tests/fixtures/out/small-protwise.pkt`,
then open `dist-single/index.html?engine=mock`. The mock does not simulate anything; it is for
interface development only.

## Privacy

Everything happens in your browser tab. Bundles are read from local files and nothing is
uploaded. The page's Content-Security-Policy allows no network access except to an engine on
`127.0.0.1`/`localhost`, which you connect to explicitly. The single-file build works with no
network at all.

## Documentation

- `docs/upstream-status.md`: what PhosKinTime provides today (bundle command, engine, known issues, plotting functions)
- `docs/panel-inventory.md`: every panel with its PhosKinTime parity reference (function, line, commit) and coverage
- `docs/plot-patterns.md`: which SveltePlot patterns are used where, and where they were rejected
- `docs/substitutions.md`: chart types replaced by honest equivalents
- `docs/upstream-proposals.md`: proposed issues for PhosKinTime
- `docs/decisions/0001-parquet-reader.md`: Parquet reader choice (measured)
- `docs/decisions/0002-pdf-export.md`, `0003-tikz-export.md`, `0004-ui-stack.md`: export pipeline, PGFPlots emitter, UI stack
- `THIRD_PARTY.md`: bundled font licence (OFL) and runtime libraries
- `docs/performance.md`: measured performance
- Generated docs assets (synthetic data, not kept in git): `docs/screenshots/gallery.html` (every
  section in light and dark, every panel, comparison mode, exports) and `docs/samples/exports/`
  (sample exports in every format). Run `npm run docs:assets` after `npm run fixtures` and
  `npm run build:single`, or download the `docs-assets` artifact of a CI run. The Pages demo
  publishes both under `docs/`. The TikZ gallery (`docs/screenshots/tikz-gallery.html`, each
  panel's compiled TikZ next to the viewer's PNG export) needs TeX Live; see `CONTRIBUTING.md`.

All data in this repository (fixtures, screenshots, demo) is synthetic.

## License

BSD-3-Clause, see `LICENSE`.
