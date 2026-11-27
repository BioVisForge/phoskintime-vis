# Reference

- [Bundle schema](bundle-schema.md): the manifest fields and tables the viewer reads (draft).
- [Engine API](engine-api.md): the HTTP interface planned for the What-if view (draft).
- [TypeScript API](api/index.md): the contract, data source, model, transform and I/O modules.

## Architecture

The viewer depends only on versioned contracts, never on PhosKinTime's internal code or result
folders.

```text
contracts  → schema validation and one version adapter per schema major   src/lib/contracts
sources    → where bytes come from: folder, zip, engine                    src/lib/sources
model      → the internal typed model                                      src/lib/model
panels     → registry: required tables, schema version, parity reference   src/lib/panels
export     → one offscreen pipeline for PNG, PDF, SVG, CSV; TikZ emitter   src/lib/export, src/lib/tikz
```

The pages in this section are generated from the schema files, the OpenAPI file, the panel
registry and the source comments, so they follow the code.
