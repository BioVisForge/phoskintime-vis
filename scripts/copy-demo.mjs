// Copy synthetic spec-fixture bundles into dist/demo/ and the generated docs assets (screenshots,
// gallery, sample exports; npm run docs:assets) into dist/docs/ for the GitHub Pages demo.
import { mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs'
mkdirSync('dist/demo', { recursive: true })
for (const n of ['small-protwise', 'network', 'network-after-fix']) copyFileSync(`tests/fixtures/out/${n}.pkt.zip`, `dist/demo/${n}.pkt.zip`)
console.log('demo bundles copied to dist/demo/')
let docs = 0
for (const d of ['docs/screenshots', 'docs/samples/exports']) {
  if (!existsSync(d)) continue
  cpSync(d, `dist/${d}`, { recursive: true })
  docs++
}
console.log(docs ? 'docs assets copied to dist/docs/' : 'no docs assets found (run npm run docs:assets first)')
