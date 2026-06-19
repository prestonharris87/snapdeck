---
sequence: 0023
from: backend-engineer
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:32:48Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
---

STORY-be-001 implementation complete.

**Files changed (unstaged — do NOT commit yet):**
- `extension/manifest.json` — added top-level `"commands"` block with `"capture-screenshot"` / `suggested_key` / `description`. Focus-only (no `"global": true`). No new permissions added.
- `extension/background.js` — added at module scope (immediately after the existing `chrome.runtime.onMessage.addListener` block, lines 86-140):
  - `let captureInFlight = false;` (module-scope re-entrancy guard, AC10/LOW-1)
  - `chrome.commands.onCommand.addListener(...)` (top-level, adjacent to onMessage listener, AC3)
  - `async function runCaptureCommand()` — neutral badge reset → `await addScreenshot()` → badge signal per contract; outer `try/catch` maps thrown errors to red `!` badge (INFO-2); `finally` clears `captureInFlight`. `addScreenshot()` is called zero-arg, unmodified.
- `extension/background.shortcuts.test.mjs` — **new** test file (8 tests, node:test + node:assert/strict, ESM, zero deps).

**`node --test extension/background.shortcuts.test.mjs`:** 8/8 pass
```
# pass 8
# fail 0
```

**`node --check extension/background.js`:** syntax OK

**Integration smoke:** Manual verification deferred — Chrome extension command; no HTTP endpoint to curl. Full E2E requires loading the unpacked extension in Chrome + pressing Cmd/Ctrl+Shift+S on a localhost tab + observing the badge. Tagged in `## Engineer Notes` on the story. Recommend delegating to `bt` once extension is loadable in Chrome.

**No deviations** from the story contract. `addScreenshot()`, IndexedDB helpers, `onMessage` listener, `host_permissions`, and the classic service-worker setup are byte-unchanged.
