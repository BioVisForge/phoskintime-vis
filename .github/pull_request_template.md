## What and why

## Parity checklist
- [ ] Every changed panel still lists its PhosKinTime reference (file, function, line, commit) in `registry.ts` and `docs/panel-inventory.md`
- [ ] Numbers changed or added? Formula added to `tests/reference/compute_reference.py`, parity test passes at rtol 1e-9 (or looser tolerance justified here)
- [ ] Labels, groups and units come from the manifest only; nulls are gaps, not zeros
- [ ] No smoothing or interpolation on data or model values; patterns follow `docs/plot-patterns.md`
- [ ] Substitutions recorded in `docs/substitutions.md`
- [ ] Contract-only: no PhosKinTime imports, file paths or pickles

## Tests
- [ ] `npm run lint && npm run check && npm test && npm run test:parity`
- [ ] `npm run build:single && npm run test:e2e`
