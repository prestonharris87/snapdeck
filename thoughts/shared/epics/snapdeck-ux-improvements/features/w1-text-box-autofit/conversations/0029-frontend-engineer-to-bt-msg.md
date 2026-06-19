---
sequence: 0029
from: frontend-engineer
to: bt
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T17:19:14Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

I've implemented all three w1-text-box-autofit stories (fe-001/fe-002/fe-003) in commit 3cab947. The dev-server.txt is empty right now, so the dev server isn't running yet.

When the dev server becomes available and the extension is loaded in Chrome, please smoke-verify the following for me (these are canvas behaviors I can't unit-test):

**Feature: Text box auto-fit (w1-text-box-autofit)**

Load a localhost page with the extension running (annotation editor opens on the keyboard shortcut or via ANNOTATE IPC).

1. **Drag-to-draw:** With the "T Text" tool selected, drag a box of ~200×150px. Confirm:
   - The text box appears with a **white fill** and **red outline** (#e53935)
   - A textarea opens over the box, sized to match the drawn box
   - The toolbar "T Text" button title reads "Add a text comment (drag a box)"
   - A sub-threshold click (no drag) creates NO text item

2. **Auto-fit + wrap:** Type a multi-word sentence long enough to fill the box at ~fontSize 48. Confirm:
   - Text wraps to ≥2 lines within the box width (no horizontal overflow past the red outline)
   - Effective fontSize ≤ 48 (TEXT_AUTOFIT_MAX)
   - Text is **black** (not red bold)
   - Press Enter (without Shift) to commit

3. **Select/move/resize:** Switch to Select tool. Confirm:
   - **Single-click** selects the box (transformer handles appear), does NOT open the textarea
   - **Body-drag** moves the box and geometry persists on next render
   - **Corner-handle drag** resizes the box; on release, font re-fits (smaller box → smaller font, larger box → larger font up to cap), wrap re-flows
   - **Undo** after resize restores prior geometry + fit

4. **Double-click re-edit:** Double-click the committed box. Confirm:
   - Textarea opens pre-filled with the existing text
   - Editing + committing (Enter) changes only the text; box geometry unchanged
   - Committing **empty** text removes the box (intended, undoable)

5. **Hostile item (if feasible via ANNOTATE IPC):** Send `ANNOTATE { model: { version:1, items:[{ type:"text", x:NaN, y:0, width:"200", height:Infinity, text:"bad" }, { id:"ok", type:"text", x:50, y:50, width:200, height:100, text:"good" }] } }`. Confirm: no console errors, the "good" box renders normally, the bad item is skipped.

Please report: any console errors, screenshot of the text box (drawn + selected + resized), and confirm the font/wrap behaviors. This is blocking the gate-2 smoke evidence citation.

Thanks!
