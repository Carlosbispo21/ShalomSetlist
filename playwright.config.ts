import { defineConfig, devices } from '@playwright/test';
import {fileURLToPath} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('./.playwright-browsers',import.meta.url));
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:4173', headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'tablet', use: { channel:'chrome', viewport: { width: 1180, height: 900 } } },
    { name: 'phone', use: { channel:'chrome', ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name:'ipad-webkit', testMatch:/ipad\.spec\.ts|directors\.spec\.ts|pdf-fallback\.spec\.ts|program\.spec\.ts/, use:{browserName:'webkit',channel:undefined,viewport:{width:1024,height:768},deviceScaleFactor:2,hasTouch:true,isMobile:true} },
    { name:'ipad-legacy-apis',testMatch:/ipad\.spec\.ts/,use:{browserName:'webkit',channel:undefined,viewport:{width:1024,height:768},hasTouch:true,isMobile:true} }
  ],
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }
});
