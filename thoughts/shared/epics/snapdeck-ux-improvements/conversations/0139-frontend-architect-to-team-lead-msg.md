---
sequence: 0139
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:00:42Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

✅ **STORY-fe-003** written (add-story mode, single new story) → `stories/STORY-fe-003.md`. Status left `pending` for your PO arbitrate pass — I did NOT self-promote. fe-001/fe-002 untouched.

**What it does:** adds a DRY `emitReportCountChanged(port, count)` helper to `extension/background.js` that writes a `chrome.storage.session` tick (`reportCountChanged: { port, count, ts: Date.now() }`) on every per-port report-count change, so the sibling **w1-dynamic-icon-badge** feature can drive a live toolbar badge. Helper has its OWN null-guard + optional-chained write.

**3 emit sites (verbatim per the locked contract):**
1. `addScreenshot` — after `await setReport(port, r)` (bg.js:227), before `return {ok,count}`; count=`r.screenshots.length`, port=`portOfUrl(tab.url)` local.
2. `saveReport` — inside `if (res.json && res.json.ok)` after `await clearReport(browserPort)` (bg.js:258); count=0, first arg=`browserPort`.
3. `CLEAR_REPORT` handler (bg.js:185) — capture `currentTargetPort()` into a local, clear+emit; count=0; null-guard suppresses the non-target no-op clear.

**2 hard ACs:** (1) null-port guard in the helper (load-bearing at site 3); (2) optional-chained `chrome.storage?.session?.set?.(…)` no-ops when `chrome.storage` is absent → all **25 frozen cases stay byte-for-byte green**, no 2nd `onMessage` listener, return values + IDB write byte-identical. SET_NOTE never emits.

**depends_on:** `[STORY-fe-001]` (same-feature: per-port store + gated port resolution). Cross-feature w1 linkage is PROSE in `## Revisions`, NOT in `depends_on` (per the within-feature-only deps lesson).

**Test file:** new `extension/background.emit.test.mjs` (zero-dep `node --test`, mirrors the bg.reports vm harness) — proves (a) the tick fires `{port,count,ts}` at all 3 sites + no-emit on SET_NOTE/cancelled/failed-save/non-target-clear, and (b) storage-absent → returns + IDB write unaffected, no throw. `effort: 2`, `diff_estimate: substantive`. No peer SendMessage needed (cross-feature contract already BOSS-ratified).
