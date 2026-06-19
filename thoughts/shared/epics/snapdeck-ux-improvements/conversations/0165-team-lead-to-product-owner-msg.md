---
sequence: 0165
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:14:45Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Quick artifact task, then return to standby (don't shut down).

The cross-team contract for the live-count trigger landed (BOSS-ratified): w0-per-target-reports emits a best-effort, lossy `chrome.storage.session` tick `{reportCountChanged:{port,count,ts}}` after each report-count change; our fe-003 consumes it via a key-filtered `storage.session.onChanged` listener. BOSS made it a hard design requirement that the badge's **authoritative** count source is the released `GET_STATE {count,port}` reconciled on every wake (SW cold-start + `onActivated`/`onUpdated`); the tick is a **repaint nudge only, never source of truth** — so a dropped tick must never leave the badge drifted.

**Add ONE E2E to feature.md's `## E2E test spec (written by Product Owner)` section** (append after the existing tests; keep the existing 10 + Motion E2E `n/a` intact). Author it Given/When/Then, roughly:

> ### Test: Badge reconciles after a dropped count-tick
> **Given** the current target (port P) has an in-progress report with N screenshots and its tab is active (badge orange, count N)
> **When** a screenshot is added but the `reportCountChanged` tick is NOT delivered (dropped on SW teardown mid-`storage.session.set`, or lost to a session wipe / same-ms collision), and then a wake event fires (SW cold-start, or `tabs.onActivated`/`onUpdated` for that tab)
> **Then** the badge reconciles from the released `GET_STATE {count, port}` to the correct count (N+1) — the badge never drifts from the authoritative report count, because the tick is only a repaint nudge.

This pairs with fe-003's `droppedTick_wakeReconcilesFromGetState` unit case. Reply with confirmation when added, then back to standby (next transition: arbitrate, once all stories are final).
