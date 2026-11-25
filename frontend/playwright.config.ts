import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 40000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.QA_WEB_URL || 'http://127.0.0.1:3011',
    viewport: { width: 1440, height: 960 },
    colorScheme: 'dark',
    launchOptions: { executablePath: process.env.QA_CHROMIUM },
    trace: 'retain-on-failure',
  },
})
