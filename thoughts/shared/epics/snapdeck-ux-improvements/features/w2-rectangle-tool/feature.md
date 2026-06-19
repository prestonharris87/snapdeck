---
type: feature
slug: w2-rectangle-tool
wave: 2
parent_epic: snapdeck-ux-improvements
status: stub
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-editor-foundation, w1-text-box-autofit]
frontend_lane: N/A
visual_references: []
---

# Feature: Rectangle (red-outline box) tool

## Summary

Add a red-outline rectangle annotation alongside arrows and text boxes, drawn by
drag and moved/resized via the shared box transformer — the same draw / move /
resize behavior as the other box-shaped annotations. Depends on the editor
foundation for the box model and shared transformer, and is sequenced *after*
the text-box auto-fit rework (rather than parallel to it) because both are
annotation-shape rewrites of the same region of `extension/content/editor.js`;
placing them in the same wave would force colliding same-file parallel edits.
Rectangle reuses the now-proven shared transformer and select-mode interaction
the text box established.

## Acceptance criteria seeds

- A rectangle tool exists alongside the arrow and text tools in the toolbar.
- The user drags to draw a rectangle with a red outline (transparent/no fill,
  matching the annotation style).
- In select mode the rectangle can be selected, moved, and resized via the
  shared Konva.Transformer (same handles as the text box).
- The rectangle is stored in the editor `model` and round-trips losslessly
  through persist → re-load.
- The shared transformer hypothesis holds: rectangle resize reuses the same
  handle mechanism as the text box without needing materially different
  behavior. (If it cannot, flag during scoping.)
- Existing arrow and text-box tools are unaffected by adding the rectangle tool.
