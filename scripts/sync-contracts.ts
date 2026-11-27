/**
 * Vendor PhosKinTime's published contracts into contracts/.
 *
 *   npm run sync-contracts -- <phoskintime checkout dir> [git ref]
 *
 * Reads (never writes) the checkout. For each common/bundle/schema/manifest-<X.Y>.schema.json at
 * the ref, it copies the schema to contracts/phoskintime/<X.Y>/manifest.schema.json and writes
 * SOURCE.md with the commit. It FAILS when a vendored major has no adapter in
 * src/lib/contracts/adapters (a breaking upstream change needs a new adapter, not edits across the
 * app). It also copies the engine OpenAPI spec (pktengine/openapi.yaml) when one exists.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, ref = 'HEAD'] = process.argv.slice(2)
if (!dir) {
  console.error('usage: npm run sync-contracts -- <phoskintime checkout> [git ref]')
  process.exit(2)
}
const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' })
const commit = git('rev-parse', ref).trim()
const files = git('ls-tree', '-r', '--name-only', commit).split('\n')
const schemas = files.filter((f) => /^common\/bundle\/schema\/manifest-\d+\.\d+\.schema\.json$/.test(f))
const engineSpec = files.find((f) => /(^|\/)pktengine\/.*openapi\.(ya?ml|json)$/.test(f))

if (!schemas.length) {
  console.log(`upstream bundle schema not available at ${commit.slice(0, 7)} (${ref}); keeping contracts/phoskintime/1.0-draft (DRAFT).`)
}

const adapterSrc = readFileSync('src/lib/contracts/adapters/index.ts', 'utf8') + readFileSync('src/lib/contracts/adapters/v1.ts', 'utf8')
const knownMajors = new Set([...adapterSrc.matchAll(/major:\s*(\d+)/g)].map((m) => Number(m[1])))
let failed = false
for (const f of schemas) {
  const version = /manifest-(\d+\.\d+)\.schema\.json$/.exec(f)![1]
  const major = Number(version.split('.')[0])
  const out = join('contracts/phoskintime', version)
  mkdirSync(out, { recursive: true })
  const body = git('show', `${commit}:${f}`)
  JSON.parse(body) // must be valid JSON
  writeFileSync(join(out, 'manifest.schema.json'), body)
  writeFileSync(join(out, 'SOURCE.md'), `# Contract source: ${version}\n\nVendored from bibymaths/phoskintime \`${f}\` at commit \`${commit}\` (ref \`${ref}\`) by scripts/sync-contracts.ts on ${new Date().toISOString()}.\n`)
  console.log(`vendored ${f} -> ${out}`)
  if (!knownMajors.has(major)) {
    console.error(`BREAKING: upstream schema ${version} has major ${major}, but no adapter handles it. Add src/lib/contracts/adapters/v${major}.ts and register it.`)
    failed = true
  }
}
if (engineSpec) {
  mkdirSync('contracts/pktengine/upstream', { recursive: true })
  writeFileSync(join('contracts/pktengine/upstream', engineSpec.split('/').pop()!), git('show', `${commit}:${engineSpec}`))
  writeFileSync('contracts/pktengine/upstream/SOURCE.md', `Vendored from \`${engineSpec}\` at \`${commit}\`.\n`)
  console.log(`vendored engine spec ${engineSpec}`)
} else console.log('upstream engine (pktengine) spec not available.')
if (failed) process.exit(1)
if (schemas.length) console.log('Now update the adapter `contract` field if the vendored directory changed, and run npm test.')
