# Handoff (updated 2026-11-27, after release 0.2.0)

**Rule from the owner: push, open PRs, tag or deploy only after the owner confirms.** The owner
merges (`gh pr merge <n> --squash`) or authorises Claude Code to merge a PR once its CI is green.

## State

Released: **0.1.0** (tag on `cc6e39c`) and **0.2.0** (tag on `fa996e1`), both on 2026-11-27, with
the single-file HTML, a zip and `SHA256SUMS` attached to each GitHub release. The docs site is
deployed by the `pages` workflow on every `v*` tag.

`main` holds squash-merged PRs: #1 viewer and comparison, #2 exports and UI, #3 documentation site,
brand and release tooling, #4 Pages deploy on release tags, #5 performance and pan/zoom
(`0bdca12`), #6 release 0.2.0 (`fa996e1`).

- **Ruleset `main`** (id 28234538, no bypass): PR required (0 approvals, threads resolved), squash
  only, branch up to date, no force-push or deletion, linear history; required checks: Lint and
  type check, Unit and parity tests, Build (single file + pages), End-to-end (Chromium + Firefox,
  file://), Documentation (site, screenshots, gallery). Classic branch protection is still on too.
- **Pages**: source is GitHub Actions; the `pages` workflow runs on `v*` tags and by hand; the
  `github-pages` environment accepts `main` and `v*` tags.
- **Fixture bundle ids differ between machines** (floats differ in the last bits between CPUs;
  GitHub's runners gave other ids than the development host). Tests read ids from the generated
  manifests (`bundleId()`/`shortId()` in `tests/e2e/helpers.ts`); never hard-code them.

## What 0.2.0 added (PR #5)

Performance work on the existing panels, CPU only (decision 0006, `docs/performance-profile.md`,
`docs/performance.md`): a fast canvas dot layer on screen (proxy rows keep SveltePlot's scales;
exports unchanged), one canvas draw per frame and none when the scale values are unchanged,
sliced redraws of large layers, bitwise-identical JS fixes for quantiles/KDE/raw-lines sort, lazy
asynchronous zip inflate, cheaper brushing, and the Firefox export fit fix (SVG text measured by
its glyph box). Pan/zoom on every plot with dot marks (`docs/pan-zoom.md`; one implementation in
`src/lib/plot/zoom/`), with "export current view". No WebAssembly: the tiny-skia spike
(`bench/wasm-raster/`, evidence only) was slower than Canvas2D. Fixture `gof-100k` (102,868 GOF
points).

- `?fast=0` turns the fast layers off; `tests/e2e/fast-layers.spec.ts` compares both pixel by pixel.
- `tests/e2e/pan-zoom.spec.ts` covers every zoomable plot (about 25 min per browser).
- `scripts/profile.mjs`, `scripts/frames.mjs [chromium|firefox]` (records the host load; measure
  at load < 5 on this shared host), `scripts/perf-table.mjs`, `scripts/screen-vs-export.mjs`.
- Two targets are not met (GOF 713/782 ms vs 0.5 s; Firefox pan/zoom p95 33–50 ms vs 20 ms).
  Next steps: `docs/follow-ups.md` (a–e).

## Releasing

Branch from `main`; `uv pip install --python .venv/bin/python bump-my-version==1.8.4` (or `tox -e
release -- X.Y.Z` where tox exists); `PATH=$PWD/.venv/bin:$PATH npm run release -- X.Y.Z`; write
`release-notes/vX.Y.Z.md` (no TODO left) and expand the changelog section (git-cliff gives one line
per squash commit); `node scripts/check-release.mjs vX.Y.Z`; PR; after the merge, on `main`:
`git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z` (release and pages workflows).

## Still open

- GitHub settings: private vulnerability reporting (still off, checked 2026-11-27); Zenodo's
  GitHub integration (not known to be enabled: check whether 0.1.0 and 0.2.0 were archived).
- `tikz-compile` has never run on GitHub (41/41 compiled locally in
  `texlive/texlive:TL2025-historic`).

## Resume

```bash
nvm use                      # .nvmrc says 24; this host has only 22 and 26, tests ran on 26
npm ci
uv venv .venv --python 3.13 && uv pip install --python .venv/bin/python -r tests/requirements-dev.txt
PYTHON=.venv/bin/python npm run fixtures
npm run build:single && npm run lint && npm run check && npm test
PYTHON=.venv/bin/python npm run test:parity
npm run test:e2e             # about 50 min with the pan/zoom suite; needs Ghostscript
npm run test:visual
```

This host is shared (loads of 60–140 on 96 cores were seen); timing measurements taken under load
were discarded, and the e2e helpers have longer limits for it.

## Known limitations

- At 85 mm some panels with long parameter labels or wide tables ask for a fix before export.
- The GOF per-layer facet titles touch the y-axis title in exports.
- The Firefox axe run removes `ariaLabelledByElements` (a crash in Playwright's Firefox under the
  test runner; stock Firefox untested).
- Safari is untested.

## Still blocked on upstream (PhosKinTime)

`phoskintime bundle` and a published schema; manifest fields `known_issues_open`,
`fold_change_baseline`, parameter `label`/`group`/`unit`; data not saved by PhosKinTime (see
`docs/upstream-proposals.md`); `pktengine`.
