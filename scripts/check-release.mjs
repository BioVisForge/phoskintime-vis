// Used by the release workflow and pre-commit: the tag, package.json (and its lock file),
// CITATION.cff, .zenodo.json, .bumpversion.toml, the changelog and the release notes must all name
// the same version.
// Usage: node scripts/check-release.mjs vX.Y.Z | --current (the version in package.json)
import { existsSync, readFileSync } from 'node:fs'

const current = JSON.parse(readFileSync('package.json', 'utf8')).version
const tag = process.argv[2] === '--current' ? `v${current}` : (process.argv[2] ?? '')
const version = tag.replace(/^v/, '')
const problems = []
if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) problems.push(`"${tag}" is not a vX.Y.Z tag`)
if (current !== version) problems.push(`package.json says ${current}`)
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
if (lock.version !== version || lock.packages[''].version !== version) problems.push(`package-lock.json says ${lock.version}`)
const zenodo = JSON.parse(readFileSync('.zenodo.json', 'utf8')).version
if (zenodo !== version) problems.push(`.zenodo.json says ${zenodo}`)
const bump = readFileSync('.bumpversion.toml', 'utf8').match(/^current_version = "([^"]+)"/m)?.[1]
if (bump !== version) problems.push(`.bumpversion.toml says ${bump}`)
const cff = readFileSync('CITATION.cff', 'utf8').match(/^version: "?([^"\n]+)"?$/m)?.[1]
if (cff !== version) problems.push(`CITATION.cff says ${cff}`)
if (!existsSync(`release-notes/${tag}.md`)) problems.push(`release-notes/${tag}.md is missing`)
else if (/\bTODO\b/.test(readFileSync(`release-notes/${tag}.md`, 'utf8'))) problems.push(`release-notes/${tag}.md still has TODO`)
if (!readFileSync('CHANGELOG.md', 'utf8').includes(`## [${version}]`)) problems.push(`CHANGELOG.md has no [${version}] section`)
if (problems.length) {
  console.error(`release ${tag} is not ready:\n  - ${problems.join('\n  - ')}`)
  process.exit(1)
}
console.log(`release ${tag}: versions, changelog and notes agree`)
