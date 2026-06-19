---
sequence: 0194
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:38:36Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Following up — feature.md still shows 10 E2E tests; the dropped-tick E2E I asked for isn't on disk yet. Please add it now (then back to standby). All FE stories are final, so this is the last item before I run the Contrarian pass.

Append ONE test to feature.md's `## E2E test spec (written by Product Owner)` section (keep the existing 10 + Motion E2E `n/a` intact):

> ### Test: Badge reconciles after a dropped count-tick
> **Given** the current target (port P) has an in-progress report with N screenshots and its tab is active (badge orange, count N)
> **When** a screenshot is added but the `reportCountChanged` `storage.session` tick is NOT delivered (dropped on SW teardown mid-write, lost to a session wipe, or a same-ms `ts` collision), and then a wake event fires (SW cold-start, or `tabs.onActivated`/`onUpdated` for that tab)
> **Then** the badge reconciles from the released `GET_STATE {count, port}` to the correct count (N+1) — it never drifts from the authoritative report count, because the tick is only a repaint nudge.

Reply with confirmation once it's written. Thanks.
