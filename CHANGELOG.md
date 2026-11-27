# Changelog

All notable changes to PhosKinTime-Vis are documented here. The project follows
[Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

## [0.1.0] - 2026-11-27


### Added

- **contracts:** Add DRAFT 1.0 bundle manifest schema and table definitions
- **core:** Version adapters, data sources, parquet/npy/sha256 IO and lazy bundle loader
- **transforms:** GOF, KL, KDE, box, envelopes and run-comparison alignment
- **ui:** App shell, bundle opener, header with verification and issues chip, panel frame and registry
- **panels:** Protwise and networkmodel panels with parity references and pattern tags
- **compare:** Run comparison with alignment, deltas, provenance and report export
- **engine:** EngineConnector, EngineHttpSource, draft pktengine API, mock server and flagged What-if view
- **plot:** Mark wrappers that record the figure spec and switch canvas layers to vector in export mode
- **export:** PNG (600 dpi, pHYs, provenance), vector PDF, SVG and CSV through one offscreen export pipeline
- **tikz:** PGFPlots emitter from the figure spec, standalone zip, compile script and manual TeX CI job
- **ui:** App shell with sections by question, global context, command palette, inspector, panel cards, themes
- **export:** Fit to width needs confirmation; TikZ of a comparison section holds only its plots
- **brand:** Logo, wordmarks and favicons combining the BioVisForge forge and the PhosKinTime wave

### Fixed

- **export:** Rasters up to the vector limit export as one rect per cell (vector, never smoothed)
- **export:** Resolve text baselines so the PDF places labels like the PNG; fold text opacity
- **panels:** Explicit symlog ticks on steady state; keep GOF point labels inside the plot
- **ui:** Protein selector is disabled until its list has loaded

### Performance

- Canvas for large marks, render queue, offset-baseline ridgeline and FastLines canvas layer

### Documentation

- Upstream status, panel inventory, patterns, substitutions, proposals, parquet decision
- Screenshots, gallery and measured performance; test(unit): registry availability and engine URL
- Export and UI decisions, performance before/after, galleries, sample exports
- Fit to width, text baselines and opacity, axe in Firefox, refreshed performance numbers
- **site:** Zensical site with user guide, generated reference and release pages; Pages publishes it with the demo

### Tests

- **fixtures:** Spec-fixture bundle generator (synthetic, seeded)
- **unit:** Contracts, sources, IO, null handling, transforms, comparison
- **parity:** Reference formulas in numpy/scipy and rtol 1e-9 parity tests
- **e2e:** Playwright suite on the file:// single-file build; perf and screenshot scripts
- **e2e:** Tampered and future-major also as folders
- Export, UI, axe and visual-regression specs
- **plot:** Arrow direction with unequal x/y scales; pixel-space angle as a pure function
- **e2e:** Comparison exports, PDF/PNG comparison, opacity guard, axe in Firefox; TeX job compiles comparisons
- Allow for a loaded machine when panels render and samples export

### Build and CI

- Scaffold package with pinned Svelte 5, SveltePlot and tooling
- Vite single-file/pages configs, ts, eslint, precompiled schema validators
- **bench:** In-browser parquet reader benchmark
- Ci, upstream-contract and manual pages workflows; templates; sync-contracts
- PYTHON override for fixture and parity scripts
- **docs:** Generated screenshots and gallery out of git; docs-assets CI artifact and Pages copy
- **font:** Bundle PKV Sans (Noto Sans subset + Noto Sans Math operators, OFL)
- **scripts:** Perf, screenshots, galleries, sample exports and PDF bench for the new UI
- Ruff, tox and pre-commit configuration; fix the findings
- **release:** Versioned release workflow, changelog, release notes, citation, Zenodo, security and code owners

