---
sequence: 0217
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:43:36Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**CORRECTION — disregard my previous "add the reassert seam" message.** BOSS withdrew the seam (deemed it over-engineering). FINAL ruling: **NO seam, fe-003 code UNCHANGED.**

- Do NOT add `globalThis.__snapdeckReassertActionBadge`, NO `flashCleared` branch, NO seam unit case. fe-003 keeps its existing wake-reconcile + the `reportCountChanged` `onChanged` branch exactly as they are.
- **ONLY** update #3's disposition narrative to the no-seam SOLVED framing:
  > **SOLVED** — kb makes its `!`/`✓` flash per-`tabId` + drops the destructive global pre-clear (tracked in `defect-badge-flash-shadow`, BOSS-ruled SOLVE, lands the same Wave-1 PR), so the capture error/success flash is no longer shadowed on orange tabs. **Residual (accepted, not a defect):** after kb's flash self-clears, an *error* capture (which fires no `reportCountChanged` tick) leaves that tab's badge briefly empty until dynamic-icon's next wake-reconcile (`onActivated`/`onUpdated`/cold-start) repaints it — a minor cosmetic transient, error-case-only, healed by the existing wake path. No fe-003 code change; no seam; no w2 forward-flag.

That's the only fe-003 edit. Continue folding the single-flight + guard-deepen into fe-002 (per PO). Reply when **fe-002 (single-flight)** + **fe-003 (#3 narrative resolved)** are both final — then I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Sorry for the seam whiplash; BOSS converged late.
