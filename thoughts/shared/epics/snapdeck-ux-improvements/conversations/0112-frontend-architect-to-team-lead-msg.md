---
sequence: 0112
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:28:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**Coordination point #4 (kb-path live-count trigger) — escalating per your instruction.** I traced both capture paths in `extension/background.js`:

- **kb path:** `commands.onCommand` → `runCaptureCommand()` → `addScreenshot()` (released). It emits **no** runtime message; the count lands via `await setReport()` straight to IndexedDB (`background.js:227`).
- **popup path:** popup.js fires `ADD_SCREENSHOT` **fire-and-forget then `window.close()`** (`popup/popup.js:24-25`); the released `onMessage` runs `addScreenshot()`, whose count increments only AFTER the user finishes annotating (seconds later).
- IndexedDB writes have **no** change-observer API, and `chrome.storage.onChanged` won't fire (the report lives in IDB, not `chrome.storage`).

**Net:** there is NO observable event that fires when the count actually changes. A second `onMessage`/`onCommand` listener fires at *dispatch* (before annotation) — too early. So a correct, event-driven **live-count trigger (AC5)** and the "re-assert correct steady state after the flash" half of **AC11** require a tiny RELEASED-CODE edit: a `chrome.runtime.sendMessage({type:'SCREENSHOT_ADDED'})` ping after `setReport()` in `addScreenshot()` (bg.js:227), plus after `clearReport()` in `saveReport()` (bg.js:258) and in the `CLEAR_REPORT` handler (bg.js:185). That is released w0 code → per directive #4, a **BOSS released-work defect**. I have NOT pre-baked any kb/w0 edit.

**Released-code-free fallbacks are poor:** (T2) event-initiated bounded POLLING of `GET_STATE` — hacky, needs timers, fragile on cancelled annotations, fights the no-module-state spirit; (T3) re-derive only on the next tab event — violates AC5 "without a tab switch."

**Important nuance:** the MINIMAL AC11 ("no STUCK ✓/!") IS achievable released-code-free — the released `setTimeout` clears the global flash, and my per-`tabId` badge uses tab-specific precedence that cleanly layers over the global (no fight). It's only the "re-assert orange N+1 after capture" that needs the trigger.

**Requesting a ruling:**
- (A) Open the BOSS released-work defect for the ~3-line `SCREENSHOT_ADDED` ping in w0 `addScreenshot`/`saveReport`/`CLEAR_REPORT`, which I'd consume via a NEW top-level `onMessage` listener; OR
- (B) Accept a documented released-code-free fallback (say which) with AC5 softened.

I'm holding **STORY-fe-003 (live-count trigger + flash reconcile)** until you rule. Separately I'm holding fe-001 (pending devops-architect) and fe-002 (pending backend + database confirms) per send-and-wait. Will surface again if replies stall ~5 min.
