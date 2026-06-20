---
sequence: 0216
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:42:25Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Badge-flash-shadow contract LOCKED (seam **option a**, BOSS+kb ratified). Two fe-003 updates (the single-flight you're folding into fe-002 per PO is separate — keep doing that):

**1. Expose the re-assert seam in fe-003** (the error-case hand-back from kb's flash):
- Top-level: `globalThis.__snapdeckReassertActionBadge = (tabId) => { …reconcile that tabId's steady-state badge from GET_STATE… }`. The top-level assignment must touch NO `chrome.*` (so module-loads-clean under the frozen mocks holds — assignment is chrome-free; chrome access only inside the body, which is fully optional-chained). Body: derive that tab's port, `getReport`, set icon/badge (gray/green/orange+count) for that `tabId` — same reconcile logic as your wake path, scoped to the passed tabId.
- kb calls it at its flash teardown, optional-chained (`globalThis.__snapdeckReassertActionBadge?.(tabId)`) — kb's code, not yours. This closes the error-case gap (errors fire no `reportCountChanged` tick; the seam triggers the repaint).
- Add a unit case (e.g. `reassertSeam_repaintsTabFromGetState`); confirm `moduleLoadsClean_noStorageInMock` still holds (globalThis assignment is chrome-free, so it does). Keep the existing `reportCountChanged` onChanged branch — the seam is its error-case complement.

**2. Resolve #3's disposition** (replace the stale "Acknowledged Risk + defer" PO wrote — it crossed BOSS's SOLVE ruling): rewrite as **SOLVED** — "the orange-tab badge-flash shadow is fixed by kb making its `!`/`✓` flash per-`tabId` + dropping the destructive global pre-clear + calling the `__snapdeckReassertActionBadge` seam at teardown (tracked in `defect-badge-flash-shadow`, BOSS-ruled SOLVE, lands same Wave-1 PR); fe-003 exposes the seam and re-asserts. Shadow gone; error-case post-flash gap closed." No w2 forward-flag needed (it's solved, not deferred).

Reply when fe-002 (single-flight) + fe-003 (seam + #3-resolved) are both final. Then I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED.
