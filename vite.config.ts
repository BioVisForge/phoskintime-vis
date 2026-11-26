import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two builds:
//   `vite build`               -> dist/          (GitHub Pages, synthetic demo bundles copied by scripts/copy-demo.mjs)
//   `vite build --mode single` -> dist-single/   (one self-contained index.html, works offline from file://)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [svelte(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    define: {
      __BUILD_MODE__: JSON.stringify(single ? 'single' : 'pages'),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    worker: { format: 'iife' },
    resolve: {
      alias: Object.fromEntries(['html2canvas', 'dompurify', 'canvg'].map((m) => [m, new URL('./src/lib/export/empty.ts', import.meta.url).pathname])),
    },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
    },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  }
})
