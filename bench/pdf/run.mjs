import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { resolve } from 'node:path'
const server = await createServer({ root: resolve('bench/pdf'), configFile: false, server: { port: 5198 }, logLevel: 'silent' })
await server.listen()
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:5198/')
await p.waitForFunction(() => window.__bench, null, { timeout: 600000 })
console.log(JSON.stringify(await p.evaluate(() => window.__bench)))
await b.close(); await server.close()
