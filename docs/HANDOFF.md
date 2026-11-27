# Handoff (2026-11-27, end of session)

**Rule from the owner: push and open PRs only after the owner confirms.**

## Where to continue

Verification finished on 2026-11-27 (results below); the three branches are pushed and the
stacked PRs are open. Next: merge them in order following the merge plan below; then the
post-merge steps. A Node 24 run has not happened locally; the first CI run covers it.

## Test status at the end of the session

| Branch | Last full result |
|---|---|
| `feat/foundation` `fb7a7e3` | all passed (Node 26): lint, types, unit 44, parity 10, e2e 42, builds, `docs:assets` |
| `feat/export-ui` `8e6d60b` | e2e 73 passed, **1 failed** (Firefox, reordered-params), visual 16, **`docs:assets` failed** |
| `feat/export-ui` `0244bd8` (longer timeouts for both) | all passed 2026-11-27 (Node 26, load ~2): lint, types, unit 82, parity 10, e2e 74 + 18 skipped, visual 16, builds, `docs:assets` |
| `feat/docs-release` | all passed 2026-11-27 (Node 26): lint, types, unit 82, parity 10, e2e 74 + 18 skipped, visual 16, builds, `tox -e lint`, `tox -e docs` (strict build), pre-commit |

The two failures: the Firefox test passed 6 of 6 afterwards and the sample export twice in a row;
the host was at load 60-105. Most likely timeouts (5 s panel render, 30 s click), now longer, but
not proven: the detailed output of the failing run was overwritten.

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
