---
sequence: 0149
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:09:23Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Follow-up — BOSS elevated the lossy-tick note to a **fe-003 design requirement** (not just FYI) and added a specific test. Two precise additions on top of my last message:

1. **Design requirement (make it explicit in fe-003):** the badge's *authoritative* source is the released `GET_STATE {count,port}`, reconciled on **every wake** (SW startup + `onActivated`/`onUpdated`); the `reportCountChanged` tick is a **repaint nudge only, never source of truth.** Fold the count reconcile into fe-002's *existing* green/gray wake path (same code path — don't add a parallel mechanism).

2. **New E2E (required by BOSS):** assert **badge-correct-after-a-dropped-tick** — simulate a missed/dropped tick, then fire a wake event, and assert the badge reconciles to the correct count from `GET_STATE` (proving the badge never drifts when the lossy stream drops a tick). Add this to fe-003's E2E + a matching unit case.

That's the complete set for fe-003's consumer design; nothing else changes. Still HOLD the consumer-half *implementation* until I relay w0's `FEATURE_READY` — but bake these design/test requirements into the held story now so it's final-on-arrival.
