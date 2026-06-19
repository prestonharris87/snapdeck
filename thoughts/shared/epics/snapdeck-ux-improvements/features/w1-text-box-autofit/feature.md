---
type: feature
slug: w1-text-box-autofit
wave: 1
parent_epic: snapdeck-ux-improvements
status: in-progress
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-170919-3029
depends_on: [w0-editor-foundation]
frontend_lane: N/A
skip_ui_designer: true
visual_references: []
---

# Feature: Text-box auto-fit rework (Google-Slides style)

## Summary

The annotation editor's text tool is broken: today it places a single point of red bold text
on click (`editor.js` `renderText`: `Konva.Text`, fixed `fontSize:18`, no box), text wraps only
transiently while the textarea is open and **flattens to one unwrapped line on commit**, the box
geometry is never stored, committed text can't be resized, and a saved text annotation can't be
re-opened without loss. This feature replaces it with a **draw-a-box text annotation that behaves
like Google Slides auto-fit**: the developer/tester drags out a box, text wraps to the box width
and the font auto-sizes to fit the box (capped at a configured maximum), and the box can be
re-selected, moved, resized, and re-edited with no flatten regression — rendering as black text on
a white fill inside a red outline. It is the editor cluster's first annotation-shape rewrite, built
directly on the **released** `w0-editor-foundation` contracts: the `{x,y,width,height}` box base,
the pure `content/editor-model.js` transform module, the lossless `model` persistence, and the
shared `attachBoxTransformer(node,item)` helper.

## User-facing behavior

The "user" here is the developer/tester capturing screenshots in the in-page Konva editor (this is a
developer-facing canvas annotation tool, not a surface in the project's UI component library;
`skip_ui_designer: true`, `frontend_lane: N/A` — there are no design-system tokens or mockups for it).

- With the **T Text** tool selected, the dev **drags out a rectangle** to define the text box
  geometry `{x, y, width, height}` (exactly like the foundation's Box tool — no longer a single
  click-to-place point). On release, a text-entry field opens positioned over the box.
- The dev types into the box; **text wraps to the box width** and the **font auto-sizes to fit** the
  box, capped at a configured maximum font size. There is no overflow past the box and no
  flatten-to-one-line on commit.
- On **✓ Done**, the box geometry and wrapping are preserved in the editor `model` (the text item now
  carries `{x, y, width, height, text, …}`); the screenshot is saved exactly as before, and the
  lossless `model` round-trips so the box can later be re-opened (the re-open UI is `w2-screenshot-gallery`).
- The box renders as **black text on a white fill inside a red outline**, replacing today's red bold
  text-only rendering.
- In **Select mode**, the dev **single-clicks** the box to select it and reveal the shared
  `Konva.Transformer` resize handles; dragging the body moves it, dragging a handle resizes it — and
  **resizing re-fits the font (within the cap) and re-flows the wrap**. The dev **double-clicks** the
  box to re-open it for editing. All changes are undoable.

There are no mockups for this feature (`skip_ui_designer: true`); the visual treatment is fully
prescribed by the epic and this scope (white fill / red outline / black text, Google-Slides-style
auto-fit + wrap).

## UX patterns / interaction notes

- **Confirmed interaction model (resolves the epic open question "single-click vs double-click in
  select mode"):**
  - **Draw:** in the Text tool, **drag** to define the box geometry, then enter text into it. On
    draw-complete (mouseup) the text-entry field opens immediately for the new box, mirroring the
    current click→edit flow but with a box. A sub-threshold drag is rejected (no zero-area text box),
    consistent with the foundation's `width>4 && height>4` box-draw guard.
  - **Single-click (select mode):** selects the box and attaches the **shared** `attachBoxTransformer`
    (handles visible, `rotateEnabled:false`). Single-click does **not** open the editor.
  - **Double-click (select mode):** re-opens the box for editing with the existing text pre-filled;
    committing (Enter without Shift, or blur) preserves the box geometry and changes only the text.
  - **Move / resize (select mode):** body-drag moves; corner/edge handles resize via the shared
    transformer, which bakes `scaleX/scaleY` back into `width/height` on `transformend`, then re-fits
    + re-flows and commits a `snapshot()`.
- **Empty-text behavior preserved:** committing an empty text box removes the item (no orphan empty
  boxes), matching the current `editText` commit behavior.
- **Coexistence:** create lives in the **Text** tool (drag); select/move/resize/re-edit live in the
  **Select** tool. Clicking in select mode never starts a new annotation; this is the same
  create-vs-select separation the foundation established for box-shaped annotations.

## Acceptance criteria

- [ ] The Text tool is **draw-a-box**: dragging defines the text box geometry `{x, y, width, height}`
      (top-left origin, stage/CSS px in the `meta.viewport.{w,h,dpr}` space), no longer click-to-place
      point text. A sub-threshold drag is rejected (no zero-area text box).
- [ ] After the box is drawn, a text-entry field opens for it; **committing empty text removes the
      box** (no orphan empty boxes), preserving current commit behavior.
- [ ] Text **wraps to the box width** and the font **auto-sizes to fit** the box height, **capped at a
      configured maximum font size** — no overflow past the box, no single-line flatten.
- [ ] On ✓ Done, wrapping and box geometry are **preserved** (no flatten-to-one-unwrapped-line); the
      text item is stored in the editor `model` as a `type:"text"` item carrying
      `{x, y, width, height, text, …}` (any fit metadata the architect chooses rides on the item).
- [ ] The text box renders with a **white fill, a red outline, and black text** (replacing today's red
      bold text-only rendering).
- [ ] **Select mode:** single-clicking a committed text box selects it and attaches the **shared
      `attachBoxTransformer`** (exactly one transformer at a time; `rotateEnabled:false`); the body can
      be dragged to move; handles resize.
- [ ] **Resize re-fit:** resizing re-fits the font **within the cap** and re-flows the wrap, writes the
      new `{x,y,width,height}` back to the `model` item, and commits a `snapshot()` (undoable).
- [ ] **Re-edit:** double-clicking a committed text box re-opens it for editing with the existing text
      pre-filled; single-click only selects (does **not** open the editor). Re-committing **non-empty**
      text preserves the box geometry (only `text` changes); re-committing **empty** text removes the box
      (consistent with the create-flow empty-removal; undoable) — intended, not a regression.
- [ ] **Lossless round-trip:** `model → persist → load → model` is **identity** for the text item —
      geometry and content survive verbatim (`deepEquals(model.items)`); the box hydrates via the
      foundation's `deserializeModel` opaque pass-through and renders through the guarded render boundary.
      The guarantee is **model-byte identity**; the rendered wrap re-fits deterministically on reload
      within the same font environment (an explicit `fontFamily` is pinned for stability), but
      cross-font-environment pixel/line identity is **not** guaranteed — only the model bytes are.
- [ ] The lossy `annotations` projection for text remains the **byte-frozen** `{ id, type:"text",
      x:round(x), y:round(y), text }` shape — `width`/`height`/fit fields are **model-only** and never
      appear in the projection or the upstream `/report/save` payload. **`projectAnnotations` is not
      modified.**
- [ ] The pure module `content/editor-model.js` gains **no per-item validation** (the ratified opaque
      forward-compat contract is preserved; text-item field sanity stays a render-boundary concern in
      `editor.js`).
- [ ] `attachBoxTransformer(node, item)` is **reused as-is** (frozen signature + behavior); no parallel
      transformer is rolled. The text box node attaches to the same shared helper `w2-rectangle-tool`
      will reuse.
- [ ] **Render-boundary robustness preserved + extended into auto-fit:** hydrating a structurally-valid
      `model` whose text item has numerically-hostile geometry (`NaN`/`Infinity`/`1e308`/wrong-type) or
      oversized text renders **without throwing or emitting a console error** — bad items are
      skipped/coerced at the render boundary, text length is bounded by `RENDER_TEXT_CAP`, item count by
      `RENDER_ITEM_CAP`, and **auto-fit does not throw or hang** on hostile geometry/text.
- [ ] The box-shape rendering / select / resize logic is **factored so `w2-rectangle-tool` can reuse
      it** without a second `editor.js` rewrite (this feature is sequenced ahead of the rectangle tool
      on the shared shape logic).
- [ ] **No** new editor page/tab, **no** change to capture, the **localhost-only guard is unchanged**,
      and **no** report-store re-keying (that is `w0-per-target-reports`, already released).

## In scope

- **Draw-a-box text tool.** The `text` tool becomes drag-to-create (like the foundation's box tool),
  not click-to-place: the user drags out the text box geometry `{x, y, width, height}` and then enters
  text into it.
- **Auto-fit + wrap.** Text wraps to the box width and the font auto-sizes to fit the box, **capped at
  a configured maximum font size**. Resizing the box re-flows the wrap and re-fits the font within the
  same cap.
- **Visual treatment.** The text box renders with a **white fill, a red outline, and black text** —
  replacing today's red bold text-only rendering.
- **No flatten-on-commit.** On ✓ Done, the wrapping and box geometry are preserved in the editor
  `model` (the text item carries `{x,y,width,height}` plus whatever fit metadata the architect
  chooses); there is no flatten-to-one-unwrapped-line regression.
- **Select / move / resize.** In select mode the text box can be clicked to select, moved by its body,
  and resized via the **shared `attachBoxTransformer`** (reused, not re-rolled); resize re-fits the
  font within the cap and writes geometry back to the model + commits a `snapshot()`.
- **Re-edit.** A committed text box re-opens for editing on **double-click**; **single-click** selects
  it and shows the transformer handles (the confirmed interaction model).
- **Lossless round-trip.** `model → persist → load → model` reconstructs the text box with identical
  geometry, wrapping, and content (text box hydrates via the foundation's `deserializeModel` opaque
  pass-through and renders through the guarded render boundary).

## Out of scope

- **The lossy `annotations` projection schema is unchanged.** A text annotation still projects to the
  byte-frozen `{ id, type:"text", x, y, text }` shape via `editor-model.js` `projectAnnotations`; the
  new box geometry / fit fields live **only** in the opaque `model` items, never in the projection or
  the upstream `/report/save` payload. Do not modify `projectAnnotations`.
- **The pure module `content/editor-model.js` gains no per-item validation.** Items pass through
  opaquely (ratified forward-compat contract); text-item field sanity stays a render-boundary concern
  in `editor.js`.
- **The rectangle tool** — `w2-rectangle-tool` (sequenced after me). I keep the box-shape abstraction
  clean enough that the rectangle tool can reuse it, but I do not build it.
- **Toolbar drag + annotation-visibility toggle** — `w1-draggable-toolbar-toggle` (parallel Wave-1
  feature; touches toolbar chrome + `annLayer.visible()`, not the `model` or shape rendering).
- **Popup gallery / re-open / delete UI** — `w2-screenshot-gallery` (this feature only guarantees the
  text box round-trips through the persisted `model` that feature will re-open).
- **Report-store re-keying** — already shipped by `w0-per-target-reports` (released); the per-screenshot
  `model` field survives the re-keyed store.
- **Rotation** — the shared transformer ships `rotateEnabled: false`; no rotation field in the geometry
  contract.
- **Rich text** — no per-run font family / color / size choices beyond the fixed white-fill /
  red-outline / black-text spec and the auto-fit cap.
- No new editor page/tab; no change to capture; the **localhost-only guard is unchanged**.

## Critical directives (inherited contracts — preserve verbatim)

These are load-bearing constraints the architects MUST honor; they originate in `scope.md` and the
team-lead's decompose brief.

- **Build on the RELEASED `w0-editor-foundation` contracts; reuse `attachBoxTransformer(node,item)`
  (frozen signature) — do NOT roll a parallel transformer** (`w2-rectangle-tool` reuses the same
  helper). The helper bakes `scaleX/scaleY` back into `width/height` on `transformend`, then
  `snapshot(); render()`; do not rename, reshape, or duplicate it.
- **Keep the lossy `annotations` projection BYTE-FROZEN: text projects to `{id,type:"text",x,y,text}`.**
  New box geometry + auto-fit fields ride **OPAQUELY** in the model items only — **no change to
  `editor-model.js` `projectAnnotations`, no per-item validation added to the pure module.** `{x,y}`
  now naturally reflects the box top-left; the projection shape (field names, order, `Math.round`) is
  unchanged.
- **Preserve the render-boundary robustness inherited from `w0` STORY-fe-004** (skip/coerce non-finite
  geometry, cap text length via `RENDER_TEXT_CAP`, bound item count via `RENDER_ITEM_CAP`) —
  `w2-screenshot-gallery` re-opens arbitrary stored models through this exact path. Auto-fit must not
  throw or hang on hostile geometry/text.
- **`extension/content/editor.js` is co-edited this wave by `w1-draggable-toolbar-toggle`** (orthogonal
  region: toolbar chrome + `annLayer`/`selectLayer` visibility); **BOSS serializes the implement
  window.** This feature is **sequenced AHEAD of `w2-rectangle-tool`** on the shared shape logic —
  factor the box-shape rendering/select/resize so the rectangle tool can reuse it without a second
  rewrite.
- **Auto-fit determinism (architect decision, bounded).** Whether the fitted font size is stored on the
  model item or recomputed on render from `{width, height, text, cap}` is an architect call, but the
  round-trip must reconstruct identical wrapping and sizing (no drift) and re-fit must be deterministic
  on resize.
- **MV3 / manifest.** `content/editor-model.js` is already a registered content script; adding opaque
  text-item fields needs no manifest change. Only split a new module (and register it) if the architect
  has a strong reason.

## E2E test spec (written by Product Owner)

These run against the in-page Konva content-script editor via the browser-tester's Playwright harness.
The editor is opened with an `ANNOTATE { image, model }` message and resolves (on ✓ Done) with a
payload carrying `annotations` (the byte-frozen lossy projection) and `model` (`{version:1, items:[…]}`).
Assertion targets are that **editor→background resolve payload** and the **per-screenshot record** in
the local in-progress report store (an extension service-worker store — there is no login screen and no
page reload involved, so no re-auth step applies to the round-trip; consistent with the foundation's
own round-trip spec). Wrap/auto-fit/handle assertions read the live Konva nodes via the harness's
in-page evaluation.

### Test: draw-a-box text auto-fits and wraps (no single-line flatten)

**Given** the in-page editor is open on a captured localhost screenshot with the **Text** tool selected
**When** the dev drags out a text box of a known width (e.g. ~200px) and types a string long enough to
exceed one line at the maximum font size (e.g. several words past the box width)
**Then** the rendered text **wraps to ≥2 lines** within the box width (text node width ≈ the drawn box
width; no glyphs overflow past the box outline), the effective font size is **≤ the configured maximum
cap**, and the box renders with a **white fill, red outline, and black text fill** — and on ✓ Done the
emitted `model` text item carries `{ x, y, width, height, text, … }` with `width` equal to the drawn box
width (the wrapping is geometry-preserved, **not** flattened to one unwrapped line).

### Test: commit round-trips losslessly and the lossy projection stays byte-frozen

**Given** the dev has drawn a wrapping text box and clicked ✓ Done — call the emitted resolve payload
`done1`
**When** `done1.model` is stored at `screenshots[].model` (via ADD_SCREENSHOT), read back from the local
in-progress report store, re-sent into a fresh editor via `ANNOTATE { image, model }`, and that editor is
immediately committed with ✓ Done — call the second payload `done2` (no page reload / no re-login: the
store is the extension's own service-worker store, which is not auth-gated)
**Then** **`done2.model.items` `deepEquals` `done1.model.items`** — the text item's `{x,y,width,height,
text}` (geometry + text only; no fit field is stored — fit is recomputed on render) survive verbatim with
zero geometry/content drift, so `model → persist → load → model` is identity (`deepEquals` on
`model.items`) and the wrapped box re-fits deterministically to the **same line count and font** on
reload **within the same font environment** (an explicit `fontFamily` is pinned; cross-environment
pixel-identity is not guaranteed — only model-byte identity is); **and** the lossy projection entry for
that text item is **exactly**
`{ id, type:"text", x:round(x), y:round(y), text }` — `Object.keys(...).sort()` equals
`["id","text","type","x","y"]`, with **no** `width`/`height`/fit key leaked — **and** the subsequent
`/report/save` body carries no `model` field on `screenshots[]` (upstream payload byte-identical to
pre-feature).

### Test: resize re-fits the font and re-flows the wrap (undoable)

**Given** the editor is open with one committed wrapping text box and the **Select** tool active
**When** the dev single-clicks the box (handles appear), drags a corner transformer handle to **enlarge**
it, then presses Undo
**Then** after the resize the box's `model` item reflects the new `{x,y,width,height}` (the shared
`attachBoxTransformer` baked `scaleX/scaleY` back into `width/height` on `transformend`), the font
**re-fits within the cap** and the wrap **re-flows** (enlarging reduces the line count / can grow the font
up to the cap, never above it), exactly one shared `Konva.Transformer` is attached
(`rotateEnabled:false`), and **Undo restores the prior `{x,y,width,height}` and prior fit** (the resize
committed a `snapshot()`).

### Test: double-click re-edits, single-click only selects

**Given** the editor is open with one committed text box and the **Select** tool active
**When** the dev **single-clicks** the box, then **double-clicks** it, edits the text, and commits
(Enter without Shift)
**Then** the single-click **selects** the box and attaches exactly one shared transformer (handles
visible) **without** opening the text-entry field; the double-click opens the text-entry field
**pre-filled** with the existing text; and after editing + commit the box geometry `{x,y,width,height}` is
**unchanged** (only `text` differs) and a `snapshot()` is committed (the edit is undoable).

### Test: hostile / oversized text item hydrates without throwing (render-boundary robustness)

**Given** a structurally-valid persisted `model` — `{ version:1, items:[…] }` — carrying a
numerically-hostile text item (e.g. `{ type:"text", x:NaN, y:0, width:"200", height:Infinity, text:<a
multi-megabyte string> }`) **and** an `items` array far above any sane annotation count, alongside one
well-formed text box
**When** the editor is opened via `ANNOTATE { image, model }` with that payload
**Then** the editor mounts and `render()` completes (does **not** hang) with **no thrown exception and no
console error** — the hostile-geometry text item is skipped/coerced at the render boundary, the rendered
text length is **bounded by `RENDER_TEXT_CAP`** and item count by **`RENDER_ITEM_CAP`**, **auto-fit does
not throw or hang** on the hostile geometry/oversized text, the well-formed text box renders normally, and
`deserializeModel` is unchanged (items still pass through opaquely). _[extends the `w0` STORY-fe-004
render-guard into the auto-fit path; Konva-render-dependent → browser-tester E2E lane, not a `node --test`
case.]_

### Motion E2E

`Motion E2E: n/a` — `frontend_lane: N/A`, `skip_ui_designer: true`. This is a vanilla-JS Konva **canvas
annotation tool** with no project component-library motion tokens or lane motion conventions. The visible
state changes (auto-fit font sizing, wrap re-flow on resize, default `Konva.Transformer` handle chrome on
select) are instantaneous canvas updates, not branded animations/transitions. This deferral is consistent
with the released `w0-editor-foundation` (same `frontend_lane: N/A` Konva refactor, same `Motion E2E: n/a`
call).

## Stories (populated by architects)

All `approved` after PO arbitration 2026-06-19 (see `conversations/0018-product-owner-arbitration-decision.md`).
Implement order follows the FE chain; sentinels are no-work.

- [ ] STORY-fe-001 — Drag-to-draw text-box tool: box-geometry model item + authoring (frontend-engineer) · depends_on: []
- [ ] STORY-fe-002 — Auto-fit wrap render + white/red/black visual + render guard (frontend-engineer) · depends_on: [STORY-fe-001]
- [ ] STORY-fe-003 — Text-box select/move/resize via shared transformer + re-fit (frontend-engineer) · depends_on: [STORY-fe-001, STORY-fe-002]
- [ ] STORY-be-001 — Sentinel: no backend changes (backend; opaque model persistence already covers it) · depends_on: []
- [ ] STORY-db-001 — Sentinel: no database changes (database; fields ride opaque in model blob) · depends_on: []
- [ ] STORY-do-001 — Sentinel: no devops changes (devops; rework stays in registered editor.js) · depends_on: []

## Defects (populated as found)

- (none yet)

## No-work domains

Domains an architect explicitly decided needed no work for this feature. The sentinel stories that recorded these decisions were pruned at the end of `/mat_write_feature`; the rationale is preserved here.

- **backend** — **No backend changes required for this feature.**
- **database** — **No database changes required for this feature.** This is an explicit
- **devops** — **No devops changes required for this feature.**

## History

2026-06-19T17:10:13Z — orchestrator: status: 'planned' -> 'in-progress' (started via /mat_implement_feature (BOSS-mode))
