---
type: screenshots
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
status: n/a
authored_by: product-owner
authored_at: 2026-06-19T04:28:00Z
---

# Validation screenshots: Draggable toolbar + annotation visibility toggle

**Not applicable** — this is a non-UI feature (`skip_ui_designer: true`, `frontend_lane: N/A`). It is an
editor-chrome ergonomics change to the vanilla-JS Konva editor (`extension/content/editor.js`): a grab
handle that DOM-drags the existing `.snapdeck-toolbar` (position persisted in `chrome.storage.local`) and
a non-destructive `annLayer` visibility toggle. There are no new screens or branded component-library
visuals to capture — the new affordances are a handle + a toggle button on the existing toolbar, and the
proof is behavioral (toolbar moves and restores clamped-to-viewport, annotations + selection chrome hide
and restore unchanged, no undo impact, pointer isolation), covered by the feature's browser-tester E2E
specs rather than a static screenshot. Consistent with the released w0-editor-foundation feature. Phase 5b
capture skips this feature.
