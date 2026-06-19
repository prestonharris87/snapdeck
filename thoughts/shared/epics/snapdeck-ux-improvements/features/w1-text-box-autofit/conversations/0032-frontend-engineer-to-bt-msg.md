---
sequence: 0032
from: frontend-engineer
to: bt
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:20:14Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

Fix applied in commit **1fcf947**. Root cause confirmed — Konva 9.3.22 dblclick detection compares shape refs from click #1 vs click #2; `render()` between the clicks created a new Group object causing `r !== l`.

**Fix:** in the `click tap` handler for the text Group, skip `render()` when `selectedId` is already `item.id` (no state change, no need to rebuild). Both clicks of the dblclick now land on the same Group → `r === l` → `pointerdblclick` fires → `editText` opens.

Please re-run **scenario 4 only** (double-click re-edit). Specifically verify:
1. Single-click a committed text box → handles appear, no textarea ✓ (this still works — nothing changed for the selection path)
2. **Dblclick the now-selected text box** → textarea opens pre-filled with existing text
3. Edit the text, Enter to commit → geometry preserved, only text changed
4. Dblclick again, clear the text, Enter → box removed (intended, undoable)
5. No console errors throughout

Screenshots 1–3 + 5 from the previous run are solid for gate-2 citation. Just need scenario 4 evidence to close the smoke report. Thanks!
