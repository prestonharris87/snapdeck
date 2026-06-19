/**
 * Playwright config for Snapdeck extension E2E tests.
 *
 * Chrome MV3 extensions cannot load in the standard Playwright headless shell —
 * they require `chromium.launchPersistentContext` with `--load-extension`.
 * The custom fixtures in src/fixtures.ts own the browser lifecycle entirely;
 * no standard `use.browserName` / `use.headless` applies here.
 *
 * To run:
 *   npx playwright test extension/e2e/src/w1-text-box-autofit.spec.ts \
 *     --config=extension/e2e/playwright.config.ts --reporter=list
 *
 * The `webServer` block starts a Python static server on :7783 (fixture page)
 * and tears it down after all tests complete.
 */
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname, 'src'),
  timeout: 45_000,
  retries: 0,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:7783',
    // Extensions require headed or --headless=new; the fixtures.ts handles launch.
    // Setting headless:false here for documentation — the fixture overrides this anyway.
    headless: false,
  },

  webServer: {
    command: `python3 -m http.server 7783 --directory ${path.join(__dirname, 'fixture')}`,
    url: 'http://localhost:7783',
    reuseExistingServer: true,
    timeout: 8_000,
  },
});
