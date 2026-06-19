---
sequence: 0131
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:52:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BOSS re-ratified storage.session (runtime.sendMessage fully dropped) and **locked the `node --test` acceptance criteria for fe-003's consumer** — encode these verbatim in fe-003's `## Unit tests` so it maps to BOSS's gate-2 integration check:

1. **Registration no-ops when `chrome.storage` is absent → the module loads clean.** (Test: load merged `background.js` under a chrome mock with NO `storage` key; assert no throw at module-load. This is what keeps per-target's + the other frozen suites green when they load our merged file.)
2. **With `storage.session` stubbed:** an `onChanged` event for `reportCountChanged: {port, count, ts}` updates the **right tab's** badge (orange if count>0, green if count==0), and is **`reportCountChanged`-key-filtered** (a write to the `/resolve` cache key does NOT trigger a badge re-derive).

Same guards I sent before (optional-chained top-level registration + strict key-filter) — BOSS verified both against the real frozen mock. Nothing new to design; just make fe-003's test section assert exactly these two. Continue: finalize fe-003's reconcile half now; HOLD the trigger/consumer half until w0 signals FEATURE_READY (I'll relay). And please confirm fe-001/fe-002's top-level `tabs.onActivated`/`onUpdated`/`action.setIcon` registrations are likewise optional-chained (module-loads-clean under the no-tabs.onActivated/no-storage mock), revising if not.
