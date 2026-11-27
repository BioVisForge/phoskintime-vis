# Contributing

## Ground rules

- **Contract-only.** Never import PhosKinTime code or read its result folders, workbooks or pickles. Data comes from a bundle that validates against a vendored schema in `contracts/`. ESLint enforces the import rule.
- **No hard-coded meanings.** Parameter labels, groups and units come from the manifest. Show the raw name when a label is missing.
- **Nulls are gaps.** Never render a missing value as 0. Never interpolate between sparse observations.
- **Parity first.** A panel that redraws a PhosKinTime plot computes the same numbers. Add the formula to `tests/reference/compute_reference.py` and a comparison to `tests/parity/parity.test.ts` (rtol 1e-9; justify anything looser).
- **Synthetic data only** in fixtures, screenshots and the demo.

## Adding a panel

1. Write `src/lib/panels/<workflow>/<Name>.svelte` taking `{ bundle, report }`. Put plotted rows in `report.rows` (CSV export and raw-rows view) and caveats in `report.notes`.
2. Register it in `src/lib/panels/registry.ts` with `requires` (tables and columns), `minSchema`, `parity` (file, function, `def` line, commit, or `null` for a viewer extra), `coverage` and `patterns`.
3. Add it to `docs/panel-inventory.md` and `docs/plot-patterns.md`. Add an entry to `docs/substitutions.md` if it differs from PhosKinTime.
4. Marks with more than about 1,000 elements use canvas (`CANVAS_MIN`).

## Supporting a new upstream schema

1. `npm run sync-contracts -- <phoskintime checkout> <ref>`. It fails if a new **major** has no adapter.
2. Add `src/lib/contracts/adapters/v<major>.ts` mapping the manifest to `BundleMeta`, and register it in `adapters/index.ts`. Panels do not change.
3. Generate fixtures with the upstream `phoskintime bundle` command, if it exists, and run all tests.

## Visual regression baselines

`tests/visual/visual.spec.ts` screenshots every section in light and dark themes
(`npm run test:visual`). After an intended visual change:

```bash
npm run build:single
npx playwright test --project=visual --update-snapshots
```

Review every changed PNG in `tests/visual/visual.spec.ts-snapshots/` (they are synthetic-data
screenshots) and commit them with the change that caused them, stating why in the message.

## Exports

- Figures export through `src/lib/export/` (PNG, PDF, SVG, CSV) and `src/lib/tikz/` (PGFPlots).
  A panel needs nothing extra: marks imported from `src/lib/plot` are recorded automatically.
  Never import marks from `svelteplot` directly in a panel.
- A new mark type needs a wrapper in `src/lib/plot/`, a case in `src/lib/tikz/emit.ts` and a
  golden snapshot in `tests/unit/tikz.test.ts`.
- `tests/tikz/compile_all.sh` compiles TikZ exports. Run it after emitter changes:
  `node tests/tikz/export_all.mjs network tests/tikz/out tikz && bash tests/tikz/compile_all.sh tests/tikz/out/all-panels_*.zip`.
  Comparison sections: `node tests/tikz/export_compare.mjs tests/tikz/out/compare && bash tests/tikz/compile_all.sh tests/tikz/out/compare`.
- The PDF/PNG comparison in `tests/e2e/pdf-fidelity.spec.ts` needs Ghostscript (`gs`).
- The TikZ gallery: `node tests/tikz/gallery.mjs <png-zips> -- <compile-workdirs>`, then `python tests/tikz/downscale_viewer_pngs.py` (needs TeX Live and Ghostscript).

## Hooks

`pre-commit install` (see `.pre-commit-config.yaml`) runs formatting checks, ruff and eslint on
commit, checks the commit message, and runs the type check and unit tests before a push.

## Checks before a PR

```bash
npm run lint && npm run check && npm test && npm run test:parity && npm run build:single && npm run test:e2e
```

Use conventional commits. `main` is protected (linear history, no force-push).
