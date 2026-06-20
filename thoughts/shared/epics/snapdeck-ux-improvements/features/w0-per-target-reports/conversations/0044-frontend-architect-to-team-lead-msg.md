---
sequence: 0044
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:59:32Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Both final — converged fe-003 to **seam (b)** in one pass (anchored to kb's shipping `flashCleared` write):

**fe-003:**
1. **REMOVED** seam-(a): the `globalThis.__snapdeckReassertActionBadge` fn + its `reassertSeam_*` unit case (dead — kb never calls it). No `globalThis` fn remains in any active section (only the History audit trail references it).
2. **ADDED** the idempotent **`flashCleared` branch** to the existing guarded, key-filtered `storage.session.onChanged` listener (alongside `reportCountChanged`): on `changes.flashCleared.newValue {tabId, ts}` → reconcile that `tabId`'s steady state from `GET_STATE` via the active-tab `currentTargetPort()` path (AC10-clean). Idempotent across kb's timeout-teardown AND rapid-re-press handback fires (each re-reconciles from the SSOT; non-active tabId no-ops). Added `flashCleared_reassertsTabFromGetState` unit case (with idempotency assertion).
3. **Kept** the `reportCountChanged` branch + wake-reconcile + guarded cold-start re-derive — unchanged.
4. **#3 = SOLVED, gap CLOSED** (your seq-136 wording): kb per-`tabId` flash + drop destructive pre-clear + `flashCleared` tick; fe-003's branch re-asserts → shadow gone, error-case gap closed. No w2 forward-flag.
5. **Point-5 verified:** green/gray paint EXPLICIT per-`tabId` empty via `applyIconState` (`setBadgeText({tabId, text:""})`) — they do NOT rely on kb's dropped global badge. The `text:null` fall-through is removed/obsolete. No fe-001 change needed (its contract already uses `text:""`).
6. `moduleLoadsClean_noStorageInMock` holds — the `flashCleared` branch adds NO new top-level `chrome.*` (it's a branch inside the already-guarded listener).

**fe-002:** single-flight + guard-deepen final, PO-confirmed (`approved`).

**All three FE stories `approved` + final** (fe-001/fe-002/fe-003). DAG fe-001→fe-002→fe-003; BE/DB/DO sentinel. Greenlight for decision-memo → security → finalize → DAG/prune → `STORIES_LOCKED`. (Reminder: the PO-owned dropped-tick E2E spec in feature.md is still the one open non-blocking hand-off.) Idle.
