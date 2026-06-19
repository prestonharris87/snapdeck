---
type: screenshots
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
# status lifecycle:
#   required  → authored during /mat_write_feature Phase 4.6, no captures yet
#   partial   → /mat_implement_feature Phase 5b captured SOME but not all requirements
#   complete  → every requirement has a capture under screenshots/<req-id>.png
#   n/a       → non-UI feature (skip_ui_designer / frontend_lane: N/A); nothing to capture
status: required
authored_by: product-owner
authored_at: 2026-06-19T15:48:00Z
---

# Validation screenshots: Text-box auto-fit rework (Google-Slides style)

<!--
This feature is `skip_ui_designer: true` + `frontend_lane: N/A` but is NOT a no-UI feature:
it has a real visual surface (the in-page Konva canvas annotation editor overlay). There is no
component-library mockup to diff against, so every block carries `Screen: n/a` (no side-by-side).
There is no URL route — the editor is an in-page content-script overlay reached by triggering a
capture on a localhost target; "Route" below describes the navigation steps to reach each state.
Captures are by the browser-tester at implement time → screenshots/<req-id>.png (paired by filename).
-->

## textbox-autofit-wrapped — Drawn text box, multi-line wrapped, auto-fit within cap

- **Screen:** n/a
- **Route:** On a localhost target page, trigger capture (popup capture or `Cmd/Ctrl+Shift+S`) → the in-page editor overlay opens → select the **T Text** tool → drag out a ~200px-wide text box → type a string long enough to wrap to multiple lines → commit (Enter / blur).
- **Viewport:** 1440x900
- **State:** A committed text box with text **wrapped to ≥2 lines** within the box width, the font **auto-sized within the configured max cap** (no overflow past the box outline, no single-line flatten), rendered as **black text on a white fill inside a red outline**.
- **Proves:** ACs "Text wraps to the box width and the font auto-sizes to fit … capped at a configured maximum" + "renders with a white fill, a red outline, and black text" + "no flatten-to-one-unwrapped-line"; E2E "draw-a-box text auto-fits and wraps (no single-line flatten)".

## textbox-resize-refit — Same box after a transformer resize (font re-fit + wrap reflow)

- **Screen:** n/a
- **Route:** From the `textbox-autofit-wrapped` state, switch to the **Select** tool → single-click the box → drag a corner transformer handle to enlarge the box.
- **Viewport:** 1440x900
- **State:** The same text box **after a resize**, showing the font **re-fit within the cap** and the wrap **re-flowed** to the new box width (enlarging reduces line count / grows the font up to but never above the cap); white fill / red outline / black text preserved.
- **Proves:** AC "Resize re-fit: resizing re-fits the font within the cap and re-flows the wrap, writes the new `{x,y,width,height}` back … commits a `snapshot()`"; E2E "resize re-fits the font and re-flows the wrap (undoable)".

## textbox-selected-handles — Committed box selected, shared transformer handles visible

- **Screen:** n/a
- **Route:** From a committed text box, switch to the **Select** tool → single-click the box.
- **Viewport:** 1440x900
- **State:** A committed text box **single-click-selected** in select mode, showing the **shared `Konva.Transformer` resize handles** (`rotateEnabled:false` — no rotation handle); the text-entry field is **not** open (single-click selects, does not edit).
- **Proves:** ACs "Select mode: single-clicking … attaches the shared `attachBoxTransformer` (exactly one transformer at a time; `rotateEnabled:false`)" + "single-click only selects (does not open the editor)"; E2E "double-click re-edits, single-click only selects".

## textbox-reedit — Committed box re-opened for editing (double-click → text field)

- **Screen:** n/a
- **Route:** From a committed text box, switch to the **Select** tool → double-click the box.
- **Viewport:** 1440x900
- **State:** The committed text box **re-opened for editing** — the text-entry field positioned over the box, **pre-filled with the existing text**, ready to edit (box geometry unchanged underneath).
- **Proves:** AC "Re-edit: double-clicking a committed text box re-opens it for editing with the existing text pre-filled … Re-committing preserves the box geometry (only `text` changes)"; E2E "double-click re-edits, single-click only selects".
