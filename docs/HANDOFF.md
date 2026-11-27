# Handoff (2026-11-27)

## Branch state (all local; nothing pushed, no PR, Pages not deployed)

| Branch | Based on | Content |
|---|---|---|
| `main` | — | `36cac96` Initial commit (origin) |
| `feat/foundation` | `main` | viewer, compare, tests, CI; generated docs assets out of history |
| `feat/export-ui` | `feat/foundation` | exports, UI, fit to width, PDF fidelity |
| `feat/docs-release` | `feat/export-ui` | documentation site, brand, release and tooling files |

Local tags `backup/foundation-pre-clean` and `backup/export-ui-pre-clean` keep the history from
before generated files were removed (about 30 MB). Do not push them; delete them once the PRs are
merged. A clone of the branches without them is about 3 MB.

## Merge plan (stacked squash PRs into protected `main`)

1. PR 1: `feat/foundation` → `main`.
2. PR 2: `feat/export-ui` → `feat/foundation`. After PR 1 is squash-merged:
   `git fetch && git rebase --onto origin/main feat/foundation feat/export-ui`, force-push the
   feature branch (allowed; only `main` is protected) and retarget the PR to `main`.
3. PR 3: `feat/docs-release` → `feat/export-ui`, same steps after PR 2.

## After merging

- `tikz-compile` and `pages` are manual workflows; GitHub offers manual dispatch only once they are
  on `main`. The TikZ compile step was run locally in the same image
  (`texlive/texlive:TL2025-historic`, with udocker): 41 of 41 compiled. The GitHub job itself has
  not run.
- GitHub settings to switch on: Pages source "GitHub Actions"; private vulnerability reporting;
  Zenodo's GitHub integration (before the first release).
- No CI workflow has ever run on GitHub.

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
