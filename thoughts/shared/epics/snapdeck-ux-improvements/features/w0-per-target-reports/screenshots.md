---
type: screenshots
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
status: n/a
authored_by: product-owner
authored_at: 2026-06-19T03:20:00Z
---

# Validation screenshots: Per-target in-progress reports

No UI surface to capture — `skip_ui_designer: true`, `frontend_lane: N/A`. This
feature re-keys the in-progress report store from one global IndexedDB record to
a per-browser-port key (`report:<browserPort>`); it is service-worker /
IndexedDB plumbing with no new or changed visual surface. The popup
(`popup.html`/`popup.js`) is unchanged and renders the identical count/note UI
it did before. Acceptance is proven by the message-API E2E specs in `feature.md`,
not by screenshots. Phase 5b capture is skipped for this feature.
