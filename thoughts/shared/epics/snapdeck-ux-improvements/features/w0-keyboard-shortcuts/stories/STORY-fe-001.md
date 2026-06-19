---
type: story
id: STORY-fe-001
name: "No frontend changes — keyboard-shortcut is background-worker only"
domain: frontend
parent_feature: w0-keyboard-shortcuts
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 1
status: approved
sentinel: true
depends_on: []
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/popup.html
  - extension/popup.js
  - extension/content.js
  - extension/annotate.js
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-023636-42973
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: No frontend changes — keyboard-shortcut is background-worker only

## What we're doing

**No frontend changes required for this feature.**

`w0-keyboard-shortcuts` adds a Chrome `commands` binding (`Cmd/Ctrl+Shift+S`)
plus a top-level `chrome.commands.onCommand` listener in
`extension/background.js` that dispatches to the existing, unchanged
`addScreenshot()` seam, and a popup-independent result signal
(action-badge text or a `chrome.notifications` toast). All of that lives in the
extension's **manifest + background service worker** — the backend-architect's
domain.

My domain (the popup UI, content scripts, and the in-page annotation overlay) is
**explicitly out of scope** per the locked feature:

> "No changes to the annotation overlay, content scripts, or popup UI."
> — `feature.md` § Out of scope (also `scope.md` § Out of scope)

There are no new screens, no popup-UI changes, and no content-script/overlay
changes. The only on-screen surfaces the user perceives — the existing
annotation overlay that `addScreenshot()` already drives, and the new
background-driven result badge/notification — are owned outside this feature's
frontend domain and introduce no new animation. This is a sentinel story
recording the architect's explicit "no FE work" decision; `/mat_write_feature`
Phase 8.5 will prune it into `feature.md` § No-work domains.

## What it should look like

n/a — no FE deliverable. The user-visible result signal for the shortcut
(badge / `chrome.notifications` toast) is authored by the backend-architect in
the service-worker story, not as a popup/overlay surface.

## How we're doing it

n/a — no frontend files are touched. See the backend-architect's stories for
the manifest `commands` block, the top-level `chrome.commands.onCommand`
listener, and the result-signal implementation.

## How we validate it was done correctly

- [ ] No diff under `extension/popup.*`, `extension/content.js`, or the
      annotation-overlay sources for this feature.
- [ ] The user-visible not-a-target / error signal is delivered by the
      background worker (action badge or `chrome.notifications`), not by a popup
      or in-page overlay render.

## Motion contract

n/a — non-UI (extension manifest + background service worker) feature. No
animated elements are added by the frontend domain; the existing annotation
overlay and the result badge/notification are owned outside this domain and
introduce no new motion.

## Unit tests

n/a — no frontend code to test. The behavioral coverage (shortcut dispatch,
not-a-target signal, service-worker re-registration, cancelled-annotate) is
exercised by the PO's E2E specs against the background worker and by the
backend-architect's unit tests.

## Dependencies

none — sentinel story; no cross-domain consumer relationship exists for the
frontend domain. (The feature's substantive work is backend-only:
manifest `commands` + `chrome.commands.onCommand` listener dispatching to the
existing `addScreenshot()` seam.)

## History

- 2026-06-18 — created by frontend-architect (effort=1, sentinel, depends on none).
  No-FE-work decision peer-confirmed with backend-architect (see
  `thoughts/shared/epics/snapdeck-ux-improvements/conversations/`).

## Revisions

- 2026-06-19 — product-owner (Phase 6 arbitrate): promoted `status: pending →
  approved`. No content change — the no-FE-work sentinel is correct
  (popup/content/overlay explicitly out of scope; the result signal is the
  background worker's action badge, not a popup/overlay render). validates
  checklist present. See `../conversations/0014-product-owner-arbitration-summary.md`.
