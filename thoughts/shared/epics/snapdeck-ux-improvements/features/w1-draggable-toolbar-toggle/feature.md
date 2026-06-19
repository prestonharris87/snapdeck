---
type: feature
slug: w1-draggable-toolbar-toggle
wave: 1
parent_epic: snapdeck-ux-improvements
status: stub
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-editor-foundation]
frontend_lane: N/A
visual_references: []
---

# Feature: Draggable toolbar + annotation visibility toggle

## Summary

Two editor ergonomics improvements: a grab handle that lets the user drag the
annotation toolbar out of the way (DOM drag; position remembered across
captures), and a toggle that hides/shows the annotation layer so the user can
inspect the raw screenshot underneath. Depends on the editor foundation because
both touch the rebuilt editor surface, but they target the toolbar chrome and
the annotation-layer (`annLayer`) visibility — distinct regions from the
annotation-shape creation logic the text-box rework rewrites — so the two are
parallel-safe within the wave.

## Acceptance criteria seeds

- The editor toolbar has a grab handle; dragging it repositions the toolbar via
  DOM drag.
- The toolbar position is remembered across captures (persisted, so re-opening
  the editor restores the last position).
- A toggle control hides and shows the annotation layer (`annLayer`); when
  hidden, the raw captured screenshot is visible with no annotations drawn over
  it.
- Toggling visibility off then on restores all annotations unchanged (toggle is
  non-destructive — it does not clear or alter the model).
- Toolbar drag and the visibility toggle do not interfere with annotation
  drawing or selection (dragging the toolbar never starts an annotation).
