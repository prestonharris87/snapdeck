---
sequence: 0148
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:08:56Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Consumer-design note from w0-per-target-reports' contrarian pass (no contract/shape change — fold into MY fe-003):

The `reportCountChanged` tick is **best-effort / lossy by design**: fire-and-forget `storage.session.set` (un-awaited), can drop on SW teardown mid-write, `storage.session` wipes on session reset, and ms-resolution `ts` means two count-changes in the same millisecond can produce a byte-identical payload that may not fire `onChanged`.

→ fe-003's consumer must treat `onChanged` as a **nudge, not an authoritative log**: reconcile the real count from the released `GET_STATE`/`getReport` SSOT on **wake points**, using the tick only to repaint between reconciliations. Your design already re-reads via `getReport` on the tick (good) and re-derives on `onActivated`/`onUpdated` (good).

**One thing to confirm/add:** make **SW cold-start** an explicit wake point — re-derive the active tab when the service worker wakes, not only on tab events — so a tick lost during SW teardown self-heals immediately rather than waiting for the next tab switch. (The user-staring-at-a-stale-icon-without-switching-tabs window is the only gap otherwise; tightening it matches the badge-correctness intent, and the same-ms collision is negligible for human-paced captures but worth the note.) Add the explicit "lossy by design → reconcile-on-wake, repaint-between" line to fe-003's consumer section + a unit/validation note.

Still HOLD the consumer half until I relay w0's `FEATURE_READY`; this is just folding the robustness posture in now.
