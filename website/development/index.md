# Development

| Task | Command |
|---|---|
| Install | `npm ci` and `pip install -r tests/requirements-dev.txt` |
| Example bundles | `npm run fixtures` |
| Develop | `npm run dev` |
| Checks | `npm run lint && npm run check && npm test && npm run test:parity` |
| Browser tests | `npm run build:single && npm run test:e2e` (needs Ghostscript) |
| Screenshots and samples | `npm run docs:assets` |
| This site | `pip install -r website/requirements.txt`, then `npm run docs:build` |
| Logo and favicons | `npm run brand` (needs fontTools) |
| Prepare a release | `npm run release -- X.Y.Z` (needs git-cliff) |

## Local hooks and Python tasks

```bash
pip install pre-commit tox
pre-commit install        # commit: formatting, ruff, eslint; push: type check and unit tests
tox                       # ruff, fixtures, parity
```

## Archiving on Zenodo

`.zenodo.json` holds the metadata Zenodo reads for each GitHub release. Turn the repository on in
Zenodo's GitHub settings once, before the first release; the DOI can then be added to
`CITATION.cff`.

## Releasing

1. `tox -e release -- X.Y.Z` (or `npm run release -- X.Y.Z` with bump-my-version installed) sets
   the version everywhere listed in `.bumpversion.toml` (including `.zenodo.json` and
   `CITATION.cff`), prepends the changelog and creates `release-notes/vX.Y.Z.md`.
2. Edit the notes and open a pull request.
3. After it is merged, tag `main`: `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`.
4. The release workflow checks that the versions agree, runs every test and publishes the GitHub
   release with the single-file viewer, a zip with the example bundles and `SHA256SUMS`.

## Publishing this site

The **pages** workflow runs when a `vX.Y.Z` release tag is pushed, so the site follows the
releases. It publishes the site, the live demo under `demo/` and the screenshot gallery under
`gallery/`. To redeploy between releases, run it by hand (Actions → pages → Run workflow). The
repository's Pages source is **GitHub Actions**, and the `github-pages` environment accepts `main`
and `v*` tags.

Design decisions are recorded in
[`docs/decisions/`](https://github.com/BioVisForge/phoskintime-vis/tree/main/docs/decisions).
