# Handoff (updated 2026-11-27, feat/wasm-perf)

**Rule from the owner: push, open PRs, tag or deploy only after the owner confirms.** Claude Code's
auto mode blocks `gh pr merge`; the owner runs `gh pr merge <n> --squash` once a PR is green.

## State

`main` holds the three squash-merged PRs: #1 viewer and comparison (`568c3ee`), #2 exports and UI
(`0128ce4`), #3 documentation site, brand and release tooling (`a22b4e5`). All CI jobs passed on
each PR (GitHub runners, Node 24). The feature branches are deleted on GitHub.

- **Ruleset `main`** (id 28234538, no bypass): PR required (0 approvals, threads resolved), squash
  only, branch up to date, no force-push or deletion, linear history; required checks: Lint and
  type check, Unit and parity tests, Build (single file + pages), End-to-end (Chromium + Firefox,
  file://), Documentation (site, screenshots, gallery). Classic branch protection is still on too.
- **Pages**: source is GitHub Actions; the `pages` workflow runs on `v*` tags and by hand; the
  `github-pages` environment accepts `main` and `v*` tags. First deploy by hand on 2026-11-27.
- **Fixture bundle ids differ between machines** (floats differ in the last bits between CPUs;
  GitHub's runners gave other ids than the development host). Tests read ids from the generated
  manifests (`bundleId()`/`shortId()` in `tests/e2e/helpers.ts`); never hard-code them.

## feat/wasm-perf (local, not pushed)

Performance work on the existing panels, CPU only (decision 0006, `docs/performance-profile.md`,
`docs/performance.md`). Profile first (`scripts/profile.mjs`), then: fast canvas dot layer on
screen (proxy rows keep SveltePlot's scales; exports unchanged), one canvas draw per frame and
none when the scale values are unchanged, pan/zoom (GOF overall, raw lines), cheaper brushing,
bitwise-identical JS fixes for quantiles/KDE/raw-lines sort, lazy async zip inflate, and the
Firefox export fit fix (SVG text measured by its glyph box). No WebAssembly: the tiny-skia spike
(`bench/wasm-raster/`) was slower than Canvas2D. New fixture `gof-100k` (102,868 GOF points;
`make_fixtures.py` writes it with the others; the other fixtures' files are unchanged, their zips
differ only in timestamps). Visual baselines changed: listed in the PR description.

- `?fast=0` turns the fast layers off; `tests/e2e/fast-layers.spec.ts` compares both pixel by pixel.
- `scripts/frames.mjs [chromium|firefox]`: frame intervals during pan/zoom/brush.
- `scripts/screen-vs-export.mjs`: gallery section "Screen vs export" (part of `docs:assets`).

## Still open

- Tag 0.1.0 (`npm run release` / `tox -e release`) once ready; that also deploys the site.
- GitHub settings: private vulnerability reporting; Zenodo's GitHub integration (before the
  first release).
- `tikz-compile` has never run on GitHub (41/41 compiled locally in
  `texlive/texlive:TL2025-historic`).
- Local only: tags `backup/foundation-pre-clean` and `backup/export-ui-pre-clean` (about 30 MB of
  pre-clean history). Never push them; delete when no longer needed.

## Resume

```bash
nvm use                      # .nvmrc says 24; this host has only 22 and 26, tests ran on 26
npm ci
uv venv .venv --python 3.13 && uv pip install --python .venv/bin/python -r tests/requirements-dev.txt
PYTHON=.venv/bin/python npm run fixtures
npm run build:single && npm run lint && npm run check && npm test
PYTHON=.venv/bin/python npm run test:parity
npm run test:e2e             # about 16 min; needs Ghostscript
npm run test:visual
```

This host is shared and was at a load of 60–105 on 96 cores during the last runs; two timeouts
seen then led to longer limits in the e2e helper and the sample export script.

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
