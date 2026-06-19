---
sequence: 0011
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:26:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
---

Contrarian 5.5 pass COMPLETE for w1-dynamic-icon-badge. **No `block`.** Counts: **0 block / 3 concern / 2 info.** Landed as `## Contrarian Findings` blocks on fe-002 and fe-003, plus `features/w1-dynamic-icon-badge/stress-test.md`. fe-001 + all 3 sentinels (be/db/do): no findings.

**Top 3 (all concern — each is acknowledge-or-cheap-mitigate, none blocks arbitration):**

1. **fe-002 — `/resolve` probe storm, no single-flight.** `refreshActiveTab()` is re-entrant and driven by 4 overlapping sources (onActivated, onUpdated loading+complete, the fe-003 tick consumer, and fe-003's cold-start re-derive that runs on *every* SW wake). On a fresh localhost nav the cache-bust + concurrent derives both miss the session cache and both fire `findController()` (up to CONTROLLER_TRIES=40 fetches each, verified bg.js:97-109) → ~80 `/resolve` fetches for an unowned port. The "exactly one probe" E2E only holds in the single-event unit harness, not the real browser. → acknowledge as bounded, or add a per-port single-flight map.

2. **fe-003 — "self-heals at the next wake" overstates coverage.** The only realistic tick drop is SW-teardown-coupled (un-awaited `storage.session.set`, bg.js:55); the cold-start re-derive only runs on the next SW wake, and an MV3 SW wakes only on an event. Capture → SW tears down dropping the tick → user idles on the toolbar → no wake → badge under-counts until the next interaction. Bounded/low-consequence and within best-effort scope, but the `droppedTick` test only proves heal-ON-wake. → truth-in-labeling `## Acknowledged Risk`.

3. **fe-003 — orange-tab capture errors are silent.** Chrome's tab-specific badge shadows the global badge, so the released `runCaptureCommand()` `!` error flash (bg.js:140-156) is masked on any orange tab — no failure signal beyond "count didn't increment." Already an in-story aside; recommend elevating to a formal `## Acknowledged Risk` w/ PO sign-off (real fix = BOSS-escalated released-code defect, not an in-feature edit).

**2 info:** fe-002 guard-depth asymmetry (`chrome.tabs.onActivated?.` assumes `chrome.tabs` exists — clean today since all 3 frozen mocks define it; deepen to `chrome.tabs?.` for parity with fe-003); fe-002 multi-window `{currentWindow:true}` + no `windows.onFocusChanged` (scope-acknowledged best-effort).

**Verified-and-dismissed (so PO can trust the pass):** frozen-harness tolerance CONFIRMED SAFE (all 3 mocks lack onActivated/onUpdated/storage/setIcon but define chrome.tabs; double-`?.` guards short-circuit) — this was your #1 hypothesis; deceptive-host parity holds (regex-gate before portOfUrl, bg.js:81); key-filter prevents the resolve-cache self-trigger loop; released-code boundary clean (3 emit sites verified :239/:271/:195, nothing edited); same-ms `ts` collision benign (identical payload ⇒ identical state). One nit: story line citations drifted ~10-50 lines post-6512a12 — seams all exist, grep by symbol at impl. No security escalation. Going idle now (not shutting down).
