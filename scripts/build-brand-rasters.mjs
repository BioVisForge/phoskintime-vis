// Rasterise assets/brand/*.svg to the PNG and ICO favicons (Chromium). Run after build_brand.py.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'assets/brand'
const browser = await chromium.launch()
const page = await browser.newPage()
async function png(svgName, size) {
  const svg = readFileSync(`${dir}/${svgName}`, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0">${svg}</body>`)
  return page.screenshot({ omitBackground: true })
}
writeFileSync(`${dir}/logo-512.png`, await png('logo.svg', 512))
writeFileSync(`${dir}/apple-touch-icon.png`, await png('logo.svg', 180))
// ICO container with PNG entries (16, 32, 48)
const images = []
for (const s of [16, 32, 48]) images.push({ s, data: await png('favicon.svg', s) })
const head = Buffer.alloc(6 + 16 * images.length)
head.writeUInt16LE(1, 2)
head.writeUInt16LE(images.length, 4)
let offset = head.length
images.forEach(({ s, data }, i) => {
  const o = 6 + 16 * i
  head.writeUInt8(s, o)
  head.writeUInt8(s, o + 1)
  head.writeUInt16LE(1, o + 4)
  head.writeUInt16LE(32, o + 6)
  head.writeUInt32LE(data.length, o + 8)
  head.writeUInt32LE(offset, o + 12)
  offset += data.length
})
writeFileSync(`${dir}/favicon.ico`, Buffer.concat([head, ...images.map((i) => i.data)]))
await browser.close()
console.log('wrote logo-512.png, apple-touch-icon.png, favicon.ico')
