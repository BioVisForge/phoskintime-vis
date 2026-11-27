// Copy synthetic spec-fixture bundles into dist/demo/ so the hosted demo can offer them.
import { mkdirSync, copyFileSync } from 'node:fs'
mkdirSync('dist/demo', { recursive: true })
for (const n of ['small-protwise', 'network', 'network-after-fix']) copyFileSync(`tests/fixtures/out/${n}.pkt.zip`, `dist/demo/${n}.pkt.zip`)
console.log('demo bundles copied to dist/demo/')
