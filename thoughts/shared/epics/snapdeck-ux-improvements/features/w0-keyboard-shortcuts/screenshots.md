---
type: screenshots
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
status: n/a
authored_by: product-owner
authored_at: 2026-06-19T02:48:00Z
---

# Validation screenshots: Keyboard shortcut for capture

Non-UI feature (`frontend_lane: N/A`, `skip_ui_designer: true`) — this change is
entirely a manifest `commands` block plus a top-level `chrome.commands.onCommand`
listener in the background service worker, dispatching to the existing
`addScreenshot()` seam. There are no new screens, popup-UI changes, or
content-script/overlay changes to capture, so there is no screenshot contract.
Phase 5b skips capture for this feature.
