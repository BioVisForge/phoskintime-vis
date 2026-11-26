// Run the parquet benchmark in Chromium and Firefox; prints JSON.
import { chromium, firefox } from '@playwright/test'
import { createServer } from 'vite'
import { resolve } from 'node:path'
const server = await createServer({ configFile: resolve('bench/vite.config.ts'), server: { port: 5199 } })
await server.listen()
const file = '/@fs' + resolve('tests/fixtures/out/network.pkt/tables/trajectories.parquet')
const out = []
for (const bt of [chromium, firefox]) {
  const b = await bt.launch(); const p = await b.newPage()
  p.on('console', (m) => m.type() === 'error' && console.error(bt.name(), m.text()))
  await p.goto(`http://localhost:5199/?file=${encodeURIComponent(file)}`)
  await p.waitForFunction(() => window.__bench, null, { timeout: 120000 })
  out.push({ browser: bt.name(), version: b.version(), ...(await p.evaluate(() => window.__bench)) })
  await b.close()
}
await server.close()
console.log(JSON.stringify(out, null, 1))
