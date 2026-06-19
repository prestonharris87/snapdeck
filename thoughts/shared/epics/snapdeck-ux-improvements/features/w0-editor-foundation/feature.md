---
type: feature
slug: w0-editor-foundation
wave: 0
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: []
frontend_lane: N/A
visual_references: []
---

# Feature: Annotation editor foundation (box model + lossless persistence + shared transformer)

## Summary

Introduce the spine the rest of the editor cluster hangs off: a box-shaped
annotation model, lossless persistence of the editor's full internal `model`
(arrows, text boxes with geometry, rectangles), and a single
Konva.Transformer-based move/resize mechanism shared by box-shaped annotations.
This refactor of the in-page Konva editor (`extension/content/editor.js`) lets a
captured screenshot round-trip exactly on re-open while the existing lossy
projection is still emitted alongside it for the downstream report→defects
consumer. It enables the text-box auto-fit rework, the rectangle tool, and the
gallery's lossless re-edit.

## Acceptance criteria seeds

- The editor maintains a structured internal `model` covering existing arrows
  and the new box-shaped annotation primitive (with x/y/width/height geometry).
- On commit, the editor persists the full `model` losslessly *in addition to*
  the existing lossy `{from,to}` / `{x,y,text}` projection — the projection is
  not removed or changed.
- A single shared Konva.Transformer move/resize mechanism handles box-shaped
  annotations (the same machinery the text box and rectangle tool will reuse).
- Re-loading a persisted `model` reconstructs the editor's annotation state
  exactly (no geometry or content loss) — a round-trip of model → persist →
  load → model is identity for box and arrow annotations.
- A select mode exists in which a box-shaped annotation can be selected and
  shows resize handles, distinct from the create/draw interaction.
- Existing arrow draw/move behavior is preserved (no regression to the current
  arrow tool).
