// Prepare a release: set the version everywhere (bump-my-version, .bumpversion.toml), prepend the
// changelog section and create the release-notes stub. It does not commit, tag or push.
// Usage: npm run release -- X.Y.Z   (needs git-cliff and bump-my-version; or tox -e release -- X.Y.Z)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: npm run release -- X.Y.Z')
  process.exit(2)
}
const tag = `v${version}`
const current = JSON.parse(readFileSync('package.json', 'utf8')).version
if (version !== current) execFileSync('bump-my-version', ['bump', '--new-version', version], { stdio: 'inherit' })
const today = new Date().toISOString().slice(0, 10)
let cff = readFileSync('CITATION.cff', 'utf8')
cff = /^date-released: /m.test(cff) ? cff.replace(/^date-released: .*$/m, `date-released: "${today}"`) : cff.replace(/^(version: .*)$/m, `$1\ndate-released: "${today}"`)
writeFileSync('CITATION.cff', cff)
if (!readFileSync('CHANGELOG.md', 'utf8').includes(`## [${version}]`)) execFileSync('git', ['cliff', '--unreleased', '--tag', tag, '--prepend', 'CHANGELOG.md'], { stdio: 'inherit' })
const notes = `release-notes/${tag}.md`
if (!existsSync(notes)) writeFileSync(notes, `# PhosKinTime-Vis ${version}\n\n## Highlights\n\n- TODO\n\n## Supported bundle schema\n\nTODO\n\n## Known limitations\n\n- TODO\n`)
console.log(`\nPrepared ${tag}. Next:\n  1. edit ${notes}, check CHANGELOG.md and CITATION.cff\n  2. commit through a pull request\n  3. on main: git tag -a ${tag} -m ${tag} && git push origin ${tag}`)
