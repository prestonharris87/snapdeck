---
sequence: 0029
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:05:49Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Contrarian stress-test of STORY-fe-003 complete (single-story add-story mode). Appended ONE `## Contrarian Findings` block to STORY-fe-003.md only; no other file touched. **Tally: 0 block, 2 concern, 1 note** — the locked contract (storage.session + {port,count,ts}) was NOT re-litigated.

**Headline concern (Finding 1, highest value):** the site-2 emit lives inside the nested `if (res.json && res.json.ok)` success branch, and `saveReport` has FOUR must-not-emit paths (no-port / empty-report / no-controller / failed-POST) — but the proposed `## Unit tests` set covers only the failed-POST one. The no-controller and empty-report EARLY returns (above the `if`) are exactly where a future refactor that hoists the emit would land, firing a phantom `{count:0}` tick on a save that didn't clear → w1 badge silently reads 0 while the report still holds N screenshots. Mitigation is minimal and code-free for the design: add one test `saveReport_noController_noEmit` (stub fetch so every `/resolve` probe fails → findController null → early return; assert no tick). This matches my standing pattern — the recurring add-story catch is a guard/test that no test actually owns.

**Finding 2 (concern):** the un-awaited fire-and-forget `.set()` (correct, keeps returns byte-identical) makes the tick stream best-effort/lossy — ticks drop on SW teardown mid-write and storage.session wipes on session reset. The w1 consumer must reconcile via the released `GET_STATE {count,port}` on a wake point, not treat onChanged as a complete log. Recommend a one-line story note (carries to the serialized w1-dynamic-icon-badge consumer); no code change here.

**Finding 3 (note):** (a) the storage.session area is shared non-exclusively with w1-fe-002's /resolve cache — fine today (w0 only writes, no onChanged listener) but record it; (b) `ts:Date.now()` is ms-resolution, so two count-changes in the same millisecond yield a byte-identical payload that may not fire onChanged — rare, absorbed by Finding 2's reconciliation, recorded not actioned.

I verified-to-dismiss the obvious frozen-break vectors: shortcuts suite's full-success addScreenshot reaches site 1 but no-ops (no storage key); reports suite never reaches any handler-based emit site; cumulative `node --test extension/*.test.mjs` is process-isolated per file so the mirrored-vm new file can't cross-contaminate. No block-severity issue — design is additive and well-guarded. Findings flow to you for PO arbitrate; the single actionable ask is the one extra test in Finding 1. Exiting.
