# Release notes

One file per version, named after its tag (`v0.1.0.md`). The release workflow refuses to publish
a tag without its file, and the documentation site lists them newest first.

Write what a user of the viewer needs to know: highlights, anything that changed behaviour,
supported bundle schema versions and known limitations. The commit-level history is in
`CHANGELOG.md`.

To prepare a release: `npm run release -- X.Y.Z` (needs [git-cliff](https://git-cliff.org)).
