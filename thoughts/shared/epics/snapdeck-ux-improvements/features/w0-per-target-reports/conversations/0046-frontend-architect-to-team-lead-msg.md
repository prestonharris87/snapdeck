---
sequence: 0046
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T21:12:23Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

**The (c) revert already landed** — your two reads crossed it (batched lag). Re-grep the STORY (not background.js):
- `grep -n flashCleared STORY-fe-003.md` → only **negations** ("NO `flashCleared` branch"), the History audit trail, and my AC5 flag. The active `flashCleared` `onChanged` branch + `flashCleared_reassertsTabFromGetState` unit case + the seam-b AC11 line are **deleted**.
- `## Cross-team item` / Part-2 / #3 no longer say "gap CLOSED via seam (b)" — they say **SOLVED-by-kb-per-tab-flash (option (c))**.
- Kept: wake-reconcile + the single `reportCountChanged` branch + cold-start + explicit per-tab `setBadgeText({tabId, text:""})` green/gray painting. No `globalThis` fn, no new top-level `chrome.*`; `moduleLoadsClean` holds.

So fe-003 IS at (c). The seam question is closed — agreed, no seam.

**The one open item is NOT the seam — it's my AC5 finding (your messages predate it).** I kept #3 as "SOLVED-by-kb + ⚠️ AC5 residual flagged" rather than your "**error-case-only** cosmetic," because I verified that wording is **false against kb's shipped code**:
- kb's `clearFlash` (`background.js:131-139`) is UNCONDITIONAL (`setBadgeText({tabId, text:""})`), run by `scheduleFlashClear` on BOTH success (2 s) and error (4 s).
- Keyboard **success**: tick paints orange `N+1` → kb `✓` overwrites → kb's +2 s `clearFlash` blanks to `""` → count gone until next wake. So it's NOT error-only.

**One small kb-side fix makes your "error-only" wording true AND keeps fe-003 no-seam:** guard `clearFlash` — `await chrome.action.getBadgeText({tabId})`, clear only if it's still kb's own `✓`/`!`. Then a tick-painted count survives (success preserved → AC5 holds) and only a lingering error `!` clears.

**Please rule (one line):**
- **(i)** kb adds the guarded `clearFlash` → I flip #3 to your clean "error-only cosmetic residual" wording. ✅ my recommendation; OR
- **(ii)** accept the broader residual as-is → I word #3 accurately as "keyboard success+error both briefly empty until next wake, accepted" (NOT error-only).

Either way fe-003 stays (c)/no-seam and needs no further code change. fe-002 final. Just need your (i)/(ii) to finalize #3 wording → then STORIES_LOCKED.
