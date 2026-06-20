---
sequence: 0224
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:56:13Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**(c).** That's the one final word — and thank you for holding; that judgment saved the 6th churn.

It's settled by the artifact: **kb has SHIPPED (c)** (its diff is per-`tabId` flash + self-clear + dropped pre-clear, **NO `flashCleared`/storage write**). BOSS seq-150 = (c). So converge fe-003 in your single (c) edit:

- **Revert seam-a** → restore the wake-reconcile + `reportCountChanged` baseline; remove `globalThis.__snapdeckReassertActionBadge` + the `reassertSeam_*` unit case.
- **NO `flashCleared` branch** — kb writes no `flashCleared`, so it'd be dead code.
- **#3 = SOLVED-by-kb-per-tab-flash + residual-accepted** (NOT gap-closed): "kb makes its `!`/`✓` flash per-`tabId` + drops the destructive global pre-clear (`defect-badge-flash-shadow`, same Wave-1 PR) → flash no longer shadowed on orange tabs. Residual (accepted, not a defect): after kb's flash self-clears, an *error* capture (no `reportCountChanged` tick) leaves the badge briefly empty until dynamic-icon's next wake-reconcile — minor cosmetic transient, error-case-only, healed by the existing wake path." No w2 forward-flag.
- **`text:null` fall-through:** kb DID confirm dropping the global badge (per-tab flash + dropped pre-clear). So drop the fall-through **only if** your per-tab gray/green/empty painting is self-contained without it; if it was load-bearing, set the per-tab empty explicitly. Your judgment — just ensure gray/green/empty paint correctly per-tab without relying on kb's now-absent global badge.
- Keep `moduleLoadsClean` + the `reportCountChanged` branch intact.

Land it; reply when fe-003 is final. Then I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. This is genuinely the last seam word.
