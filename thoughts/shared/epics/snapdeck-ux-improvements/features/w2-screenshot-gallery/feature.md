---
type: feature
slug: w2-screenshot-gallery
wave: 2
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-per-target-reports, w0-editor-foundation]
frontend_lane: N/A
visual_references: []
---

# Feature: Screenshot gallery — review, re-open / edit, delete

## Summary

From the popup, let the user review the screenshots in the current target's
in-progress report as thumbnails, click one to re-open it in the same in-page
editor on the stored PNG, edit and re-save it (lossless round-trip), or delete
it behind a confirmation step. Re-editing reuses the existing in-page overlay
(no separate editor tab) since the stored PNG covers the host page exactly as
during capture. Depends on per-target reports (whose report's thumbnails to
render) and the editor foundation (lossless `model` persistence is what makes
the re-edit round-trip exact). The popup-side and re-open-entry work is a
distinct region from the rectangle tool's annotation-shape rewrite, keeping the
two Wave 2 features parallel-safe.

## Acceptance criteria seeds

- The popup renders thumbnails of the current target's in-progress report
  screenshots (per-target, keyed by browser-port).
- Clicking a thumbnail re-opens that screenshot in the in-page editor on the
  stored PNG, with the persisted `model` (annotations, geometry) restored
  exactly — and stored console/network buffers preserved.
- Re-edit reuses the existing in-page overlay at screenshot-native sizing; the
  original page need not be open.
- "Done" re-saves and replaces the existing report record with the edited
  version (edits intact — lossless round-trip).
- "Delete" is a destructive control gated behind a confirmation step; confirming
  removes that screenshot from the current target's report.
- Deleting a screenshot updates the report count (and therefore the badge/icon
  count) accordingly.
