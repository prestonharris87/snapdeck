---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T04:27:08Z
refreshed_at: 2026-06-19T15:10:00Z
verified_against: HEAD 6e42464 (Wave 0 RELEASED — PR #1 merge 5526403)
---

# Draggable toolbar + annotation visibility toggle

> Scope refreshed against the **RELEASED** `w0-editor-foundation` editor surface on
> master (`extension/content/editor.js`, `editor-model.js`, `overlay.css`,
> `manifest.json`) — all seam references below are verified against HEAD `6e42464`,
> not guessed.

## Problem statement

The in-page Konva annotation editor (`extension/content/editor.js`) renders its
toolbar in a fixed, screen-centered spot over the captured screenshot. Two
ergonomics gaps follow: (1) the toolbar (`.snapdeck-toolbar`, pinned at
`top:12px; left:50%`) can sit directly over the region the user wants to annotate,
with no way to move it aside; and (2) there is no way to temporarily hide the
annotation layer to inspect the raw screenshot underneath. This feature adds a
**grab handle** that lets the user drag the toolbar out of the way (DOM drag,
position remembered across captures via `chrome.storage.local`) and a
**non-destructive toggle** that hides/shows the annotation layer (`annLayer`) so
the raw capture is visible beneath. It is an editor-chrome ergonomics feature — no
annotation-shape or persistence-model changes.

## Verified seam (HEAD 6e42464)

- **Toolbar** is built by `buildToolbar()` (`editor.js:333`), returning a `bar` API
  object `{ el, onTool, onUndo, onRedo, onDone, onCancel, setTool, setUndo }`. `bar.el`
  is `<div class="snapdeck-toolbar">`, appended to `root` (`.snapdeck-overlay`) as a
  sibling of `.snapdeck-stage` (`editor.js:38-39`).
- **Toolbar default position** (`overlay.css`): `position:fixed; top:12px; left:50%;
  transform:translateX(-50%)`. ⚠️ Drag must convert the centering `translateX(-50%)`
  to explicit `left/top` (fixed-viewport coords) on first drag so the stored
  position is unambiguous.
- **`annLayer`** is a closure-local `Konva.Layer()` (`editor.js:46`), NOT globally
  exposed — the toggle wiring lives inside `openEditor`. Layers in order: `bgLayer`
  (screenshot, `listening:false`), `annLayer` (annotations), `selectLayer`
  (transformer), `cursorLayer` (synthetic cursor).
- ⚠️ **The shared `Konva.Transformer` lives on `selectLayer`, not `annLayer`**
  (`editor.js:47,52-53`). Hiding only `annLayer` would leave selection handles
  floating over a "hidden" layer — the toggle MUST also hide selection chrome
  (hide `selectLayer` and/or deselect) when annotations are hidden.
- **Entry point**: `openEditor(imageDataUrl, initialModel)` (`editor.js:24`). New
  toolbar position must be applied here on open (read from `chrome.storage.local`).
- **`"storage"` permission is already granted** (`manifest.json` permissions:
  `activeTab, tabs, scripting, storage, unlimitedStorage`) — `chrome.storage.local`
  needs NO manifest change. (Likely no devops/manifest story.)

## In scope

- The editor toolbar gains a **grab handle**; dragging the handle repositions the
  `.snapdeck-toolbar` DOM element via **DOM drag** (DOM-level, not a Konva-stage
  drag), converting the default centering transform to explicit `left/top`.
- The toolbar position is **persisted in `chrome.storage.local`** (a dedicated
  UI-chrome key, e.g. `snapdeckEditorToolbarPos: {left, top}`) and re-applied in
  `openEditor()` on a later capture, so re-opening the editor restores the last
  position. Position is **clamped to the viewport** on apply (so a stored offscreen
  position can't strand the toolbar).
- A **toggle control** (new toolbar button via the existing `btn()` pattern, wired
  through a new `bar.onToggleVisibility` callback) hides/shows the annotation layer
  — `annLayer.visible(false|true)` + redraw — **and** hides the selection chrome
  (`selectLayer`/transformer) while hidden so no handles float.
- When hidden, the **raw captured screenshot (`bgLayer`) is visible with no
  annotations drawn over it**.
- The toggle is **non-destructive**: toggling off then on restores all annotations
  **unchanged** — it never mutates `model`, never destroys/recreates nodes, only
  flips layer visibility.
- The toggle is **view state, not model state**: it does **not** call `snapshot()`
  and does **not** push an undo/redo step.
- Toolbar drag and the toggle **never interfere with annotation drawing or
  selection**: dragging the toolbar never starts an annotation (drag is on the
  toolbar DOM, outside the Konva `stage` listeners), clicking the toggle never
  starts an annotation, and pointer events on the grab handle use pointer-capture +
  `stopPropagation` as belt-and-suspenders.

## Out of scope (explicit)

- **No change to the annotation `model` envelope, the lossy `annotations`
  projection, or the resolve / `/report/save` payloads** — owned by released
  `w0-editor-foundation` (`editor-model.js` is frozen; do not touch
  `serializeModel`/`projectAnnotations`/`deserializeModel`).
- **No change to the IndexedDB report store or its re-keying** (released
  `w0-per-target-reports`). Toolbar position lives in `chrome.storage.local`, NOT
  the report store / `model`.
- **No new annotation shapes or tools** (text box → `w1-text-box-autofit`;
  rectangle → `w2-rectangle-tool`).
- **No persistence of the toggle state.** Visibility resets to "shown" on each
  editor open; only the toolbar *position* persists. (Deferred — ACs only call for
  position persistence.)
- No toolbar resize, no rotation, no docking/snap-to-edge.
- No change to capture, the localhost-only guard, or existing arrow/box/text draw /
  select / transform / undo / redo behavior.

## Branch policy

Lands on the epic feature branch `feature/snapdeck-ux-improvements`; BOSS
coordinates all pushes. Scope + decompose proceed now (Wave 0 RELEASED, contracts
stable on master). ⚠️ **Implement is BOSS-serialized with `w1-text-box-autofit`** —
both features edit `editor.js` (me: toolbar chrome + `annLayer` visibility; them:
annotation-shape). Report `STORIES_LOCKED`; BOSS sets the implement order (same
pattern as Wave 0's `background.js` serialization).

## Critical directives

- **Build against the RELEASED `w0-editor-foundation` surface** (HEAD `6e42464`).
  Do not modify the frozen contract: `model` envelope `{version:1,items:[...]}`,
  `attachBoxTransformer(node,item)`, pure `__snapdeckEditorModel.*` in
  `editor-model.js`. This feature consumes the editor surface; it does not reshape
  the model.
- **Toolbar position persistence MUST use `chrome.storage.local`** (dedicated
  UI-chrome key) — NOT the IndexedDB report store, NOT the `model`. Keeps the
  feature orthogonal to both released w0 storage surfaces.
- **The visibility toggle MUST be a pure Konva visibility flip** (`annLayer.visible()`
  + hide selection chrome), non-destructive: never mutate `model`, never
  destroy/recreate nodes, never `snapshot()`.
- **Handle the `selectLayer`/transformer edge case**: hiding annotations must not
  leave the shared `Konva.Transformer` handles visible — hide `selectLayer` and/or
  deselect on toggle-off; restore on toggle-on.
- **Drag wrinkle**: convert the default `translateX(-50%)` centering to explicit
  `left/top` on first drag; clamp restored positions to the current viewport.
- **Pointer isolation**: grab handle + toggle button use DOM-level handling with
  pointer-capture / `stopPropagation` so they never initiate a stage draw or change
  selection.
- **Coordinate with `w1-text-box-autofit` on `editor.js`** — both touch the file in
  distinct regions (toolbar chrome + layer visibility vs. annotation-shape logic).
  Scope/decompose freely; BOSS serializes implement. Surface any line-level overlap
  at `STORIES_LOCKED`.
- **Test convention**: `node --test extension/*.test.mjs` (glob form) for the
  pure-logic seam (extract a small pure module for position clamp/serialize +
  toggle visibility-state, mirroring the `editor-model.js` dual-consumable pattern)
  + browser-tester E2E for the DOM-drag + Konva-render-dependent behavior. Ship one
  feature-distinct `*.test.mjs`.

## Mockup decision

`skip_ui_designer: true` — developer-facing in-page Konva editor (vanilla JS, not
the project's component-library UI; `frontend_lane: N/A`), consistent with
`w0-editor-foundation`. The feature adds a grab handle + a toggle button to the
**existing `.snapdeck-toolbar`** — affordances on a representative existing surface,
not new screens or branded components. The frontend-architect specs the handle and
toggle chrome from the existing toolbar (`buildToolbar()` + `overlay.css`); no
ui-designer mockups needed.

## Acceptance criteria (seeds for PO to expand)

- The editor toolbar has a grab handle; dragging it repositions the toolbar via DOM
  drag.
- The toolbar position persists across captures (`chrome.storage.local`) and is
  re-applied (clamped to viewport) in `openEditor()`, so re-opening restores the
  last position.
- A toggle control hides and shows the annotation layer (`annLayer`); when hidden,
  the raw captured screenshot is visible with no annotations — and no selection
  handles — drawn over it.
- Toggling visibility off then on restores all annotations unchanged (non-destructive
  — `model` and nodes unaltered).
- Toggling visibility does not add an undo/redo step (view state, not model state).
- Toolbar drag and the toggle do not interfere with annotation drawing or selection
  (never start an annotation, never change the current selection).
- No regression: existing arrow/box/text draw, select, transform, and undo/redo
  behave exactly as before whether the toolbar has been moved or the annotation
  layer is hidden.

## E2E coverage hints (PO will write the actual specs)

- Drag the toolbar grab handle to a new position; assert the toolbar moved and no
  annotation was created and no selection changed.
- Re-open the editor on a fresh capture; assert the toolbar restores its last
  persisted position from `chrome.storage.local` (and a stored offscreen position is
  clamped back into view).
- Toggle visibility off → `annLayer` hidden, selection chrome hidden, raw screenshot
  visible, zero annotations rendered; toggle on → all annotations restored unchanged;
  assert undo history is unaffected by the toggle.
- Pointer-isolation: interacting with the grab handle and the toggle button does not
  leak pointer events into the Konva stage (no stray annotation drawn, no selection
  change).
