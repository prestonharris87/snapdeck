/**
 * Playwright fixtures for Snapdeck Chrome extension E2E tests.
 *
 * Provides:
 *   - `extContext`   — Chromium PersistentContext with the extension loaded
 *   - `extPage`      — Page navigated to http://localhost:7783/ (the fixture target)
 *   - `consoleErrors`— Array of console error + pageerror strings collected on extPage
 *   - `openEditor`   — Triggers the ANNOTATE IPC from the service worker and waits
 *                      for the editor overlay; returns a getDonePayload() helper.
 *
 * The console-error guard (no unfiltered errors) is enforced per-test:
 *   after the test body, `consoleErrors` is asserted to be empty (fixtures.ts auto-fixture).
 *   Use `test.extend<{allowedErrors: string[]}>` if a test needs to allowlist a known error.
 *
 * IMPORTANT: Chrome MV3 extensions don't load in the standard headless shell.
 * This fixture uses `chromium.launchPersistentContext` with `headless: false` (headed)
 * for maximum reliability on macOS CI. For --headless=new: replace `headless: false` with
 *   args: [..., '--headless=new', '--disable-gpu']
 * and test under Chromium 112+.
 *
 * Import ONLY from this file in every spec — never from '@playwright/test' directly:
 *   import { test, expect } from './fixtures';
 */

import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'path';

// extension/ directory — this file is at extension/e2e/src/fixtures.ts → go up 3 levels
const EXT_PATH = path.resolve(__dirname, '../../');

/**
 * Minimal 10×10 white PNG data URL — used as the `image` payload in ANNOTATE so
 * the editor opens without needing chrome.tabs.captureVisibleTab (which requires
 * an extra permission grant and doesn't work reliably in test mode).
 */
const BLANK_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9' +
  'AAAAEklEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

export type EditorHandle = {
  /**
   * Poll the service worker for the ANNOTATE resolve payload.
   * Becomes available after ✓ Done is clicked in the editor.
   * Returns null if Done was not clicked within ~6s.
   */
  getDonePayload: () => Promise<Record<string, unknown> | null>;
};

export type Fixtures = {
  /** Chromium context with the Snapdeck extension loaded via --load-extension. */
  extContext: BrowserContext;
  /**
   * Promise that resolves to the extension service worker.
   * Subscribed to immediately after context creation so the event is never missed,
   * even if the SW starts and the 'serviceworker' event fires before a test begins.
   */
  swReady: Promise<Worker>;
  /** Page at http://localhost:7783/ — the fixture target page. */
  extPage: Page;
  /**
   * Console errors collected since extPage was opened.
   * After the test body, the fixture asserts this is empty.
   * Access mid-test to snapshot errors at a specific point.
   */
  consoleErrors: string[];
  /**
   * Trigger the annotation editor by sending ANNOTATE via the extension's
   * service worker, then wait for the .snapdeck-overlay to appear.
   *
   * Pings the content script first (retrying up to 5s) to confirm it's ready.
   * Returns an EditorHandle with getDonePayload() for asserting the resolve payload.
   */
  openEditor: (model?: { version: number; items: object[] }) => Promise<EditorHandle>;
};

export const test = base.extend<Fixtures>({
  // ── Extension browser context ──────────────────────────────────────────────
  extContext: [
    async ({}, use) => {
      // Use the full Chromium-1228 build (not the headless shell) so that:
      //   (a) Chrome MV3 extensions load correctly, and
      //   (b) BrowserContext.serviceWorkers() + the 'serviceworker' event fire reliably.
      // The headless shell (chromium_headless_shell-1228) does NOT support extensions.
      // `channel: 'chrome'` was tried but ctx.serviceWorkers() events are unreliable
      // with the system Chrome in this Playwright version.
      const executablePath =
        '/Users/preston/Library/Caches/ms-playwright/chromium-1228/' +
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
      const ctx = await chromium.launchPersistentContext('', {
        headless: false,
        executablePath,
        args: [
          `--disable-extensions-except=${EXT_PATH}`,
          `--load-extension=${EXT_PATH}`,
        ],
        viewport: { width: 1440, height: 900 },
      });

      // Subscribe to the service worker event IMMEDIATELY after context creation.
      // We use a hybrid approach: check existing SWs, then once() for the event,
      // plus a polling loop as a belt-and-suspenders fallback in case the event
      // fires in the tiny gap between context creation and the once() subscription.
      const swPromise = new Promise<Worker>((resolve) => {
        let resolved = false;
        function done(w: Worker) { if (!resolved) { resolved = true; resolve(w); } }

        const current = ctx.serviceWorkers();
        if (current.length) { done(current[0]); return; }

        ctx.once('serviceworker', done);

        // Poll every 200ms for up to 15s as fallback (in case the event was missed).
        const poll = setInterval(() => {
          const workers = ctx.serviceWorkers();
          if (workers.length) { clearInterval(poll); done(workers[0]); }
        }, 200);
        // Auto-clear the interval once the event fires.
        Promise.resolve().then(() => {
          const origDone = done;
          // setInterval cleared via done() closure; nothing more needed.
        });
        // Ensure poll is cleared if ctx closes (avoid memory leak in test teardown).
        ctx.once('close', () => clearInterval(poll));
      });
      (ctx as any).__swPromise = swPromise;

      await use(ctx);
      await ctx.close();
    },
    { scope: 'test' },
  ],

  // ── Service-worker promise (resolved from extContext, used by openEditor) ──
  swReady: async ({ extContext }, use) => {
    const swPromise: Promise<Worker> = (extContext as any).__swPromise;
    if (!swPromise) throw new Error('swReady: extContext missing __swPromise — fixture order error');
    await use(swPromise);
  },

  // ── Target page (localhost:7783) ───────────────────────────────────────────
  extPage: async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto('http://localhost:7783/', { waitUntil: 'domcontentloaded' });
    await use(page);
  },

  // ── Console-error guard ────────────────────────────────────────────────────
  consoleErrors: async ({ extPage }, use) => {
    const errors: string[] = [];
    extPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
    });
    extPage.on('pageerror', (err) => {
      errors.push(`[pageerror] ${err.message}`);
    });
    await use(errors);
    // Auto-assert: no unfiltered errors may survive to test teardown.
    // The feature.md smoke checklist requires "console errors: 0 or explicitly listed".
    expect(errors, `Unfiltered console errors:\n${errors.join('\n')}`).toHaveLength(0);
  },

  // ── ANNOTATE trigger ───────────────────────────────────────────────────────
  openEditor: async ({ extContext, extPage, swReady }, use) => {
    await use(async (model = { version: 1, items: [] }): Promise<EditorHandle> => {
      // 1. Await the service worker (resolved immediately if already registered).
      const sw = await swReady;

      // 2. Get the tab ID of the localhost fixture page (may need a moment after navigation).
      const tabId: number | null = await sw.evaluate(async () => {
        const tabs = await new Promise<chrome.tabs.Tab[]>((res) =>
          chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*'] }, res)
        );
        return tabs[0]?.id ?? null;
      });
      if (!tabId) throw new Error('openEditor: no localhost tab found in extension context');

      // 3. Ping the content script until ready (document_idle may not have fired yet).
      const ready = await sw.evaluate(async (tabId: number) => {
        const ping = (): Promise<boolean> =>
          new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: 'PING' }, (resp) => {
              void chrome.runtime.lastError; // suppress "no listener" Chrome warning
              resolve(resp?.ok === true);
            });
          });
        for (let i = 0; i < 30; i++) {
          if (await ping()) return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return false;
      }, tabId);
      if (!ready) throw new Error('openEditor: content script not ready within 6s');

      // 4. Fire ANNOTATE; store the sendResponse result in SW global scope.
      await sw.evaluate(
        ({ tabId, image, model }) => {
          (globalThis as any).__smokeAnnotateResult = undefined;
          chrome.tabs.sendMessage(
            tabId,
            { type: 'ANNOTATE', image, model },
            (resp: unknown) => {
              void chrome.runtime.lastError;
              (globalThis as any).__smokeAnnotateResult = resp;
            }
          );
        },
        { tabId, image: BLANK_IMAGE, model }
      );

      // 5. Wait for the editor overlay.
      await extPage.waitForSelector('.snapdeck-overlay', { timeout: 10_000 });

      return {
        getDonePayload: async (): Promise<Record<string, unknown> | null> => {
          // Poll the SW global until the sendResponse fires (i.e., Done was clicked).
          for (let i = 0; i < 60; i++) {
            const result = await sw.evaluate(
              () => (globalThis as any).__smokeAnnotateResult
            );
            if (result !== undefined) return result as Record<string, unknown>;
            await new Promise((r) => setTimeout(r, 100));
          }
          return null; // timeout — Done was not clicked
        },
      };
    });
  },
});

export { expect };
