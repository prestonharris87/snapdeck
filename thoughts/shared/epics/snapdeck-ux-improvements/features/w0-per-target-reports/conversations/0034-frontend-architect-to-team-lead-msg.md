---
sequence: 0034
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:13:47Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Both BOSS additions baked into the held fe-003 (final-on-arrival):

1. **Design requirement (explicit `🔒` block):** authoritative count source = released `GET_STATE {count,port}` (= `currentTargetPort()` + `getReport().screenshots.length`), reconciled on **every wake** (SW cold-start + `onActivated`/`onUpdated`); the `reportCountChanged` tick is a **repaint nudge, NEVER source of truth**. Explicitly states the reconcile **reuses fe-002's existing `refreshActiveTab` wake path — no parallel count mechanism**, and that `newValue.count` is NOT trusted as authoritative (only available for the optional best-effort non-active-tab multi-window repaint).

2. **Dropped-tick correctness:** added the BOSS-required check two ways —
   - **Validation item:** badge-correct-after-a-dropped-tick (set report to a new count WITHOUT firing `onChanged`, fire a wake event, assert badge reconciles from `GET_STATE`).
   - **Unit case:** `droppedTick_wakeReconcilesFromGetState`.

**One hand-off flag:** the matching **E2E spec belongs in feature.md (PO-owned)** — I added it as a story-level validation/unit requirement, but `product-owner` should author the formal "dropped tick → wake → badge reconciles" E2E in feature.md's `## E2E test spec` so it's in the canonical assertion set. Flagging for your relay to PO (it's currently in standby).

Nothing else changes. Consumer-half implementation still HELD for your w0 `FEATURE_READY`; design + tests are now final. Idle.
