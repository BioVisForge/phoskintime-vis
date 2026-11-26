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

## Checks before a PR

```bash
npm run lint && npm run check && npm test && npm run test:parity && npm run build:single && npm run test:e2e
```

Use conventional commits. `main` is protected (linear history, no force-push).
