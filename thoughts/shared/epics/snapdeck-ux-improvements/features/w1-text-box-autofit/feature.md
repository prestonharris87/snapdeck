---
type: feature
slug: w1-text-box-autofit
wave: 1
parent_epic: snapdeck-ux-improvements
status: stub
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-editor-foundation]
frontend_lane: N/A
visual_references: []
---

# Feature: Text-box auto-fit rework (Google-Slides style)

## Summary

Replace the broken text tool with a draw-a-box text annotation that behaves like
Google Slides auto-fit: the user drags out a box, text wraps to the box and the
font auto-sizes to fit (capped at a maximum), and the box can be re-selected,
moved, resized, and re-edited with no flatten-to-one-line regression on commit.
Text renders as black on a white fill inside a red outline. Builds on the editor
foundation's box model, lossless `model` persistence, and shared
Konva.Transformer. This is the editor cluster's first annotation-shape rewrite;
it is sequenced ahead of the rectangle tool so the two annotation-shape changes
to `editor.js` do not collide in the same wave.

## Acceptance criteria seeds

- The text tool is draw-a-box: the user drags to define the text box geometry
  before/while entering text.
- Text wraps to the box width and the font auto-sizes to fit the box, capped at
  a configured maximum font size.
- On commit, wrapping and box geometry are preserved (no flatten-to-one-unwrapped-line
  regression); the box and its text/geometry are stored in the editor `model`.
- The text box renders with a white fill, a red outline, and black text.
- In select mode the text box can be re-selected, moved, and resized via the
  shared transformer; resizing re-fits the font within the cap.
- A committed text box can be re-opened for editing (double-click to edit;
  single-click selects/shows handles, per the confirmed interaction model).
- The box and its content round-trip losslessly through persist → re-load.
