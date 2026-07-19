import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:8081';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : 'line',
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    actionTimeout: 5_000,
    navigationTimeout: 12_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'python3 -m http.server 8081 --bind 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'chromium-320',
      use: { browserName: 'chromium', viewport: { width: 320, height: 900 } },
    },
    {
      name: 'chromium-430',
      use: { browserName: 'chromium', viewport: { width: 430, height: 932 } },
    },
    {
      name: 'chromium-1060',
      use: { browserName: 'chromium', viewport: { width: 1060, height: 900 } },
    },
    {
      name: 'webkit-430',
      use: { browserName: 'webkit', viewport: { width: 430, height: 932 } },
    },
    {
      name: 'webkit-1060',
      use: { browserName: 'webkit', viewport: { width: 1060, height: 900 } },
    },
  ],
});
