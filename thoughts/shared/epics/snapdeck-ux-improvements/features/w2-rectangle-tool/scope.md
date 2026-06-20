---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-20T16:18:35Z
---

# Rectangle (red-outline box) tool

## Problem statement

The in-page Konva annotation editor (`extension/content/editor.js`) supports arrows and
auto-fit text boxes, plus a **generic `type:"box"` primitive** that the w0 editor-foundation
shipped *specifically to prove the box machinery* — drag-to-draw, click-select, and
move/resize via the shared `attachBoxTransformer`. That primitive currently renders with a
**blue placeholder outline** (`#1e88e5`), is **model-only** (deliberately excluded from the
lossy `annotations` projection — `editor-model.js:60`: _"box → excluded … w2 handles eventual
projection"_), and is labelled **"Box"** in the toolbar. The user has no real, report-visible
**rectangle annotation** in the same red house style as arrows and text.

This feature **promotes that foundation primitive into the user-facing red-outline rectangle**.
Per the w0 design contract (STORY-fe-001 §Decision, verbatim): _"the generic box's geometry is
exactly what w2-rectangle-tool promotes into the user-facing red-outline rectangle — w2's rework
is **restyle + downstream projection, not a geometry rebuild**."_ The draw / select / move /
resize / lossless-round-trip behaviour is already inherited from released w0 code; this feature's
real delta is **restyle (blue→red), relabel (Box→Rectangle), and add the rectangle to the lossy
downstream projection** (with the released unit-test + downstream-consumer coupling that change
implies).

## In scope

- **Restyle the box render to the annotation red.** `renderBox()` stroke `#1e88e5` → `#e53935`
  (the arrow/text red), keeping `strokeWidth` ~2 and the **near-transparent interior fill**
  (`rgba(0,0,0,0.001)`) so the rectangle stays interior-click-selectable in select mode.
  "Transparent / no fill" (AC) is satisfied by this near-transparent hittable fill — a true
  no-fill Rect is not interior-clickable, which would break select mode.
- **Restyle the live draw-preview** to match (the `__boxdrawing` preview rect currently strokes
  blue `#1e88e5` at `editor.js:403,406`) so draw-time and committed colour agree.
- **Relabel the toolbar tool "Box" → "Rectangle"** (button label + `title`), keeping plain-text
  label, no emoji / symbol-glyph / inline `<svg>` (consistent with the w0/w1 toolbar rules).
- **Add the rectangle to the lossy `projectAnnotations` projection** (`editor-model.js`) so the
  rectangle reaches the upstream `/report/save` report→defects consumer — fulfilling w0's
  forward-flagged _"w2 handles eventual projection"_. Projection entry carries
  `{id, type, x, y, width, height}` with `Math.round` on coordinates (rounding convention matches
  arrow/text). Exact `type` string + shape is an open decision (see Critical directives).
- **Update the released frozen unit tests** that assert the box is excluded from the projection
  (`extension/editor.model.test.mjs:88-101` — `projectAnnotations excludes box items` /
  `returns empty array for box-only model`) to the new "rectangle is projected" contract. These
  run in the merged `node --test` suite (currently 121/121) and **will fail unless updated in the
  same change**.
- **Preserve lossless round-trip** of the rectangle through `serializeModel` → persist →
  `deserializeModel` → render (already works via opaque pass-through; verify, don't rebuild).
- **No-regression:** arrows, auto-fit text boxes, select/move/resize of all box-shaped
  annotations, undo/redo, the byte-frozen arrow/text projection bytes, and the visibility toggle
  all behave exactly as before.

## Out of scope (explicit)

- **Geometry / draw / transformer rebuild.** The `{x,y,width,height}` model item, the drag-to-draw
  path, top-left normalization, sub-threshold reject, `attachBoxTransformer` move/resize, and
  round-trip are **inherited from released w0** — reuse, do not re-roll.
- **Rotation.** The shared transformer ships `rotateEnabled:false`; the geometry contract reserves
  no rotation field. Unchanged.
- **The popup screenshot gallery / re-open / delete UI** — that is the parallel **w2-screenshot-gallery**
  feature. This feature only guarantees the rectangle persists + round-trips through the editor's
  existing `ANNOTATE {image, model}` re-open path; it does **not** build any popup surface.
- **Arrow and text-box behaviour / styling** — untouched. The byte-frozen `{from,to}` /
  `{x,y,text}` projection entries for arrow/text stay **byte-identical**.
- **Report-store keying / persistence schema** (`report:<port>`, `screenshots[].model`) — owned by
  w0-per-target-reports; the rectangle rides the existing opaque `model` field with zero backend
  change.
- **Any new editor page/tab, capture change, or localhost-guard change.**

## Branch policy

Lands on the epic feature branch **`feature/snapdeck-ux-improvements`** as part of **Wave 2**
(BOSS-coordinated). Commits are atomic-pathspec and pre-approved; **push is BOSS-gated** (whisper
`READY TO PUSH`, await ack). Wave-2 PR is opened/merged by BOSS at gate-2. Parallel-safe with
**w2-screenshot-gallery** (that feature touches the popup + reads the editor render path read-only;
this feature edits the `editor.js` shape region + `editor-model.js` projection). Sequenced **after**
the released w1-text-box-autofit, so the two `editor.js` annotation-shape rewrites do not collide.

## Critical directives

- **DO NOT rename the model `type` literal away from `"box"` without a migration plan.** Already-
  persisted screenshots may carry `{type:"box"}` items in their stored `model`; the editor's
  `render()` dispatches on `item.type === "box"` and `deserializeModel` passes items through
  opaquely. Renaming the persisted type to `"rect"` would break round-trip render of existing
  records. **Recommendation: keep the model/wire type `"box"`; "Rectangle" is the user-facing
  name only.** If architects choose a distinct `"rect"` type, they MUST handle dispatch +
  round-trip of legacy `"box"` items. (Open decision — resolve in `/mat_write_feature`.)
- **The projected `type` string is a downstream contract — coordinate it.** The lossy projection
  feeds the upstream `/report/save` payload (`background.js:315-323`), consumed by the local
  Snapdeck **controller** (`deck up` worktree controller, **outside `extension/`**). Adding a new
  rectangle annotation type means that consumer (and whatever renders report→defects) must tolerate
  it. **Verify downstream tolerance before shipping the projection; if the controller consumer is
  cross-team / out-of-repo, escalate to BOSS** rather than assuming tolerance. (This is the #1 risk
  — see below.)
- **DO NOT fork the editor render/re-open path.** w2-screenshot-gallery re-opens arbitrary stored
  models through the *same* `render()` boundary (inheriting `RENDER_ITEM_CAP` / `RENDER_TEXT_CAP` +
  the text-box clamp/short-circuit). Keep the rectangle on the shared path so those guards stay
  inherited; coordinate on `#…/active` if a render-path change is unavoidable.
- **Keep the byte-frozen arrow/text projection truly frozen.** Adding the rectangle entry is
  strictly **additive** — do not reshape the `{from,to}` arrow or `{x,y,text}` text entries, their
  field names, order, or `Math.round`. The w0 arrow-only byte-identity E2E must stay green.
- **No emoji / symbol-glyph / inline `<svg>`** in the toolbar label (plain-text "Rectangle").

## Mockup decision

`skip_ui_designer: true` — `frontend_lane: N/A`. FE work exists but targets an **existing surface**
(the in-page Konva editor toolbar + canvas) by **restyling a primitive that already ships**. The
visual treatment is fully prescribed (red `#e53935` outline / transparent-hittable fill, matching
the released arrow/text house style) — there is no new screen, no new visual component, and no
layout to design. The ui-designer phase adds nothing here; the frontend-architect can spec directly
from the released `renderBox` + arrow/text styling. (Consistent with every w0/w1 feature on this
vanilla-JS Konva surface.)

## Acceptance criteria (seeds for PO to expand)

- A **"Rectangle"** tool exists in the editor toolbar alongside Arrow, Text, and Select.
- Dragging with the Rectangle tool draws a rectangle with a **red `#e53935` outline** and
  transparent (near-transparent, interior-hittable) fill; sub-threshold drags create nothing.
- In **select mode** the rectangle can be clicked to select, moved, and resized via the **shared
  `Konva.Transformer`** (same handles as the text box) — the shared-transformer hypothesis holds
  (it already does; rectangle reuses `attachBoxTransformer` with no materially different behaviour).
- The rectangle is stored in the editor `model` and **round-trips losslessly** (model-byte
  identity, `deepEquals(model.items)`) through serialize → persist → `deserializeModel` → render.
- On ✓ Done, the rectangle **appears in the lossy `annotations` projection** sent upstream to
  `/report/save`, with `Math.round`ed `{x,y,width,height}`; arrow/text projection entries remain
  **byte-identical** to pre-feature output.
- The released `extension/editor.model.test.mjs` projection tests are updated to the new
  "rectangle is projected" contract and the full `node --test` suite stays green.
- Existing arrow, text-box, select/move/resize, undo/redo, and visibility-toggle behaviour are
  **unaffected** (no regression).
- **Render-guard robustness preserved:** a hydrated model with a hostile/malformed rectangle item
  (non-finite or ≤0 geometry) renders without throwing or emitting a console error (inherits the
  w0 fe-004 render-boundary guard — verify it still covers the rectangle).

## E2E coverage hints (PO will write the actual specs)

- **Draw red rectangle:** Rectangle tool active → drag a marquee → exactly one red-outline rect on
  `annLayer`, one `{type:"box"}` item in `model` with top-left-normalized geometry; sub-threshold
  drag adds nothing.
- **Select / move / resize:** select mode → click rectangle (shared Transformer handles appear,
  `rotateEnabled:false`) → drag a corner to resize, drag body to move → `model` geometry updates,
  Undo restores prior geometry.
- **Projection reaches /report/save:** draw a rectangle + an arrow → ✓ Done → resolve payload's
  `annotations` includes the rounded rectangle entry **and** the arrow entry is byte-identical to
  the frozen fixture; `/report/save` body carries the rectangle annotation.
- **Lossless round-trip:** draw + resize a rectangle → Done (`done1`) → persist `model` →
  re-`ANNOTATE {image, model}` → Done (`done2`); `done2.model.items deepEquals done1.model.items`.
- **No-regression:** arrow draw/edit, text-box draw/auto-fit/re-edit, undo/redo, visibility toggle
  all behave exactly as before with the Rectangle tool present.
- **Render-guard (browser-tester lane):** hydrate a `version:1` model with a malformed rectangle
  (`{type:"box", x:NaN, width:"120", height:Infinity}`) alongside a well-formed one → `render()`
  completes, no throw / no console error, bad item skipped, good rectangle renders.

## Open design decisions (resolve in /mat_write_feature)

1. **Model/wire type: keep `"box"` vs new `"rect"`.** Recommendation: keep `"box"` (back-compat for
   already-persisted records); user-facing name "Rectangle" is decoupled from the wire type. If a
   new type is chosen, dispatch + round-trip of legacy `"box"` items must be handled.
2. **Projected annotation shape + `type` string.** e.g. `{id, type:"rect"|"box", x, y, width,
   height}` with `Math.round`. Must be coordinated with the downstream `/report/save` controller
   consumer (see risk #1).
3. **Whether downstream projection is in v1 or deferred.** Recommendation: **in v1** (w0 explicitly
   forward-flagged it to w2 and a report-invisible rectangle is of little value), gated on
   downstream-consumer tolerance.

## Risk surface

1. **Downstream `/report/save` consumer tolerance (#1 risk, possible BOSS escalation).** The
   rectangle annotation type newly reaches the local Snapdeck **controller** `/report/save`
   endpoint (likely the `deck` CLI / worktree controller, **outside `extension/`** — not found in
   `extension/`). If that consumer rejects or mishandles an unknown annotation type, the projection
   change breaks report saving. Verify tolerance; if the consumer is cross-team / out-of-repo,
   whisper BOSS before locking the projection contract.
2. **Frozen released-test coupling.** `extension/editor.model.test.mjs:88-101` assert box is
   *excluded* from the projection. The projection change requires updating these released tests in
   the same diff or the merged `node --test` suite regresses (currently 121/121).
3. **Round-trip of legacy persisted `box` items** if the model type is renamed (see directive /
   decision #1).
4. **Security (low).** Adding the rectangle to the lossy projection is a minor information-flow
   change (rectangle geometry now reaches upstream `/report/save`) — intended (rectangles are user
   annotations meant for the report). No text → no auto-fit/DoS path on the rectangle itself; the
   shared render-guard still applies. Security-architect Phase 7 should confirm the projection
   addition is intended and the render-guard covers the restyled rectangle.
