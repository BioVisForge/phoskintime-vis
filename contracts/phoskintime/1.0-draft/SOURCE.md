# Contract source: 1.0-draft (DRAFT)

**Status: DRAFT. Not authoritative.**

PhosKinTime has no published bundle schema at the commit read for this repository
(`bibymaths/phoskintime`, branch `sci/2026-12`, commit
`e634e170c76f9c8b56f8a98ec0ad5a26ae0cff7b`, read 2026-11-26): there is no
`phoskintime bundle` command and no `common/bundle/schema/manifest-*.schema.json`.

These files were written in phoskintime-vis from the viewer's specification. They are
filed as a proposal in `docs/upstream-proposals.md`. When PhosKinTime publishes its schema,
`npm run sync-contracts` vendors it into `contracts/phoskintime/<version>/` and a version
adapter in `src/lib/contracts/adapters/` maps it to the internal model.

- `manifest.schema.json`: JSON Schema (2020-12) for `manifest.json`.
- `tables.json`: table and column definitions (dtype, nullability, units).
