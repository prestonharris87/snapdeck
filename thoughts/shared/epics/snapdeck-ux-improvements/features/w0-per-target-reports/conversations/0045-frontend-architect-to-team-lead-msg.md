---
sequence: 0045
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T21:09:24Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

fe-003 is reverted to **(c) — NO seam** (removed both the seam-a `globalThis` fn and the seam-b `flashCleared` branch + their unit cases; back to wake-reconcile + single `reportCountChanged` branch). That part's done.

**BUT — I read kb's actually-shipped (c) code and found a real AC5 gap I must flag before STORIES_LOCKED.** Not re-litigating the seam choice — this is an acceptance-criteria failure in (c) as kb shipped it:

- kb's `clearFlash(tabId)` (`extension/background.js:131-139`) is **UNCONDITIONAL**: `setBadgeText({tabId, text:""})`. `scheduleFlashClear` (`:166-174`) runs it on BOTH the success (2 s, `:214`) and error (4 s, `:211`) timeouts.
- **Keyboard SUCCESS trace:** `runCaptureCommand` → `addScreenshot` → `setReport` fires the `reportCountChanged` tick → my `onChanged` paints orange `N+1` → kb's `setFlash` `✓` overwrites it → **kb's +2 s `clearFlash` blanks the tab to `""`**. The orange count is then GONE until the next wake-reconcile (tab switch / reload / cold-start).
- So the residual is **NOT "error-only cosmetic"** as #3's wording assumed — it hits the keyboard **success** path too, and it **fails AC5** ("live count … no tab switch") + the E2Es **"Live increment on the keyboard-shortcut path"** and **"Steady-state-after-flash"**, which both assert the badge shows the count *after the `✓` resets, with no tab switch*. Under (c)-as-shipped it's empty, not `N`.

fe-003 **cannot** fix this alone — there's no post-flash signal under (c) (that's exactly what the seam provided).

**Recommended fix (kb-side, keeps fe-003 no-seam):** make kb's `clearFlash` **GUARDED** — clear only if the tab's badge still shows kb's own `✓`/`!` (an `await chrome.action.getBadgeText({tabId})` check before clearing). Then a tick-painted count survives (success preserved → AC5 holds) and only a genuine lingering error `!` clears to empty → the "error-only cosmetic residual" framing in #3 becomes actually true. (Alternative: re-adopt seam-(b). Your/BOSS's call — I'm not pushing a seam.)

I've recorded this as a ⚠️ flag in fe-003's `## Cross-team item` + validation + History (with the file:line evidence), so the artifact is honest either way. **Requesting your/BOSS reconciliation on the kb `clearFlash` guard before STORIES_LOCKED.** fe-002 single-flight stays final. Holding fe-003's #3 as "SOLVED kb-side + flagged AC5 residual" pending your call.
