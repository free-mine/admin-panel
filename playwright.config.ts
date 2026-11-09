import { defineConfig } from '@playwright/test'

export default defineConfig({
  workers: 3,
  timeout: 30000,
  testDir: './tests',
  fullyParallel: true,
  outputDir: './.tmp/test-results',
  webServer: {
    timeout: 30000,
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    trace: 'retain-on-failure',
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1040 },
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === 'win32' ? 'msedge' : undefined),
  },
})
