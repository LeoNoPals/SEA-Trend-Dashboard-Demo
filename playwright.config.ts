import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: {
    channel: 'chrome',
    headless: true,
    launchOptions: { args: ['--disable-crashpad-for-testing'] },
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
