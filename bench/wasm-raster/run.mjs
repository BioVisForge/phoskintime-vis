import { chromium, firefox } from '@playwright/test'
import { resolve } from 'node:path'
for (const bt of [chromium, firefox]) {
  const b = await bt.launch(); const p = await b.newPage()
  await p.goto('file://' + resolve('bench/wasm-raster/bench.html'))
  for (const [W, H, lw] of [[800, 500, 0.6], [2000, 1250, 3.75], [4000, 2500, 7.5]]) console.log(bt.name(), JSON.stringify(await p.evaluate(([W, H, lw]) => window.run(W, H, lw), [W, H, lw])))
  await b.close()
}
