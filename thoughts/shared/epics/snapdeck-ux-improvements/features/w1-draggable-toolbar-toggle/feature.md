---
type: feature
slug: w1-draggable-toolbar-toggle
wave: 1
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-042600-10898
depends_on: [w0-editor-foundation]
frontend_lane: N/A
skip_ui_designer: true
visual_references: []
---

# Feature: Draggable toolbar + annotation visibility toggle

## Summary

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

## User-facing behavior

The "user" here is the developer/tester annotating captured screenshots in the
in-page Konva editor (a developer-facing annotation tool, not the project's
component-library UI; `frontend_lane: N/A`, `skip_ui_designer: true` — no mockups).

- The editor toolbar gains a **grab handle**. The dev presses the handle and drags
  the whole `.snapdeck-toolbar` out of the way of the region they want to annotate.
  Dragging moves the toolbar via DOM drag — the toolbar is screen-positioned chrome
  (a sibling of the Konva stage), so moving it never disturbs the screenshot or any
  annotation.
- The toolbar **stays where the dev put it**: the position is remembered across
  captures. On the next capture (a later `openEditor()`), the toolbar re-opens at
  its last position rather than snapping back to the screen center. A position that
  would land off-screen (e.g. after a window resize) is pulled back into view.
- The toolbar gains a **visibility toggle** button. Clicking it **hides** the
  annotation layer so the dev can inspect the raw captured screenshot underneath
  with nothing drawn over it; clicking again **shows** the annotations exactly as
  they were. Hiding also clears any selection chrome (resize handles) so nothing
  floats over the "hidden" layer.
- The toggle is **non-destructive and view-only**: hiding then showing restores
  every annotation unchanged, and toggling never creates an undo/redo step (it is
  not an edit). Toggle state is not remembered between captures — every editor open
  starts with annotations shown.
- All existing editor behavior is unchanged: arrow/box/text draw, select, transform,
  undo, and redo work exactly as before, whether or not the toolbar has been moved
  or the annotation layer is currently hidden.

## UX patterns / interaction notes

- **Grab-handle affordance on the existing toolbar.** The handle is a new affordance
  on `buildToolbar()`'s `.snapdeck-toolbar`, not a new surface or branded component.
  It reads as a draggable grip (cursor affordance) and is the only drag target — the
  rest of the toolbar's buttons keep their click behavior.
- **DOM drag, not a stage drag.** Repositioning is DOM-level on the toolbar element
  (which is `position:fixed`), not a Konva-stage drag. On first drag, the default
  centering transform (`transform:translateX(-50%)`) is converted to explicit
  fixed-viewport `left/top` so the stored position is unambiguous.
- **Pointer isolation is load-bearing.** The grab handle and the toggle button live
  outside the Konva `stage` listeners; they use DOM-level handling with
  pointer-capture + `stopPropagation` so a drag or a toggle click never leaks a
  pointer event into the stage — i.e. never starts an annotation and never changes
  the current selection.
- **Toggle hides selection chrome, not just the layer.** The shared
  `Konva.Transformer` lives on a *separate* `selectLayer`, so hiding only `annLayer`
  would leave resize handles floating over hidden annotations. The toggle must also
  hide `selectLayer` (and/or deselect) while annotations are hidden, and restore on
  show.
- **Toggle is a pure visibility flip.** Hide/show is `annLayer.visible(false|true)`
  + redraw — it never mutates `model`, never destroys/recreates nodes, and never
  calls `snapshot()`. It is view state, not model state.
- **Position persists; visibility does not.** Only the toolbar *position* is written
  to `chrome.storage.local`; the toggle resets to "shown" on each editor open.

## Acceptance criteria

- [ ] The editor toolbar (`.snapdeck-toolbar`, built by `buildToolbar()`) has a
      **grab handle**; pressing and dragging the handle repositions the toolbar via
      **DOM drag** (DOM-level on the `position:fixed` toolbar element, not a Konva
      stage drag).
- [ ] On the first drag, the toolbar's default centering transform
      (`transform:translateX(-50%)`) is converted to explicit fixed-viewport
      `left/top` so the dragged position is unambiguous.
- [ ] The toolbar position is **persisted in `chrome.storage.local`** under a
      dedicated UI-chrome key (e.g. `snapdeckEditorToolbarPos: {left, top}`) — NOT
      in the IndexedDB report store and NOT in the editor `model`.
- [ ] On editor open, `openEditor()` reads the stored position and re-applies it,
      **clamped to the current viewport**, so re-opening the editor restores the last
      position and a stored off-screen position cannot strand the toolbar.
- [ ] A **toggle control** (a new toolbar button via the existing `btn()` pattern,
      wired through a new `bar.onToggleVisibility` callback) hides and shows the
      annotation layer (`annLayer.visible(false|true)` + redraw).
- [ ] When annotations are hidden, the **selection chrome is also hidden** — the
      shared `Konva.Transformer` on `selectLayer` is hidden and/or the selection is
      cleared so no resize handles float over the hidden layer; it is restored on
      show.
- [ ] When hidden, the **raw captured screenshot (`bgLayer`) is visible with zero
      annotations drawn over it**.
- [ ] The toggle is **non-destructive**: toggling off then on restores all
      annotations **unchanged** — it never mutates `model`, never destroys/recreates
      nodes, only flips layer visibility.
- [ ] Toggling visibility **does not add an undo/redo step** — it does not call
      `snapshot()` (view state, not model state); undo history is identical before
      and after a toggle.
- [ ] The toggle state is **not persisted**: every editor open starts with
      annotations shown (only the toolbar *position* persists across captures).
- [ ] Toolbar drag and the toggle **never interfere with annotation drawing or
      selection**: dragging the toolbar never starts an annotation, clicking the
      toggle never starts an annotation, and neither changes the current selection
      (pointer-capture + `stopPropagation` on the handle and toggle button).
- [ ] **No regression:** existing arrow/box/text draw, select, transform, undo, and
      redo behave exactly as before — whether or not the toolbar has been moved and
      whether or not the annotation layer is currently hidden.

## E2E test spec (written by Product Owner)

These run against the in-page content-script editor via the browser-tester's
Playwright harness. The DOM target is `.snapdeck-toolbar` (the toolbar element +
its grab handle and new toggle button); the Konva targets are `annLayer`,
`selectLayer`, and `bgLayer`; the persistence target is the dedicated
`chrome.storage.local` toolbar-position key. **Testing-gotcha note** (testing.md §
"E2E behavioral gotchas", read this run): the SPA hard-refresh→re-login gotcha does
**not** apply here — this is a Chrome MV3 in-page editor with no login screen, and
"re-open the editor" means a fresh `openEditor()` on a new capture (not a browser
hard-refresh of an authed app). `chrome.storage.local` persists across editor opens
with no re-auth step.

### Test: dragging the grab handle repositions the toolbar without touching annotations

**Given** the in-page editor is open on a captured localhost screenshot, the toolbar
is at its default centered position, and one arrow has been drawn (a known, stable
annotation/selection baseline)
**When** the dev presses the toolbar grab handle and drags it to a new on-screen
position, then releases
**Then** the `.snapdeck-toolbar` element has moved to the new position (its computed
`left/top` reflect the drag and its centering `transform:translateX(-50%)` has been
converted to explicit `left/top`), **and** no new annotation was created (the
annotation/`model` item count is unchanged), **and** the current selection is
unchanged (no transformer attached/detached as a side effect of the drag), with no
console errors.

### Test: toolbar position persists and is restored (clamped) on the next editor open

**Given** the dev has dragged the toolbar to a known position so
`chrome.storage.local` holds `snapdeckEditorToolbarPos: {left, top}`
**When** the editor is closed and re-opened on a fresh capture via `openEditor()`
(new content-script open — not a browser hard-refresh; no re-login applies)
**Then** the toolbar re-opens at the stored position (not the default center)
**And** given a stored position deliberately set off-screen (e.g. `left/top` beyond
the current viewport) and the editor re-opened, the toolbar is **clamped back into
view** (its on-screen rect is fully within the viewport), so a stale off-screen
position never strands the toolbar.

### Test: visibility toggle hides annotations + selection chrome non-destructively, with no undo impact

**Given** the editor is open with two annotations drawn and one of them selected
(so the shared `Konva.Transformer` on `selectLayer` is showing resize handles), and
the current undo-history depth is recorded
**When** the dev clicks the visibility toggle once
**Then** `annLayer.visible()` is `false` and the layer renders nothing — the raw
captured screenshot (`bgLayer`) is visible with zero annotations drawn over it —
**and** the selection chrome is hidden too (no `Konva.Transformer` handles float
over the hidden layer)
**When** the dev clicks the visibility toggle a second time
**Then** `annLayer.visible()` is `true` and **all** annotations are restored
**unchanged** (same `model` items, same node geometry — nothing destroyed/recreated),
**and** the undo-history depth is **identical** to the pre-toggle value (the toggle
committed no `snapshot()`), so an immediate Undo affects the last real edit, not the
toggle.

### Test: pointer isolation — grab handle and toggle never leak into the Konva stage

**Given** the editor is open on a captured screenshot with no annotations drawn yet
and no current selection
**When** the dev presses + drags the grab handle and (separately) clicks the
visibility toggle button
**Then** no pointer event reaches the Konva `stage`: zero stray annotations are
created (the `model` item count stays at 0) and the selection state is unchanged —
confirming the handle and toggle handle their own pointer events with
pointer-capture + `stopPropagation`.

### Motion E2E

`Motion E2E: n/a` — `frontend_lane: N/A`, `skip_ui_designer: true`. This is a
vanilla-JS Konva editor-chrome feature with no project component-library motion
tokens. The new affordances (a grab handle and a toggle button on the existing
`.snapdeck-toolbar`) are plain DOM/Konva chrome — the toolbar follows the pointer
on drag and the layer flips visibility on toggle, with no branded
animation/transition to assert. Consistent with the released `w0-editor-foundation`
feature.

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

## Out of scope

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

## Stories (populated by architects)

- (none yet — populated by architects during /mat_write_feature)

## Defects (populated as found)

- (none yet)
