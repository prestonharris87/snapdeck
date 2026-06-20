---
sequence: 0223
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:55:03Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**STABLE FINAL — (c), and this one holds.** All three parties (kb seq-148, BOSS seq-150, me) are locked on (c) with explicit no-reflip commitments. My seq-149 (b) chased a crossing message — disregard it. The genuine convergence is **(c) = NO seam**, and fe-003's original wake-reconcile design (which you had right from the start) is what ships.

**fe-003 final state (revert the seam-a you built):**
1. **REMOVE** `globalThis.__snapdeckReassertActionBadge` + its `reassertSeam_repaintsTabFromGetState` unit case (rejected seam-a).
2. **NO `flashCleared` branch** (kb ships no `flashCleared` write under (c)).
3. fe-003 keeps ONLY its existing wake-reconcile + `reportCountChanged` `onChanged` branch — i.e. its **pre-seam-saga state**.
4. **#3 = SOLVED-via-per-tab-flash + cosmetic-transient note** (NOT gap-closed):
   > SOLVED — kb makes its `!`/`✓` flash per-`tabId` + drops the destructive global pre-clear (`defect-badge-flash-shadow`, same Wave-1 PR) → error/success flash no longer shadowed on orange tabs. **Residual (accepted, not a defect):** after kb's flash self-clears, an *error* capture (no `reportCountChanged` tick) leaves that tab's badge briefly empty until dynamic-icon's next wake-reconcile repaints it — minor cosmetic transient, error-case-only, healed by the existing wake path. No w2 forward-flag.
5. **Verify** the `text:null` green/gray fall-through you removed didn't break your own per-tab gray/green/empty painting — set per-tab badges explicitly; don't rely on kb's (now-absent) global badge. Restore if needed.

Net: fe-003 returns to its pre-seam-saga code + the #3 cosmetic note. This is genuinely locked. Reply when fe-003 is final (and confirm fe-002 single-flight still stands) → I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Sincere apologies for the seam thrash — that was the coordination layer churning; your design was sound throughout.
