---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T02:38:48Z
---

# Annotation editor foundation — box model + lossless persistence + shared transformer

## Problem statement

The in-page annotation editor (`extension/content/editor.js`) keeps a rich internal
`model` while you draw, but throws it away on commit: `finish()` emits only the lossy
`{from,to}` / `{x,y,text}` projection (`resp.annotations`), so a screenshot can never be
re-opened and edited without geometry/content loss. Text annotations are point-anchored
(`{x,y,text}`) with no box geometry, and there is no general move/resize mechanism — arrows
use bespoke circle anchors and text can only be dragged. This feature lays the editor's
structural spine: a box-shaped annotation primitive with `x/y/width/height` geometry,
lossless persistence of the full `model` alongside the unchanged projection, and a single
shared `Konva.Transformer` move/resize used by every box-shaped annotation. It is the
wave-0 foundation four dependents build on (w1 text-box autofit, w1 draggable toolbar/toggle,
w2 rectangle tool, w2 screenshot gallery re-edit).

## In scope

- Internal `model` gains a **box-shaped annotation primitive** carrying `{x, y, width, height}`
  geometry (top-left origin, stage/CSS px at the capture viewport), alongside the existing arrow item.
- On commit, `editor.js` persists the **full internal `model` losslessly** in the
  editor→background resolve payload (new additive `model` field) **in addition to** the existing
  lossy `annotations` projection — the projection is byte-for-byte unchanged.
- `background.js` stores the lossless `model` on the per-screenshot record in the local
  in-progress report store, so a stored screenshot can later round-trip back into the editor exactly.
- A single shared **`Konva.Transformer`-based move/resize mechanism** for box-shaped annotations,
  exposed as an internal helper the text-box (w1) and rectangle (w2) tools reuse.
- A **select mode** in which a box-shaped annotation can be clicked to select and shows resize
  handles, distinct from the create/draw interaction.
- Round-trip identity: `model → persist → load → model` reconstructs box and arrow annotations
  with no geometry/content loss.
- Existing **arrow draw / endpoint-edit / move / undo / redo behavior is preserved** (no regression).

## Out of scope (explicit)

- The lossy projection schema and the upstream `/report/save` payload are **unchanged** — the
  downstream report→defects consumer sees no difference. The lossless `model` is persisted in the
  local in-progress store only.
- **Text auto-fit / wrap / styling** (white fill, red outline, black text, capped font auto-size,
  double-click-to-edit semantics) — that is **w1-text-box-autofit**, built on this foundation.
- **The rectangle tool** (user-facing red-outline rectangle) — that is **w2-rectangle-tool**.
- **Toolbar drag + annotation-visibility toggle** — that is **w1-draggable-toolbar-toggle**.
- **The popup gallery / re-open / delete UI** — that is **w2-screenshot-gallery** (this feature only
  guarantees the persisted `model` that feature will consume).
- **Rotation** of box annotations — the shared transformer ships with `rotateEnabled: false` for v1;
  the geometry contract reserves no rotation field.
- No new editor page/tab; no change to capture or the localhost-only guard; no report-store
  **re-keying** (that is w0-per-target-reports — see coordination note).

## Branch policy

Lands on the epic feature branch coordinated by BOSS. Commits are autonomous with atomic pathspec
(`git commit -- <paths>`); `git push` only on BOSS ack via `READY TO PUSH`. Same-wave parallel-safe
with w0-keyboard-shortcuts and w0-per-target-reports.

## Critical directives

- **Projection is frozen.** Do NOT alter the shape, rounding, or field names of `resp.annotations`
  or the `/report/save` payload. The `model` is strictly additive.
- **Contracts must be architect-ratified, then frozen.** The three contract surfaces below (box
  geometry, persisted `model` schema, shared transformer API) are the load-bearing outputs four
  features build on. Architects lock them during `/mat_write_feature`; a frozen 🤝 CONTRACT is
  published to `#…/active` at STORIES_LOCKED.
- **Cross-feature seam with w0-per-target-reports (same wave).** This feature adds a `model` field to
  each per-screenshot sub-record; w0-per-target-reports owns the report-store keying + record shape.
  The two are orthogonal layers of the same record — coordinate so the per-screenshot `model` field
  survives the re-keyed store. Raise on `#…/active`.
- **Reuse existing seams.** Keep the `model`-driven `render()` loop, the `snapshot()/undo/redo`
  history, and the `ANNOTATE`-message resolve contract; extend, don't rewrite.
- **MV3 content script.** `editor.js` runs in the page's isolated world; the resolve payload is the
  only channel to `background.js` — the `model` must travel on it.

## Mockup decision

`skip_ui_designer: true` — this is a structural/mechanism refactor of an existing Konva canvas editor
(`frontend_lane: N/A`; the extension is vanilla-JS + Konva, not the project's component-library UI).
The only new visible affordance is standard `Konva.Transformer` resize-handle chrome on a selected
box; there are no new screens or branded visual components to design. The visual styling of the text
box (white fill / red outline / black text) is owned by w1-text-box-autofit, which can run the
ui-designer if needed.

## Contract surfaces (architects ratify in /mat_write_feature; frozen at STORIES_LOCKED)

### 1. Box-model geometry
A box-shaped annotation carries `{ x, y, width, height }` — top-left origin, stage/CSS px at the
capture viewport (`meta.viewport.{w,h,dpr}`). No rotation in v1.

### 2. Persisted lossless `model` schema  (4 dependents — the load-bearing one)
Proposed v1 envelope on the resolve payload (additive, alongside `annotations`):

```
model: {
  version: 1,
  items: [
    { id, type: "arrow", x1, y1, x2, y2 },                  // existing geometry, now persisted
    { id, type: "<box-subtype>", x, y, width, height, … }   // box base; subtype fields owned by w1/w2
  ]
}
```

Geometry is in the `meta.viewport` coordinate space already on the record. Stored at
`screenshots[].model` in the local in-progress report store; NOT added to the upstream
`/report/save` payload. Re-edit reconstructs the editor from `screenshots[].model`
(image + model + viewport + console/network).

### 3. Shared Konva.Transformer move/resize API
An internal `editor.js` helper that attaches one shared `Konva.Transformer` to a selected box node in
select mode, writes resized/moved geometry back to the model item, and commits a `snapshot()` for
undo. Text-box (w1) and rectangle (w2) attach to it rather than rolling their own resize
(`rotateEnabled: false`).

**Open design decision for architects:** which concrete box-shaped annotation the foundation ships to
*exercise* the machinery — e.g. migrate the existing point-anchored `text` to box-shaped, or introduce
a minimal generic box. Pick the option that proves select + resize + round-trip with the least surface
w1/w2 must later rework.

## Acceptance criteria (seeds for PO to expand)

- Internal `model` represents arrows and at least one box-shaped primitive with `{x,y,width,height}`.
- On Done, the resolve payload carries both the unchanged `annotations` projection AND a lossless
  `model`; `background.js` stores `model` on the screenshot record.
- A box annotation can be selected in select mode and shows `Konva.Transformer` handles; drag-resize
  updates its geometry.
- Round-trip: persisting a `model` then reloading it reconstructs box + arrow annotations exactly
  (no geometry/content drift).
- Arrow draw / endpoint-drag / move / undo / redo are unchanged from current behavior.
- The lossy projection bytes and `/report/save` payload are identical to pre-feature output for the
  same annotations.

## E2E coverage hints (PO writes the specs)

- Draw an arrow + a box, Done, and assert the stored record carries both the lossy `annotations` and
  the lossless `model`.
- Select a box in select mode, resize via a handle, Done, reload the `model`, assert geometry survived
  the round-trip.
- Draw only arrows, Done, assert the lossy projection + `/report/save` payload are byte-identical to
  current output (no regression).
