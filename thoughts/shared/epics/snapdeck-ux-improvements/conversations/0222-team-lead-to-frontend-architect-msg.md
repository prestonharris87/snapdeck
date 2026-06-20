---
sequence: 0222
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:53:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**GENUINELY FINAL — anchored to kb's actual shipping code (this ends the oscillation).** kb is actively implementing **seam (b)** — the `flashCleared` `storage.session` write (kb seq-147). So fe-003 consumes (b). The contract is now settled by kb's code, not the back-and-forth.

You built **seam (a)** (`globalThis.__snapdeckReassertActionBadge`) from my earlier seq-130 — that's the **rejected** seam (kb never calls it). Bring fe-003 to the seam-(b) end state:

1. **REMOVE** `globalThis.__snapdeckReassertActionBadge` + its `reassertSeam_repaintsTabFromGetState` unit case (dead — kb doesn't call it).
2. **ADD** the idempotent **`flashCleared` branch** to your existing guarded, key-filtered `storage.session.onChanged` listener (alongside `reportCountChanged`): on `changes.flashCleared.newValue {tabId, ts}` → reconcile that `tabId`'s steady state from `GET_STATE` (active-tab `currentTargetPort()` path, AC10-clean). **Idempotent** — kb writes `flashCleared` on BOTH its timeout-teardown AND a rapid-re-press handback (prior tabId). Add `flashCleared_reassertsTabFromGetState` unit case. `moduleLoadsClean` holds (no new top-level `chrome.*`; the onChanged listener already exists).
3. Keep the `reportCountChanged` branch + existing wake-reconcile.
4. **#3 = SOLVED, gap CLOSED** (seq-136 wording): kb per-`tabId` flash + drop destructive pre-clear + `flashCleared` tick at teardown/handback; fe-003's `flashCleared` branch re-asserts → shadow gone + error-case gap closed. (defect-badge-flash-shadow, seam b, same Wave-1 PR.) No w2 forward-flag.
5. **Verify** the `text:null` green/gray fall-through you removed didn't break your own per-tab gray/green/empty painting — your steady-state code must set per-tab badges explicitly, not rely on kb's (now-absent) global badge. Restore/adjust if needed.

This is stable (kb ships b, fe-003 consumes b). I will NOT change it again. Reply when fe-003 is final → decision-memo → security → finalize → DAG/prune → STORIES_LOCKED.
