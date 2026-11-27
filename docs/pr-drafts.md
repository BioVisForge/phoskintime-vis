# PR descriptions (drafts; delete this file before opening PR 3)

---

## PR 1: feat: offline viewer and run comparison for PhosKinTime run bundles
`feat/foundation` → `main`

**Summary.** Svelte 5 + SveltePlot viewer for `<run>.pkt` bundles: schema validation with version
adapters, sha256 verification, protwise and networkmodel panels with parity references, run
comparison with report export, flagged What-if view against a mock engine. DRAFT 1.0 bundle
contract and synthetic spec fixtures. CI workflows and a manual Pages demo. Generated screenshots
are not in git (`npm run docs:assets`, CI artifact).

**Tests** (local, Node 26): lint and type check clean; unit 44/44; parity 10/10 (rtol 1e-9);
e2e 42/42 (Chromium and Firefox, `file://`); both builds and `docs:assets`. CI has not run yet.

**Measured performance** (`network` fixture, single runs): open → first panel 3,347 ms Chromium /
5,442 ms Firefox; all files verified 5,117 / 8,038 ms; comparison load 1,523 / 6,605 ms; single
file 995,577 B.

**Known limitations.** GOF is the heaviest panel; Firefox 1.5–4× slower; no figure export yet and
a symlog tick defect on the steady-state panel (both addressed in PR 2).

**Upstream blockers.** No `phoskintime bundle` command or published schema; manifest fields
`known_issues_open`, `fold_change_baseline`, parameter `label`/`group`/`unit`; data not saved
(`docs/upstream-proposals.md`); no `pktengine`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 2: feat: publication exports and a question-driven UI
`feat/export-ui` → `feat/foundation` (retarget to `main` after PR 1)

**Summary.** PNG (600 dpi), vector PDF, SVG, CSV and TikZ/PGFPlots export; UI organised by
scientific question with a global protein selector, command palette, inspector and themes.
Fit to width never scales below the chosen pt size without confirmation (fixes: shorter labels,
fewer ticks, next width preset, scale anyway). Fixes found on the way: PDF tick labels and axis
titles were misplaced (`dominant-baseline`); comparison TikZ held every plot of the view; the
protein selector could drop Enter before its list loaded.

**Tests.** PENDING on the final tip (see `docs/HANDOFF.md`). On `0244bd8`: lint and types clean,
unit 82/82, parity 10/10, builds pass. PDF vs PNG on three panels: mean difference 1.6–2.2/255,
under 1 % of blocks differing. TikZ: 41/41 compile in `texlive/texlive:TL2025-historic`.

**Measured performance** (before → after, Chromium / Firefox): first panel 3,313 → 2,935 /
5,387 → 4,765 ms; verified 5,078 → 4,768 / 7,965 → 7,615 ms; comparison load 1,361 → 1,440 /
6,621 → 1,910 ms; single file 995,518 → 1,866,036 B (+87 %, jsPDF and embedded font).

**Known limitations.** At 85 mm several panels with long labels or wide tables ask for a fix; GOF
facet titles touch the y-axis title in exports; Firefox axe removes `ariaLabelledByElements` (a
crash seen only under the Playwright test runner); Safari untested.

**Upstream blockers.** As in PR 1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 3: docs: documentation site, brand and release tooling
`feat/docs-release` → `feat/export-ui` (retarget after PR 2)

**Summary.** Zensical site (new-user guide, generated bundle-schema, engine-API, panel and
TypeScript references, releases), published with the live demo by the manual `pages` workflow;
logo and favicons; `cliff.toml`, changelog, `release-notes/`, tag-driven release workflow,
`.bumpversion.toml`, `CITATION.cff`, `.zenodo.json`, `SECURITY.md`, `CODEOWNERS`; ruff, tox and
pre-commit.

**Tests.** PENDING (full suite). Strict docs build passes; 5,155 links checked, none broken.

**Known limitations.** No per-version docs switcher; the changelog and 0.1.0 date are prepared,
nothing is tagged; tag 0.1.0 before preparing a later version; TypeDoc's build-only dependency
has 3 moderate audit findings; release and Pages workflows have never run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
