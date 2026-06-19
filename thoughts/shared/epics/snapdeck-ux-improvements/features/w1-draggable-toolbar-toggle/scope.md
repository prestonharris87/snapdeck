---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T04:27:08Z
---

# Draggable toolbar + annotation visibility toggle

> ⚠️ **PARKED (pre-release draft).** Authored 2026-06-19 against the *team-frozen*
> (not yet released/merged) `w0-editor-foundation` contract during an early
> scope-now kickoff that BOSS subsequently retracted. Per epic wave discipline,
> Wave 1 must (re)scope against **RELEASED** Wave-0 contracts (merged + gate-2
> reviewed), since a gate-2/integration change can still shift the editor seam.
> Treat this as a high-confidence draft to **review/refresh against the released
> contract** when BOSS re-kicks-off scoping — not as the final locked scope.

## Problem statement

The in-page Konva annotation editor (`extension/content/editor.js`) renders its
toolbar in a fixed spot over the captured screenshot. Two ergonomics gaps follow:
(1) the toolbar can sit directly over the region the user wants to annotate, with
no way to move it aside; and (2) there is no way to temporarily hide the
annotation layer to inspect the raw screenshot underneath. This feature adds a
**grab handle** that lets the user drag the toolbar out of the way (DOM drag,
position remembered across captures) and a **non-destructive toggle** that
hides/shows the annotation layer (`annLayer`) so the raw capture is visible
beneath. It is an editor-chrome ergonomics feature — no annotation-shape or
persistence-model changes.

## In scope

- The editor toolbar gains a **grab handle**; dragging the handle repositions the
  toolbar via **DOM drag** (the toolbar is HTML chrome over the Konva stage — drag
  is DOM-level, not a Konva-stage drag).
- The toolbar position is **persisted in `chrome.storage.local`** (a dedicated
  UI-chrome key) so re-opening the editor on a later capture restores the last
  position.
- A **toggle control** in the toolbar hides/shows the Konva annotation layer
  (`annLayer`) — a pure `annLayer.visible(false|true)` + redraw flip.
- When hidden, the **raw captured screenshot is visible with no annotations drawn
  over it** (the base image layer remains; only the annotation layer is hidden).
- The toggle is **non-destructive**: toggling off then on restores all annotations
  **unchanged** — it never clears or alters the `model` or the Konva nodes, it only
  flips layer visibility.
- The toggle is **view state, not model state**: toggling does **not** push an
  undo/redo step and does not call `snapshot()`.
- Toolbar drag and the toggle **never interfere with annotation drawing or
  selection**: dragging the toolbar never starts an annotation, clicking the toggle
  never starts an annotation, and pointer events on the toolbar chrome (handle +
  toggle button) do not leak into the Konva stage.

## Out of scope (explicit)

- **No change to the annotation `model` envelope, the lossy `annotations`
  projection, or the resolve / `/report/save` payloads.** Those are owned by
  `w0-editor-foundation`; this feature's visibility toggle and toolbar position
  never touch the model.
- **No change to the IndexedDB report store or its re-keying** (`w0-per-target-reports`).
  Toolbar position lives in `chrome.storage.local`, NOT the report store.
- **No new annotation shapes or tools** (text box → `w1-text-box-autofit`;
  rectangle → `w2-rectangle-tool`).
- **No persistence of the toggle state.** Visibility resets to "shown" on each
  editor open; only the toolbar *position* persists. (Deferred — the ACs only call
  for position persistence.)
- No toolbar resize, no toolbar rotation, no docking/snap-to-edge behavior.
- No change to capture, the localhost-only guard, or the editor's existing
  arrow/box draw / select / transform / undo / redo behavior.

## Branch policy

Lands on the epic feature branch; BOSS coordinates all pushes to the GitHub mirror
feature branch. **Scope + decompose are gated on Wave 0 being RELEASED** (merged +
gate-2 reviewed) — especially `w0-editor-foundation`, since the rebuilt editor
surface (toolbar DOM + `annLayer` reference) must be final before this feature
scopes/decomposes/implements against it. BOSS re-kicks-off scope + decompose once
Wave 0 ships.

## Critical directives

- **Build against `w0-editor-foundation`'s RELEASED contract** (not the team-frozen
  one). Do not modify it: `model` envelope `{ version: 1, items: [...] }`,
  `attachBoxTransformer(node, item)`, and the pure
  `__snapdeckEditorModel.{serialize, project, deserialize}` in `editor-model.js`.
  This feature consumes the editor surface; it does not reshape the model.
- **Toolbar position persistence MUST use `chrome.storage.local`** (a dedicated
  UI-chrome key, e.g. `editorToolbarPosition: {x, y}`) — NOT the IndexedDB report
  store and NOT the `model` envelope. This keeps the feature orthogonal to both
  `w0-per-target-reports` (report-store re-keying) and `w0-editor-foundation`
  (model persistence). Verified against `data-model.md`: the report store is
  per-port report data, not editor-chrome prefs.
- **The visibility toggle MUST be a pure Konva layer-visibility flip**
  (`annLayer.visible()`), non-destructive: never mutate the `model`, never clear or
  recreate nodes, and never emit a `snapshot()` (toggling must not pollute
  undo/redo).
- **Drag + toggle pointer isolation.** The grab handle and toggle button must use
  DOM-level pointer handling and `stopPropagation` / otherwise not forward pointer
  events to the Konva stage, so they never initiate an annotation draw or change
  the current selection.
- **Do NOT guess `editor.js` internals — confirm against the RELEASED
  `w0-editor-foundation` surface:** the exact toolbar DOM structure, the `annLayer`
  reference, and where the editor open/init happens. The toolbar may be
  restructured by the w0 work; confirm the final seam before implementing.
- **Test convention:** `node --test extension/*.test.mjs` (glob form) for the pure
  logic (e.g. position persistence read/write, toggle visibility state machine) +
  browser-tester E2E for the Konva-render-dependent / DOM-drag behavior. Ship one
  feature-distinct `*.test.mjs`.

## Mockup decision

`skip_ui_designer: true` — this is the developer-facing in-page Konva editor
(vanilla JS, not the project's component-library UI; `frontend_lane: N/A`),
consistent with `w0-editor-foundation`. The feature adds a grab handle and a toggle
button to the **existing editor toolbar** — affordances on a representative
existing surface, not new screens or branded components. The frontend-architect can
spec the handle/toggle chrome from the existing toolbar; no ui-designer mockups are
needed.

## Acceptance criteria (seeds for PO to expand)

- The editor toolbar has a grab handle; dragging it repositions the toolbar via DOM
  drag.
- The toolbar position persists across captures (`chrome.storage.local`) so
  re-opening the editor restores the last position.
- A toggle control hides and shows the annotation layer (`annLayer`); when hidden,
  the raw captured screenshot is visible with no annotations drawn over it.
- Toggling visibility off then on restores all annotations unchanged (the toggle is
  non-destructive — it does not clear or alter the `model`).
- Toggling visibility does not add an undo/redo step (visibility is view state, not
  model state).
- Toolbar drag and the visibility toggle do not interfere with annotation drawing
  or selection (dragging the toolbar or clicking the toggle never starts an
  annotation, never changes the current selection).
- No regression: existing arrow/box draw, select, transform, and undo/redo behave
  exactly as before whether the toolbar has been moved or the annotation layer is
  hidden.

## E2E coverage hints (PO will write the actual specs)

- Drag the toolbar grab handle to a new position; assert the toolbar moved and no
  annotation was created and no selection changed.
- Re-open the editor on a fresh capture; assert the toolbar restores its last
  persisted position from `chrome.storage.local`.
- Toggle visibility off → `annLayer` hidden, raw screenshot visible, zero
  annotations rendered; toggle on → all annotations restored unchanged; assert undo
  history is unaffected by the toggle.
- Pointer-isolation: interacting with the grab handle and the toggle button does
  not leak pointer events into the Konva stage (no stray annotation drawn, no
  selection change).
