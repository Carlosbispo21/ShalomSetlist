import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'tablet', use: { viewport: { width: 1180, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }
  ],
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }
});
