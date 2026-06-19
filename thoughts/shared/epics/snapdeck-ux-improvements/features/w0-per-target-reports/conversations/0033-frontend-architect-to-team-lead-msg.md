---
sequence: 0033
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:11:48Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Folded in — fe-003 now carries the robustness posture:

- **Lossy-by-design → nudge, not log:** added the explicit line that `onChanged` is a NUDGE; the count is always reconciled from the released `getReport`/`GET_STATE` SSOT at wake points, with the tick only repainting between reconciliations. Notes the drop-on-teardown, session-wipe, and same-ms byte-identical-payload cases.
- **SW cold-start wake point:** added a top-level **feature-detect-guarded** re-derive — `if (chrome.storage?.session && chrome.action?.setIcon) void refreshActiveTab();`. MV3 re-evals the SW top level on every wake, so a tick dropped mid-teardown self-heals on the next wake (not just the next tab switch). The guard keeps module load clean under the frozen no-`storage`/no-`setIcon` mock → **gate-2 criterion #1 stays green** (condition false → no call → no unhandled rejection).
- **Added** a validation item + a `coldStart_rederivesActiveTab_whenApisPresent` unit case (pairs with `moduleLoadsClean_noStorageInMock`).
- **Reconciled fe-002:** its restart note (which previously said "no top-level auto-execute") now points to fe-003's guarded cold-start re-derive, so the two stories don't contradict. fe-002's own restart path still relies on tab events; fe-003 adds the wake self-heal.

This strengthens AC7 (restart) without new contract/shape change. Consumer half still HELD for your w0 `FEATURE_READY`; reconcile + robustness posture are final. Idle.
