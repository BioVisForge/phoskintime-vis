// Copy synthetic spec-fixture bundles into dist/demo/ for the GitHub Pages demo.
import { mkdirSync, copyFileSync } from 'node:fs'
mkdirSync('dist/demo', { recursive: true })
for (const n of ['small-protwise', 'network', 'network-after-fix']) copyFileSync(`tests/fixtures/out/${n}.pkt.zip`, `dist/demo/${n}.pkt.zip`)
console.log('demo bundles copied to dist/demo/')
