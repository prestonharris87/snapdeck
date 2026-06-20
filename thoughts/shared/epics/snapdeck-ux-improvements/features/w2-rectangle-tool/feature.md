---
type: feature
slug: w2-rectangle-tool
wave: 2
parent_epic: snapdeck-ux-improvements
status: released
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260620-173825-86207
depends_on: [w0-editor-foundation, w1-text-box-autofit]
frontend_lane: N/A
visual_references: []
released_at: 2026-06-20T18:53:28Z
pr_url: https://github.com/prestonharris87/snapdeck/pull/3
---

# Feature: Rectangle (red-outline box) tool

## Summary

Promote the released w0 generic `type:"box"` editor primitive into a real, report-visible,
user-facing **red-outline rectangle** annotation that sits alongside arrows and auto-fit text
boxes. The geometry — drag-to-draw, top-left normalization, sub-threshold reject, click-select,
and move/resize via the shared `attachBoxTransformer` — plus lossless model round-trip already
ship from w0 and are **reused, not rebuilt**. This feature's real delta is four things across
three in-repo surfaces: (1) **restyle** the box render and live draw-preview from the blue
placeholder `#1e88e5` to the annotation red `#e53935`, (2) **relabel** the toolbar tool "Box" →
"Rectangle", (3) **add the rectangle to the lossy `projectAnnotations` projection**
(`editor-model.js`) so the rectangle finally reaches the upstream `/report/save` consumer —
fulfilling w0's forward-flagged _"w2 handles eventual projection,"_ with the released
projection-exclusion unit tests updated in the same change, and (4) **render the rectangle in the
in-repo controller's `report.md` human summary** (`controller/snapdeck_controller/reports.py`
`_render_markdown`, which today only cases text/arrow). BOSS controller recon confirmed the
consumer is in-repo and stores `annotations` opaquely (`/report/save` → `report.json`, no type
validation) — so the projection contract is **safe to lock**; my team owns all three surfaces.

## User-facing behavior

A user editing a captured screenshot in the in-page Konva editor sees a **"Rectangle"** tool in
the toolbar next to Arrow, Text, and Select. Selecting it and dragging on the canvas draws a
**red-outline rectangle** (the same red house style as arrows and text) with a transparent
interior; the live drag-preview is also red, so the draw-time colour matches the committed colour.
Switching to **Select** mode lets the user click the rectangle to select it, then move it (drag the
body) or resize it (drag the shared transformer handles) — exactly like the text box. Undo/redo
restores prior geometry. When the user clicks **✓ Done**, the rectangle is now included in the
report sent upstream (previously the blue placeholder box was model-only and invisible to the
report), so rectangles drawn in the editor actually appear in the saved report's annotations
alongside arrows and text.

This feature has **no new screen and no mockups** (`skip_ui_designer: true`, `frontend_lane: N/A`):
it restyles an existing primitive on an existing surface (the in-page editor toolbar + canvas).

## UX patterns / interaction notes

- **Tool label is plain text "Rectangle"** (button label + `title`), no emoji / symbol-glyph /
  inline `<svg>` — consistent with the w0/w1 toolbar rules.
- **"Transparent / no fill" is implemented as a near-transparent hittable fill**
  (`rgba(0,0,0,0.001)`), NOT a true no-fill `Rect`. A true no-fill rectangle is not
  interior-clickable, which would break interior-click select in Select mode. The fill is visually
  transparent but keeps the interior a hit target. (This is the inherited w0 behavior — preserve it.)
- **Interaction model is inherited from w0** — drag-to-draw with top-left normalization on every
  move, `>4px` sub-threshold reject in each dimension, click-to-select in Select mode, shared
  `Konva.Transformer` (`rotateEnabled:false`), snapshot-based undo/redo. Nothing new to design.
- **User-facing name is decoupled from the wire type.** The toolbar reads "Rectangle"; the model
  item type stays the literal `"box"` (see Acceptance criteria + the architect note below) for
  round-trip back-compat with already-persisted records.

## Acceptance criteria

- [ ] A **"Rectangle"** tool button exists in the editor toolbar alongside Arrow, Text, and Select;
  label and `title` read "Rectangle" (plain text — no emoji / symbol-glyph / inline `<svg>`), and
  the tool-active highlight tracks it like the other tools.
- [ ] With the Rectangle tool active, dragging a marquee draws a rectangle with a **red `#e53935`
  outline** (`strokeWidth` ~2) and a near-transparent interior fill (`rgba(0,0,0,0.001)`); the
  **live draw-preview also strokes red `#e53935`** (not the old blue `#1e88e5`), so draw-time and
  committed colour agree.
- [ ] Sub-threshold drags (≤4px in either dimension) create **no** rectangle (mirrors the existing
  box `>4` guard).
- [ ] The committed rectangle is stored in the editor `model` as a
  `{id, type:"box", x, y, width, height}` item with **top-left-normalized** geometry. The model /
  wire `type` literal stays **`"box"`** (user-facing name "Rectangle" is decoupled from the wire type).
- [ ] In **Select** mode, clicking a rectangle (interior or edge) selects it; the **shared
  `Konva.Transformer`** handles appear (same handles as the text box, `rotateEnabled:false`);
  dragging a corner resizes and dragging the body moves, and the `model` geometry updates accordingly.
- [ ] **Undo/redo** restores prior rectangle geometry (existing snapshot mechanism — unchanged).
- [ ] The rectangle **round-trips losslessly** through `serializeModel` → persist →
  `deserializeModel` → `render()`: `deepEquals(done2.model.items, done1.model.items)` (model-byte
  identity, via the existing opaque pass-through — verify, do not rebuild).
- [ ] On ✓ Done, the rectangle **appears in the lossy `annotations` projection** sent upstream to
  `/report/save`, carrying `{id, type, x, y, width, height}` with `Math.round`ed coordinates
  (rounding convention matches arrow/text; the exact projection `type` string is ratified by
  architects — see open decision #2). **Arrow and text projection entries remain byte-identical** to
  pre-feature output.
- [ ] **A saved report's `report.md` shows the rectangle in its human summary.** After a `/report/save`
  carrying a rectangle annotation, the controller's `report.md` renders the rectangle as a clean
  human-readable line (emoji + rounded `{x,y,width,height}`, matching the arrow/text style) — **not**
  the raw-dict catch-all dump (`controller/snapdeck_controller/reports.py` `_render_markdown`). The
  branch cases on the same `type` string the projection emits.
- [ ] The released `extension/editor.model.test.mjs` projection-exclusion tests (lines ~88-101 —
  `projectAnnotations excludes box items` / `returns empty array for box-only model`) are **updated
  to the new "rectangle is projected" contract**, and the full `node --test extension/*.test.mjs`
  suite stays green (currently 121/121).
- [ ] Existing **arrow**, **text-box** (draw / auto-fit / re-edit), **select/move/resize**,
  **undo/redo**, and the **visibility-toggle** behaviors are unaffected — no regression.
- [ ] **Render-guard robustness preserved (render AND projection symmetric):** a hydrated `version:1`
  model containing a hostile/malformed rectangle item (non-finite or ≤0 geometry, e.g.
  `{type:"box", x:NaN, width:"120", height:Infinity}`) renders **without throwing or emitting a
  console error** — the bad item is skipped and well-formed rectangles still render (inherits the w0
  fe-004 render-boundary guard at `renderBox`). The **lossy projection treats malformed geometry the
  same way**: such an item is **not** emitted into the `/report/save` `annotations` (no coerced
  `x:null` / `0`-dim garbage reaches the upstream report), so render and projection stay symmetric.
  The lossless model round-trip is unaffected — the malformed item still survives in `model.items`
  (only the lossy projection skips it). _(PO arbitration — contrarian INFO#1; wired in STORY-fe-002.)_

## In scope

- **Restyle the box render to the annotation red.** `renderBox()` (`editor.js:322`) stroke
  `#1e88e5` → `#e53935` (the arrow/text red), keeping `strokeWidth` ~2 and the **near-transparent
  interior fill** (`rgba(0,0,0,0.001)`) so the rectangle stays interior-click-selectable in select
  mode. "Transparent / no fill" (AC) is satisfied by this near-transparent hittable fill — a true
  no-fill Rect is not interior-clickable, which would break select mode.
- **Restyle the live draw-preview** to match: the `__boxdrawing` preview `previewStroke` is `#1e88e5`
  at `editor.js:403` → `#e53935`, so draw-time and committed colour agree. (Do NOT touch the
  `__textdrawing` red preview — text already strokes `#e53935`.)
- **Relabel the toolbar tool "Box" → "Rectangle"** (button label + `title` at `editor.js:527`),
  keeping a plain-text label, no emoji / symbol-glyph / inline `<svg>`. The internal tool key and
  `api.onTool("box")` dispatch (`editor.js:541,555`) stay `"box"`.
- **Add the rectangle to the lossy `projectAnnotations` projection** (`editor-model.js:45-63`) so
  the rectangle reaches the upstream `/report/save` report→defects consumer — fulfilling w0's
  forward-flagged _"w2 handles eventual projection."_ Projection entry carries
  `{id, type, x, y, width, height}` with `Math.round` on coordinates (rounding convention matches
  arrow/text). Exact `type` string + shape is an open decision (see below + Critical directives).
- **Update the released frozen unit tests** that assert the box is excluded from the projection
  (`extension/editor.model.test.mjs:88-101` — `projectAnnotations excludes box items` /
  `returns empty array for box-only model`) to the new "rectangle is projected" contract. These run
  in the merged `node --test extension/*.test.mjs` suite (currently 121/121) and **will fail unless
  updated in the same change**.
- **Render the rectangle in the in-repo controller's `report.md` human summary**
  (`controller/snapdeck_controller/reports.py` `_render_markdown`, ~line 220). It currently cases
  only `type:"text"` and `type:"arrow"`; a rectangle today falls into the catch-all `else`
  (`lines.append(f"- {a}")`) and dumps the raw annotation dict. Add a proper rectangle branch
  (emoji + rounded `{x,y,width,height}`, in the arrow/text style) so the rectangle appears as a
  clean human-readable line. The branch MUST case on the **same `type` string the projection
  emits** (see open decision #2) — keep the two coupled. (BE/Python surface — backend-architect
  owns this story.) `report.json` already stores the rectangle opaquely with zero controller change.
- **Preserve lossless round-trip** of the rectangle through `serializeModel` → persist →
  `deserializeModel` → render (already works via opaque pass-through; verify, don't rebuild).
- **No-regression:** arrows, auto-fit text boxes, select/move/resize of all box-shaped annotations,
  undo/redo, the byte-frozen arrow/text projection bytes, and the visibility toggle all behave
  exactly as before.

## Out of scope

- **Geometry / draw / transformer rebuild.** The `{x,y,width,height}` model item, the drag-to-draw
  path, top-left normalization, sub-threshold reject, `attachBoxTransformer` move/resize, and
  round-trip are **inherited from released w0** — reuse, do not re-roll.
- **Rotation.** The shared transformer ships `rotateEnabled:false`; the geometry contract reserves
  no rotation field. Unchanged.
- **The popup screenshot gallery / re-open / delete UI** — that is the parallel
  **w2-screenshot-gallery** feature. This feature only guarantees the rectangle persists +
  round-trips through the editor's existing `ANNOTATE {image, model}` re-open path; it does **not**
  build any popup surface.
- **Arrow and text-box behaviour / styling** — untouched. The byte-frozen `{from,to}` /
  `{x,y,text}` projection entries for arrow/text stay **byte-identical**.
- **Report-store keying / persistence schema** (`report:<port>`, `screenshots[].model`) — owned by
  w0-per-target-reports; the rectangle rides the existing opaque `model` field with zero backend change.
- **Any new editor page/tab, capture change, or localhost-guard change.**

## E2E test spec (written by Product Owner)

> **Environment note (round-trip / re-open scenarios):** the "re-open the model" step below uses the
> editor's own `ANNOTATE {image, model}` message path against the extension service worker's store —
> it is NOT a browser hard-refresh of an authed SPA, so the `testing.md` hard-refresh/re-login gotcha
> does **not** apply (no login screen exists). No `loginAs()` step is needed. (Consistent with the
> released w0-editor-foundation / w1-text-box-autofit round-trip specs on this surface.)

### Test: Draw red rectangle

**Given** the editor is open on a captured screenshot and the **Rectangle** tool is active
**When** the user drags a marquee (well above the 4px threshold) on the canvas
**Then** exactly one rectangle is added to `annLayer` with a **red `#e53935`** stroke
(`strokeWidth` ~2) and near-transparent interior fill,
**And** the `model` gains exactly one `{type:"box"}` item with top-left-normalized
`{x, y, width, height}` geometry,
**And** during the drag the live preview rectangle stroked **red `#e53935`** (not blue `#1e88e5`).

### Test: Sub-threshold drag adds nothing

**Given** the editor is open and the **Rectangle** tool is active
**When** the user performs a tiny drag (≤4px in width or height)
**Then** no rectangle is added to `annLayer` and the `model` length is unchanged.

### Test: Select / move / resize via shared transformer

**Given** a rectangle exists in the model and the editor is in **Select** mode
**When** the user clicks the rectangle (interior or edge)
**Then** it becomes selected and the shared `Konva.Transformer` handles appear (same handles as the
text box, with `rotateEnabled:false`),
**And when** the user drags a corner handle to resize and then drags the body to move
**Then** the `model` rectangle's geometry updates to match,
**And when** the user presses Undo
**Then** the rectangle's prior geometry is restored.

### Test: Projection reaches /report/save (arrow byte-identical)

**Given** the editor contains one rectangle and one arrow
**When** the user clicks **✓ Done**
**Then** the resolved `/report/save` payload's `annotations` array includes the rectangle entry with
`Math.round`ed `{x, y, width, height}` (and the architect-ratified `type` string),
**And** the arrow entry in `annotations` is **byte-identical** to the frozen arrow fixture
(`{id, type:"arrow", from:[round(x1),round(y1)], to:[round(x2),round(y2)]}`),
**And** the `/report/save` request body carries the rectangle annotation.

### Test: Rectangle appears in the controller report.md human summary

**Given** a `/report/save` payload whose `annotations` include a rectangle entry (the projected
`{id, type, x, y, width, height}` shape)
**When** the controller's `save_report` writes the bundle (or `_render_markdown` is invoked directly
on a report dict containing the rectangle)
**Then** the produced `report.md` contains a clean human-readable rectangle line (emoji + rounded
`{x,y,width,height}`, matching the arrow/text formatting),
**And** it does **not** fall through to the raw-dict catch-all (`- {...}`),
**And** existing text/arrow lines in `report.md` are unchanged.
> _Best tested at the controller level (pytest on `_render_markdown` /`save_report`) since it's a
> Python surface; the browser-tester lane covers the FE→projection half above. backend-architect to
> place the controller unit test._

### Test: Lossless round-trip

**Given** the user has drawn and resized a rectangle and clicked **✓ Done** (capturing `done1`)
**When** the persisted `model` is re-opened via `ANNOTATE {image, model}` and the user clicks
**✓ Done** again (capturing `done2`)
**Then** `done2.model.items deepEquals done1.model.items` (model-byte identity — the rectangle
survives serialize → persist → `deserializeModel` → render with no field loss or reshape).

### Test: No-regression of existing annotations

**Given** the editor is open with the Rectangle tool now present in the toolbar
**When** the user exercises arrow draw/edit, text-box draw/auto-fit/re-edit, select/move/resize,
undo/redo, and the visibility toggle
**Then** every one of those behaves exactly as it did before this feature,
**And** the arrow/text entries in the `/report/save` projection remain byte-identical to the
pre-feature output.

### Test: Render-guard tolerates a malformed rectangle (browser-tester lane)

**Given** a `version:1` model is hydrated containing a malformed rectangle item
(`{type:"box", x:NaN, width:"120", height:Infinity}`) **alongside** a well-formed rectangle
**When** the editor calls `render()` on that model
**Then** `render()` completes with **no throw and no console error**, the malformed item is skipped,
and the well-formed rectangle renders normally (the inherited w0 fe-004 render-boundary guard in
`renderBox` still covers the restyled rectangle).

### Motion E2E

**n/a** — `frontend_lane: N/A`, vanilla-JS Konva content script. There is no project
component-library / design-system motion-token catalog on this surface; the only visible motion is
instantaneous canvas updates (draw, transformer-handle chrome on select) with no branded transition
or timing token. This matches the explicit `Motion E2E: n/a` call on every released w0/w1 feature on
this editor surface (w0-editor-foundation, w1-text-box-autofit). The test is "is there a
branded/tokened animation?" — there isn't — not "does anything move?".

## Stories (populated by architects)

- [ ] STORY-fe-001 — Restyle box render + draw-preview to red, relabel toolbar "Box" → "Rectangle" (frontend-engineer)
- [ ] STORY-fe-002 — Add rectangle to `projectAnnotations` (+ finite/≤0 guard) + flip the frozen exclusion tests (frontend-engineer)
- [ ] STORY-be-001 — Render the rectangle in the controller `report.md` human summary (`_render_markdown`) + first controller pytest (backend-engineer)
- [ ] STORY-db-001 — DB sentinel (no schema/store change — rectangle rides opaque model + flat report) (database-engineer)
- [ ] STORY-do-001 — DevOps sentinel (no manifest/CI/build change) (devops-engineer)

## Defects (populated as found)

- (none yet)

<!--
ARCHITECT NOTES (carried forward from scope.md "Open design decisions" + "Risk surface" +
"Critical directives" — act on these; do not re-derive from memory):

1. MODEL/WIRE TYPE STAYS "box" (back-compat). Already-persisted screenshots may carry
   {type:"box"} items in their stored `model`; render() dispatches on item.type === "box"
   (editor.js:182) and deserializeModel passes items through opaquely. Renaming the persisted
   type to "rect" would break round-trip render of existing records. Keep the model/wire type
   "box"; "Rectangle" is the user-facing name only. If architects choose a distinct "rect"
   type, they MUST handle dispatch + round-trip of legacy "box" items. (Open decision #1.)

2. PROJECTED `type` STRING — OPEN DECISION, but now a NAMING choice, NOT a compatibility risk
   (consumer tolerance is confirmed — see #3). The lossy projection feeds the /report/save payload
   (background.js:315-323), consumed by the IN-REPO controller. Architect picks the projected `type`
   string (e.g. {id, type:"rect"|"box", x, y, width, height} with Math.round). WHATEVER string is
   chosen, the controller's `_render_markdown` rectangle branch (see new in-scope item) MUST case on
   the SAME string — keep the projection emitter and the controller renderer coupled. Model/wire
   `type` stays "box" regardless (note #1).

3. ✅ RESOLVED (BOSS controller recon, scope.md commit d5fa5d3) — was the #1 risk, now closed; NO
   BOSS escalation needed. The /report/save consumer is IN-REPO: `controller/snapdeck_controller/
   reports.py`. `save_report` stores `annotations` OPAQUELY (`shot.get("annotations") or []` →
   report.json, line ~147/172; no type validation, no rejection). So adding the rectangle type is
   SAFE and the projection contract is SAFE TO LOCK — report.json + the report→defects pipeline
   receive it. **My team owns controller/** (all three surfaces are in-repo: editor.js FE ·
   editor-model.js+test projection · controller reports.py). NEW SURFACE this opened: `_render_markdown`
   (reports.py ~line 220) only cases text/arrow → a rectangle currently hits the catch-all `else`
   (`lines.append(f"- {a}")`) and dumps the raw dict. Added an in-scope bullet + AC + E2E to render
   it properly. backend-architect owns the controller story (BE/Python).

4. RELEASED FROZEN TEST COUPLING. extension/editor.model.test.mjs:88-101 assert box is EXCLUDED
   from the projection (boxItem fixture: {id:"b1", type:"box", x:300, y:80, width:160, height:90}).
   The projection change MUST update these tests in the same diff or the merged
   `node --test extension/*.test.mjs` suite regresses (currently 121/121). Assign test-file
   ownership explicitly (editor-model.js's test file → the story that edits projectAnnotations).

5. ROUND-TRIP OF LEGACY persisted "box" items if the model type is renamed (see directive/decision #1).

6. KEEP THE BYTE-FROZEN ARROW/TEXT PROJECTION TRULY FROZEN. Adding the rectangle entry is strictly
   ADDITIVE — do not reshape the {from,to} arrow or {x,y,text} text entries, field names, order, or
   Math.round. The w0 arrow-only byte-identity E2E must stay green.

7. DO NOT FORK the editor render/re-open path. w2-screenshot-gallery re-opens arbitrary stored
   models through the SAME render() boundary (inheriting RENDER_ITEM_CAP / RENDER_TEXT_CAP + the
   text-box clamp/short-circuit). Keep the rectangle on the shared path so those guards stay
   inherited; coordinate on #…/active if a render-path change is unavoidable.

8. SECURITY (low). Adding the rectangle to the lossy projection is a minor information-flow change
   (rectangle geometry now reaches upstream /report/save) — intended (rectangles are user
   annotations meant for the report). No text → no auto-fit/DoS path on the rectangle itself; the
   shared render-guard still applies. Security-architect Phase 7 should confirm the projection
   addition is intended and the render-guard covers the restyled rectangle.
-->

## No-work domains

Domains an architect explicitly decided needed no work for this feature. The sentinel stories that recorded these decisions were pruned at the end of `/mat_write_feature`; the rationale is preserved here.

- **database** — **No database changes required for this feature.**
- **devops** — **No devops changes are required for `w2-rectangle-tool`.** This is a sentinel story documenting

## History

2026-06-20T17:39:08Z — orchestrator: status: 'planned' -> 'in-progress' (started via /mat_implement_feature (BOSS-mode))
2026-06-20T18:53:28Z — BOSS: status: 'in-progress' -> 'released' (PR #3) (Wave 2 (final) released via PR #3 (merge cd6c0cb); node --test 144/144 + controller pytest 5/5)
