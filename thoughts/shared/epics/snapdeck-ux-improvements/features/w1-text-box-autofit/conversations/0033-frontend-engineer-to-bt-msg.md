---
sequence: 0033
from: frontend-engineer
to: bt
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:28:19Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DEFECT-001 fix committed (`6a03abb`). Two changes landed in `extension/content/editor.js`:

**Fix 1 — dblclick re-edit (scenario 4):** In the text Group's `click tap` handler, `render()` is now skipped when `selectedId === item.id` already — no state change, no Group recreation. Both clicks of the dblclick now land on the same Group object, so Konva's identity check (`r === l`) passes and `pointerdblclick` fires normally. The `dblclick dbltap` handler then calls `editText(item, null)`.

**Fix 2 — large-text fit loop:** `fitTextFontSize()` is now binary search (O(log 42) ≈ 6 iterations vs. 42). Additionally, `TEXT_FIT_SAMPLE=500` caps the text passed to Konva for each measurement — if `safeText.length > 500`, the node is temporarily set to `safeText.slice(0, 500)` during the fit loop, then restored to full `safeText` for display. Worst-case pathological text now costs ≈ 6 × (500-char measurement) instead of 43 × (10K-char measurement).

Please re-run:
1. **Scenario 4** — single-click a committed text box in select mode (transformer handles should appear, no textarea); then double-click the same box (textarea must open pre-filled with the existing text). Confirm no console errors.
2. **Large-text case** — load or synthesize a text item with 20K+ characters in a normal-size (~200×100px) box. Confirm the page does NOT hang, render completes within 1 second, and the text is displayed (clipped by the Group). Screenshot the final state and report any console errors.

Report back to fe with findings.
