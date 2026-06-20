---
type: screenshots
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
# status lifecycle:
#   required  → authored during /mat_write_feature Phase 4.6, no captures yet
#   partial   → /mat_implement_feature Phase 5b captured SOME but not all requirements
#   complete  → every requirement has a capture under screenshots/<req-id>.png
#   n/a       → non-UI feature (skip_ui_designer / frontend_lane: N/A); nothing to capture
status: required
authored_by: product-owner
authored_at: 2026-06-20T17:00:00Z
---

# Validation screenshots: Rectangle (red-outline box) tool

<!--
This feature is `skip_ui_designer: true` + `frontend_lane: N/A` but is NOT a no-UI feature:
it has a real visual surface (the in-page Konva canvas annotation editor overlay). `frontend_lane:
N/A` means "no UI-component-library lane," NOT "no visual surface." There is no component-library
mockup to diff against, so every block carries `Screen: n/a` (no side-by-side). There is no URL
route — the editor is an in-page content-script overlay reached by triggering a capture on a
localhost target; "Route" below describes the navigation steps to reach each state. Captures are by
the browser-tester at implement time → screenshots/<req-id>.png (paired by filename). Mirrors the
released w1-text-box-autofit sibling's screenshot contract.

The feature's 3rd surface — the controller `report.md` human-summary rectangle line
(`_render_markdown`) — is intentionally NOT a screenshot requirement here: it is plain-text Python
output, naturally validated by a controller pytest assertion (see feature.md E2E "Rectangle appears
in the controller report.md human summary"), not a visual capture.
-->

## rectangle-drawn — Red-outline rectangle drawn on a captured screenshot

- **Screen:** n/a
- **Route:** On a localhost target page, trigger capture (popup capture or `Cmd/Ctrl+Shift+S`) → the in-page editor overlay opens → click the **Rectangle** tool in the toolbar → drag out a marquee (well above the 4px threshold) over the captured screenshot.
- **Viewport:** 1440x900
- **State:** A committed rectangle on the `annLayer` with a **red `#e53935` outline** (`strokeWidth` ~2) and a **transparent (near-transparent, interior-hittable) fill** — visibly the same red house style as arrows/text, NOT the old blue `#1e88e5` placeholder. The toolbar shows the tool labelled **"Rectangle"** (plain text) alongside Arrow / Text / Select.
- **Proves:** ACs "A **Rectangle** tool button exists in the editor toolbar alongside Arrow, Text, and Select (label/title 'Rectangle')" + "dragging a marquee draws a rectangle with a **red `#e53935` outline** … near-transparent interior fill; the live draw-preview also strokes red `#e53935`"; E2E "Draw red rectangle".

## rectangle-selected — Rectangle selected in Select mode, shared transformer handles visible

- **Screen:** n/a
- **Route:** From the `rectangle-drawn` state, switch to the **Select** tool → single-click the rectangle (interior or edge).
- **Viewport:** 1440x900
- **State:** The rectangle **selected** in select mode, showing the **shared `Konva.Transformer` resize handles** (the same handle set as the text box, with **`rotateEnabled:false`** — no rotation handle), the red outline still visible underneath. (Same shared transformer the w1 text box uses — visually confirms the shared-transformer hypothesis holds for the rectangle.)
- **Proves:** AC "In **Select** mode, clicking a rectangle (interior or edge) selects it; the **shared `Konva.Transformer`** handles appear (same handles as the text box, `rotateEnabled:false`)"; E2E "Select / move / resize via shared transformer".
