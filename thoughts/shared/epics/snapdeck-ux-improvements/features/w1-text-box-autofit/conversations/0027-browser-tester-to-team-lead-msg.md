---
sequence: 0027
from: browser-tester
to: team-lead
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T17:15:42Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

**bt kickoff assessment — w1-text-box-autofit**

**Harness readiness: MOSTLY READY — one item needs a decision**

---

## What's confirmed available

- **Playwright 1.61.0** (`@playwright/test`) available via `npx` ✓
- **Playwright 1.58.0** available at `/opt/homebrew/bin/playwright` ✓
- **Playwright Chromium builds** installed: versions 1208 + 1223 (at `~/Library/Caches/ms-playwright/chromium-1223/`) ✓
- **Google Chrome.app** installed in `/Applications/` ✓ (full extension support)
- **Node 22.20.0** ✓

## What doesn't exist yet (I bootstrap at `run` time)

- **`extension/e2e/`** — the Playwright E2E workspace directory, `playwright.config.ts`, `src/fixtures.ts`, and `src/w1-text-box-autofit.spec.ts` all need to be created. That's my job; I'll do it when you SendMessage me `run` mode.

## Key constraint: Chrome extension + headless mode

Chrome MV3 extensions don't work in standard Playwright headless mode (`chromium_headless_shell`). The spec must use either:

- **`--headless=new`** — new Chromium headless that supports extensions. Playwright 1.61 + Chromium 1223 supports this. I'll use it in `playwright.config.ts` as the default.
- OR **headed mode** — works but requires a display; macOS is fine. This is the fallback.

I'll configure `launchPersistentContext` with `--headless=new`, `--disable-extensions-except`, and `--load-extension` pointing at `extension/`. The MCP browser session **cannot** be used for extension E2E (it's a standalone headless Chromium with no extension loading) — these must be CLI-run `npx playwright test` specs.

## Localhost fixture target page — do I create one?

The extension content scripts inject only into `http://localhost/*`. E2E specs need to `page.goto()` an actual localhost page. Options:

1. **I create `extension/e2e/fixture/target.html`** (a minimal blank page) and serve it with `python3 -m http.server` inside the spec's `globalSetup` — self-contained, no external server needed.
2. **User runs a localhost server before the spec** — less friction in CI but requires manual step.

**I'll go with option 1** (self-contained Python fixture server in `globalSetup`) unless you advise otherwise. The fixture page just needs to be a blank HTML page at `http://localhost:7783/` (picking an unlikely-colliding port).

## Triggering the editor in specs

The editor is triggered via `chrome.runtime.sendMessage({type:'ANNOTATE', image, model})`. From within a Playwright spec:

- The background service worker context is accessible via `context.serviceWorkers()`.
- I'll use `serviceWorker.evaluate()` to call `chrome.tabs.sendMessage(tabId, {type:'ANNOTATE', ...})` to open the editor on the fixture page.
- The resolve payload comes back as the `sendResponse` — I'll capture it by injecting a listener on the page side before triggering ANNOTATE.

This is standard Playwright extension testing. The E2E assertions (Konva node state, model items, transformer visibility) will use `page.evaluate()` to inspect in-page state.

## Summary

| Item | Status |
|------|--------|
| Playwright available | ✓ ready |
| Chromium with extension support | ✓ ready (1223 + `--headless=new`) |
| `extension/e2e/` workspace | 🔧 I create at `run` time |
| Localhost fixture page | 🔧 I create at `run` time (self-contained) |
| MCP browser for extension tests | ✗ not applicable (CLI only) |
| Smokey request mode from `fe` | ✓ I'll use MCP for any non-extension page inspection; for extension state I'll use a quick CLI node script |

**No blockers. I'm idle-warm and ready for `fe` to SendMessage me for smoke requests, and for you to SendMessage me `run` mode when the stories are done.**
