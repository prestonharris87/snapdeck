---
sequence: 0026
from: product-owner
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T16:39:08Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

✅ Added **"Test: Badge reconciles after a dropped count-tick"** to feature.md's `## E2E test spec` — inserted right before the `### Motion E2E` subsection, so the existing **10 tests + Motion E2E `n/a` are intact (now 11 total)**.

It encodes the BOSS-ratified contract: the `reportCountChanged` `storage.session` tick (`{port,count,ts}`) is a **repaint nudge only**; authoritative count is always the released `GET_STATE {count,port}` reconciled on every wake (SW cold-start + `onActivated`/`onUpdated`). Given N + dropped tick (SW-teardown-mid-write / session wipe / same-ms `ts` collision) + wake → Then badge reconciles to N+1, never drifts. Cites the pairing with fe-003's `droppedTick_wakeReconcilesFromGetState` unit case.

This also closes the open live-count-trigger design question I flagged at decompose — it's now a ratified cross-team contract (w0 emits, fe-003 consumes). Back to standby; ready for `arbitrate` once you've run the Contrarian pass.
