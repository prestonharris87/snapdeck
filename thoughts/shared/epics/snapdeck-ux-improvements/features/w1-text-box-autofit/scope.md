---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T15:08:00Z
---

# Text-box auto-fit rework (Google-Slides style)

## Problem statement

The annotation editor's text tool is broken. Today it places a single point of
text on click (`editor.js` `renderText`: `Konva.Text`, fixed `fontSize: 18`,
bold, red fill, no box) — text wraps only transiently while the textarea is open
and **flattens to one unwrapped line on commit**, the box geometry is never
stored, committed text can't be resized, and a saved text annotation can't be
re-opened without loss. This feature replaces it with a **draw-a-box text
annotation that behaves like Google Slides auto-fit**: the user drags out a box,
text wraps to the box width and the font auto-sizes to fit the box (capped at a
maximum), and the box can be re-selected, moved, resized, and re-edited with no
flatten regression. It is the editor cluster's first annotation-shape rewrite,
built directly on the **released** `w0-editor-foundation` contracts (the
`{x,y,width,height}` box base, the pure `content/editor-model.js` transform
module, the lossless `model` persistence, and the shared `attachBoxTransformer`).

## In scope

- **Draw-a-box text tool.** The `text` tool becomes drag-to-create (like the
  foundation's box tool), not click-to-place: the user drags out the text box
  geometry `{x, y, width, height}` and then enters text into it.
- **Auto-fit + wrap.** Text wraps to the box width and the font auto-sizes to
  fit the box, **capped at a configured maximum font size**. Resizing the box
  re-flows the wrap and re-fits the font within the same cap.
- **Visual treatment.** The text box renders with a **white fill, a red
  outline, and black text** — replacing today's red bold text-only rendering.
- **No flatten-on-commit.** On ✓ Done, the wrapping and box geometry are
  preserved in the editor `model` (the text item carries `{x,y,width,height}`
  plus whatever fit metadata the architect chooses); there is no
  flatten-to-one-unwrapped-line regression.
- **Select / move / resize.** In select mode the text box can be clicked to
  select, moved by its body, and resized via the **shared
  `attachBoxTransformer`** (reused, not re-rolled); resize re-fits the font
  within the cap and writes geometry back to the model + commits a `snapshot()`.
- **Re-edit.** A committed text box re-opens for editing on **double-click**;
  **single-click** selects it and shows the transformer handles (the confirmed
  interaction model from the feature stub).
- **Lossless round-trip.** `model → persist → load → model` reconstructs the
  text box with identical geometry, wrapping, and content (text box hydrates via
  the foundation's `deserializeModel` opaque pass-through and renders through the
  guarded render boundary).

## Out of scope (explicit)

- **The lossy `annotations` projection schema is unchanged.** A text annotation
  still projects to the byte-frozen `{ id, type:"text", x, y, text }` shape via
  `editor-model.js` `projectAnnotations`; the new box geometry / fit fields live
  **only** in the opaque `model` items, never in the projection or the upstream
  `/report/save` payload. Do not modify `projectAnnotations`.
- **The pure module `content/editor-model.js` gains no per-item validation.**
  Items pass through opaquely (ratified forward-compat contract); text-item field
  sanity stays a render-boundary concern in `editor.js`.
- **The rectangle tool** — `w2-rectangle-tool` (sequenced after me). I keep the
  box-shape abstraction clean enough that the rectangle tool can reuse it, but I
  do not build it.
- **Toolbar drag + annotation-visibility toggle** — `w1-draggable-toolbar-toggle`
  (parallel Wave-1 feature; touches toolbar chrome + `annLayer.visible()`, not
  the `model` or shape rendering).
- **Popup gallery / re-open / delete UI** — `w2-screenshot-gallery` (this feature
  only guarantees the text box round-trips through the persisted `model` that
  feature will re-open).
- **Report-store re-keying** — already shipped by `w0-per-target-reports`
  (released); the per-screenshot `model` field survives the re-keyed store.
- **Rotation** — the shared transformer ships `rotateEnabled: false`; no rotation
  field in the geometry contract.
- **Rich text** — no per-run font family / color / size choices beyond the fixed
  white-fill / red-outline / black-text spec and the auto-fit cap.
- No new editor page/tab; no change to capture; the **localhost-only guard is
  unchanged**.

## Branch policy

Lands on `feature/snapdeck-ux-improvements` (the epic feature branch; Wave 0
already merged to `master` via PR #1, and the branch is rebased onto it). This is
a fold-in onto the existing epic branch — not a new branch and not a new PR per
feature. **Pushes are BOSS-coordinated** (whisper `READY TO PUSH: <SHAs>`; never
self-push). ⚠️ This feature and `w1-draggable-toolbar-toggle` both edit
`extension/content/editor.js`; **BOSS serializes the implement window** between
the two teams — scope/decompose freely, but coordinate before staging editor.js
edits.

## Critical directives

- **Build on the RELEASED foundation; do not re-invent it.** The box base
  (`{x,y,width,height}`), the pure transform module
  (`serializeModel`/`projectAnnotations`/`deserializeModel`), lossless `model`
  persistence on the per-screenshot record, and `attachBoxTransformer(node,
  item)` are all live on `master`. Reuse them.
- **`attachBoxTransformer` signature + behavior are frozen** (it bakes
  `scaleX/scaleY` back into `width/height` on `transformend`, then
  `snapshot(); render()`). Attach the text box node to it; do **not** rename,
  reshape, or roll a parallel transformer. `w2-rectangle-tool` attaches to the
  same helper.
- **Keep the lossy text projection byte-frozen.** `projectAnnotations` must keep
  emitting `{ id, type:"text", x, y, text }` for text (same field names, order,
  `Math.round`). `{x,y}` now naturally reflects the box top-left; the shape is
  unchanged. New fields (`width`, `height`, fit metadata) are model-only and
  opaque.
- **Preserve render-boundary robustness (inherited from `w0` STORY-fe-004).**
  `renderText` must keep skipping/coercing non-finite or wrong-type geometry,
  cap text length (`RENDER_TEXT_CAP`), and stay bounded against pathological
  payloads — `w2-screenshot-gallery` re-opens arbitrary stored models through
  this exact path. Auto-fit must not throw or hang on hostile geometry/text.
- **MV3 / manifest.** `content/editor-model.js` is already a registered content
  script (manifest `content_scripts`); adding opaque text-item fields needs no
  manifest change. Only split a new module (and register it) if the architect
  has a strong reason.
- **Auto-fit determinism.** Whether the fitted font size is stored on the model
  item or recomputed on render from `{width, height, text, cap}` is an architect
  decision, but the round-trip must reconstruct identical wrapping and sizing
  (no drift), and re-fit must be deterministic on resize.
- **Sequenced ahead of `w2-rectangle-tool`** on shared `editor.js` shape logic —
  factor the box-shape rendering/select/resize so the rectangle tool can reuse
  it without a second rewrite.

## Mockup decision

`skip_ui_designer: true` — this is a vanilla-JS Konva **canvas annotation tool**
(developer-facing), not a surface in the project's UI component library, so
`frontend_lane: N/A` and there are no design-system tokens or screens to mock up.
The visual treatment is fully prescribed by the epic (white fill / red outline /
black text, Google-Slides-style auto-fit + wrap), so the frontend-architect can
spec the Konva rendering directly from this scope. No new screens; consistent
with the foundation's own `skip_ui_designer: true`.

## Acceptance criteria (seeds for PO to expand)

- The text tool is **draw-a-box**: dragging defines the text box geometry
  `{x,y,width,height}` before/while entering text (no longer click-to-place point
  text).
- Text **wraps to the box width** and the font **auto-sizes to fit** the box,
  capped at a configured maximum font size.
- On ✓ Done, wrapping and box geometry are **preserved** (no
  flatten-to-one-unwrapped-line); the box and its text/geometry are stored in the
  editor `model` as a `type:"text"` item carrying `{x,y,width,height,text,…}`.
- The text box renders with a **white fill, a red outline, and black text**.
- In select mode the text box can be **re-selected, moved, and resized** via the
  shared `attachBoxTransformer`; resizing **re-fits the font within the cap** and
  re-flows the wrap, writing geometry back to the model + `snapshot()`.
- A committed text box can be **re-opened for editing** (double-click to edit;
  single-click selects/shows handles).
- The text box **round-trips losslessly** through persist → re-load (`model →
  persist → load → model` is identity for the text item, including wrapping/fit).
- The lossy `annotations` projection for text remains the **byte-frozen**
  `{ id, type:"text", x, y, text }` shape (no projection or upstream-payload
  change).
- Malformed / hostile text-item geometry or oversized text **hydrates without
  throwing or console error** (render-boundary guard preserved; auto-fit bounded).

## E2E coverage hints (PO will write the actual specs)

- **Draw-a-box + auto-fit:** drag out a text box, type enough text to wrap →
  text wraps to the box width and the font auto-sizes within the cap (no
  overflow, no single-line flatten).
- **Commit round-trip (no flatten):** Done emits a `model` whose text item
  carries `{x,y,width,height,text}` and reconstructs the wrapped box on reload
  identically; the lossy projection stays `{x,y,text}`.
- **Resize re-fit:** select a committed text box, drag a corner handle → wrap
  re-flows and font re-fits within the cap; geometry written back; Undo restores
  prior geometry/fit.
- **Re-edit interaction model:** double-click a committed text box opens the
  editor with existing text; single-click only selects (shows handles); editing
  and re-committing preserves geometry.
- **Render-boundary robustness:** hydrating a `model` with a numerically-hostile
  / oversized text item renders without throwing or console error (extends the
  `w0` STORY-fe-004 guard into the auto-fit path).
