---
sequence: 0035
from: decision-recorder
to: team-lead
step: inline-msg
run_id: run-20260619-161353-46977
timestamp: 2026-06-19T16:15:33Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

decision-memo-v2.md written to `thoughts/shared/epics/snapdeck-ux-improvements/features/w0-per-target-reports/decision-memo-v2.md`. The memo cites v1 as the baseline (no re-synthesis of the released fe-001/fe-002 decisions) and adds a `## Stories added in v2` section covering STORY-fe-003's chrome.storage.session report-count emission. The three key narrative threads are captured with citations: (1) the transport pivot from `runtime.sendMessage` to `storage.session` (proposed, found to break the frozen harness two ways by the w1-FE-architect, BOSS re-ratified — cited to C1 and STORY-fe-003 § How we're doing it invariant 3); (2) the contrarian's 0-block/2-concern/1-note outcome and the PO's PROMOTE_TO_AC disposition on Finding 1 (two extra no-emit test cases added, hardening "only the success branch emits" across 3 of 4 non-emit paths — cited to conv 0029 and conv 0031); and (3) the accepted-risk best-effort/lossy tick stream (fire-and-forget, drops on SW teardown/session wipe, consumer must reconcile via released `GET_STATE` — cited to STORY-fe-003 § Consumer note). A reusable "frozen-test-tolerance design constraint" section documents that future background.js additions must use optional-chained chrome.* writes and must not add a second onMessage listener. No peer `## Revisions` block is recorded (the w1 seam is a channel-locked cross-feature contract, not a depends_on edge, confirmed conv 0028 and conv 0031). Sources confirmed: all conv 0028–0033 read; file:line citations verified against STORY-fe-003.
