---
sequence: 0219
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:46:27Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**DEFINITIVE FINAL on the badge-flash defect — anchor to BOSS's seq-137 ruling, ignore ALL my prior seam messages** (I sent you seam-a, then no-seam, then seam-b — the contract whiplashed via crossing BOSS rulings; BOSS has now decisively LOCKED it).

**THE answer: (c) — NO seam. fe-003 code UNCHANGED.**
- **Revert/discard** anything you started from my seam messages: NO `globalThis.__snapdeckReassertActionBadge` (seam-a), NO `flashCleared` `onChanged` branch (seam-b), no seam unit case. fe-003 keeps EXACTLY its existing wake-reconcile + the `reportCountChanged` `onChanged` branch — i.e. its state from before the seam saga (commit `a010c1b`-era).
- The **only** fe-003 edit is #3's disposition narrative:
  > **SOLVED** — kb makes its `!`/`✓` capture flash per-`tabId` + drops the destructive global pre-clear (`defect-badge-flash-shadow`, BOSS-ruled SOLVE, lands same Wave-1 PR), so the error/success flash is no longer shadowed on orange tabs. **Residual (accepted — BOSS: not a defect):** after kb's flash self-clears, an *error* capture (no `reportCountChanged` tick) leaves that tab's badge briefly empty until dynamic-icon's next wake-reconcile (`onActivated`/`onUpdated`/cold-start) repaints it — a minor cosmetic transient, error-case-only, healed by the existing wake path. No seam; no fe-003 code change; no w2 forward-flag.

This is stable and final — BOSS closed it. The seam whiplash was on the coordination layer, not your design; fe-003's actual code was right all along.

So the ONLY outstanding fe-003/fe-002 work is: **(1) the fe-002 single-flight + guard-deepen** (per PO) and **(2) the fe-003 #3 narrative above.** Reply when both are final — then I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Thanks for riding out the churn.
