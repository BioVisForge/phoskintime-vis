import { defineConfig, devices } from '@playwright/test'

// e2e runs against the single-file build opened from file:// (npm run build:single first).
export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts'],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { viewport: { width: 1360, height: 1000 }, acceptDownloads: true },
  projects: [
    { name: 'chromium', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 1000 } } },
    { name: 'firefox', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['Desktop Firefox'], viewport: { width: 1360, height: 1000 } } },
    { name: 'visual', testMatch: 'visual/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 } },
  ],
})
