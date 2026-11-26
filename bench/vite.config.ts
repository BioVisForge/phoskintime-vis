import { defineConfig } from 'vite'
export default defineConfig({ root: __dirname, server: { port: 5199, fs: { allow: ['..'] } }, publicDir: false, resolve: { alias: { '/fixtures': '../tests/fixtures/out' } } })
