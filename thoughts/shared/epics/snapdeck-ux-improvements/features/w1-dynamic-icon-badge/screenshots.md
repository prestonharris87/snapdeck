---
type: screenshots
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
status: n/a
authored_by: product-owner
authored_at: 2026-06-19T15:18:00Z
---

# Validation screenshots: Dynamic per-tab toolbar icon + badge

No UI surface to capture. This is service-worker / `action`-API work (`skip_ui_designer: true`, `frontend_lane: N/A`): the only visual artifact is the browser toolbar icon + numeric badge, which lives in Chrome's chrome (not a page DOM) and is not reachable by the ui-designer/browser-tester screenshot pipeline. The per-`tabId` gray/green/orange+count state machine is proven by the unit tests and the 10 Given/When/Then E2E specs in `feature.md` (asserting the per-`tabId` `action` state — `setIcon`/`setBadgeText`/`setBadgeBackgroundColor` — plus `/resolve` probe observation), not by page screenshots. Phase 5b capture is skipped.
