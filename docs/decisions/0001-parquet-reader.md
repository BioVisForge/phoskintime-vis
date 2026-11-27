# 0001: Parquet reader

Status: accepted (2026-11-26)

## Context

Bundles store tables as Parquet (`tables/*.parquet`, snappy). The viewer must decode them in the
browser, offline, from a single self-contained `index.html` opened via `file://`, and from the
Pages build. Candidates: **hyparquet**, **parquet-wasm + apache-arrow**, **DuckDB-WASM**.

## Measurement

Input: the largest fixture table, `network.pkt/tables/trajectories.parquet` (1,177,960 bytes,
112,000 rows × 10 columns, snappy, nulls in `psite` and `value_obs`). Each reader decodes every
column to JS arrays (Arrow readers include `.toArray()` on each column). Harness:
`bench/main.ts` + `bench/run.mjs`, headless Playwright 1.65.1, this machine, 5 timed repetitions
after one warm-up call. Raw results: `docs/decisions/0001-parquet-bench.json`.

| Reader | Chromium 159 median | Firefox 159 median | First call incl. init (Chromium / Firefox) |
|---|---|---|---|
| hyparquet 1.33.2 | **57.9 ms** | **86 ms** | 113 / 103 ms |
| parquet-wasm 0.9.0 + apache-arrow 21.2.0 | 424.8 ms | 717 ms | 802 / 877 ms |
| DuckDB-WASM 1.33.1-dev57.0 (eh build) | 447.5 ms | 667 ms | 2,653 / 2,761 ms |

Size added to the build (measured):

| Reader | JS (minified) | WASM | Effect on `dist-single/index.html` |
|---|---|---|---|
| hyparquet | 76,568 B | none | small; the whole app build is 992,999 B |
| parquet-wasm + arrow | 221,587 B (arrow) + glue | 5,254,537 B | about +7 MB once base64-inlined |
| DuckDB-WASM | 773,223 B worker + library | 35,913,747 B | about +48 MB once base64-inlined; it also needs worker and WASM URLs, which `file://` makes awkward |

Offline from `file://`: hyparquet is plain JS and runs in an inline (blob) worker. parquet-wasm and
DuckDB need their WASM inlined and instantiated from memory. That is possible for parquet-wasm,
but DuckDB's multi-file worker setup does not fit a single-file build.

## Decision

**hyparquet.** It is 7–8× faster than both alternatives on this workload, adds no WASM, keeps the
single file under 1 MB, and works from `file://` in Chromium and Firefox. Nulls arrive as `null`,
which `src/lib/io/parquet.ts` maps to a validity mask: gaps, never zeros.

Decoding runs in a classic (`iife`) inline worker (`src/lib/workers/`). A **module** worker from a
`blob:` URL fails to start in Chromium under `file://` (observed: `Parquet worker failed`), and the
classic worker works in both browsers.

## Consequences

- If bundles move to codecs hyparquet lacks (zstd, brotli), add `hyparquet-compressors` (JS) or revisit this decision.
- SQL-style ad-hoc queries are not available; aggregations live in `src/lib/transforms/`.
- `apache-arrow` is still a runtime dependency, loaded lazily, only to read Arrow IPC replies from an engine (Milestone 2).
- `parquet-wasm` and `@duckdb/duckdb-wasm` stay as devDependencies, for the benchmark only.
