---
type: story
id: STORY-be-001
name: "No backend work — draggable toolbar + visibility toggle are content-script-side"
domain: backend
parent_feature: w1-draggable-toolbar-toggle
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
sentinel: true
depends_on: []
diff_estimate: mechanical
files_modified: []
files_not_modified: [extension/background.js, controller/snapdeck_controller/reports.py, controller/snapdeck_controller/server.py, extension/manifest.json]
reuse_patterns: []
created_at: 2026-06-19T15:22:00Z
last_run_id: run-20260619-042600-10898
visual_references: []
defects: []
---

# Story: No backend changes required for this feature

No backend changes required for this feature.

## Why this is a no-work domain (sentinel)

This is an editor-chrome ergonomics feature whose two affordances are both
**content-script-side and view-local**. Neither touches the Chrome MV3 service
worker (`extension/background.js`) nor the Python controller. Verified by opening
the actual files (Verified: 2026-06-19):

- **Toolbar position persistence uses `chrome.storage.local`, written/read directly
  from the content script.** The `storage` permission is already granted
  (`extension/manifest.json:6` — `["activeTab","tabs","scripting","storage","unlimitedStorage"]`),
  and `editor.js` is registered as a content script (`extension/manifest.json:41`,
  `run_at: document_idle`). Content scripts can call `chrome.storage.local.get/set`
  directly with that permission — there is **no service-worker mediation** of
  `chrome.storage.local`, and no new `background.js` message type is required.
- **`background.js` has zero `chrome.storage.local` usage and no handler for
  toolbar position or layer visibility.** Its message switch handles only
  `GET_STATE`, `SET_NOTE`, `ADD_SCREENSHOT`, `SAVE_REPORT`, `CLEAR_REPORT`
  (`background.js:165-190`). Its report store is **service-worker-context
  IndexedDB** accessed via the `idb()` helpers (`background.js:10-48`) — an
  entirely separate surface from `chrome.storage.local`. (Per backend lessons:
  the in-progress report store is the SW's IndexedDB, not `chrome.storage`.)
- **The `ANNOTATE` editor→SW resolve contract stays frozen.** The only editor↔SW
  IPC is the `ANNOTATE` message (`editor.js:12-14` ← dispatched at
  `background.js:209`). Its response object (`resp`, consumed at
  `background.js:213-228`, including `model: resp.model ?? null`) records
  **per-screenshot** annotation data. Toolbar position is **global editor-chrome
  state** (not per-screenshot) and the visibility toggle is **non-persisted view
  state** — so neither rides the `resp` payload, and the screenshot-record push
  literal (`background.js:215-226`) and the `/report/save` field whitelist
  (`background.js:248-252`) are untouched.
- **The Python controller is untouched.** No new field rides the `/report/save`
  payload and there is no new `/resolve` behavior — toolbar position lives only in
  `chrome.storage.local` on the browser side, per scope.md § Out of scope.
- **Visibility toggle is a pure Konva view-state flip** (`annLayer.visible()` +
  hide selection chrome on `selectLayer`) with no persistence whatsoever — nothing
  for the backend regardless.

This determination matches `scope.md` ("Toolbar position lives in
`chrome.storage.local`, NOT the report store / `model`") and `feature.md` § Out of
scope, and is the same data-flow direction noted in backend lessons: the content
script owns this state; the service worker does not consume it.

## How we validate it was done correctly

- [ ] **Empty backend diff:** this feature's diff contains **no** change to
      `extension/background.js` (no new message type, no `chrome.storage.local`
      handler, no IndexedDB `idb()`/`getReport`/`setReport`/`addScreenshot` touch)
      and **no** change to the Python controller (`controller/snapdeck_controller/
      reports.py`, `server.py`).
- [ ] **`ANNOTATE` resolve contract frozen:** the editor→SW `resp` payload shape
      (`background.js:213-228`, incl. `model: resp.model ?? null`), the
      screenshot-record push literal (`:215-226`), and the `/report/save` field
      whitelist (`:248-252`) are byte-unchanged.
- [ ] **Toolbar position never rides a backend surface:** confirm (via the FE story
      diff) toolbar position is written/read ONLY through content-script
      `chrome.storage.local` — it never appears in any `background.js` message, the
      IndexedDB report store, or the `/report/save` payload.

## Peer coordination

Sent a confirmation message to **frontend-architect** (1 outgoing peer message,
topic: persistence is genuinely content-script-side `chrome.storage.local` with no
`background.js` mediation; `ANNOTATE` resolve contract stays frozen; visibility
toggle is non-persisted view state). This sentinel is a team agreement, not an
isolated assumption. Conversation mirrored under
`thoughts/shared/epics/snapdeck-ux-improvements/conversations/`.

## Dependencies

none

## History

- 2026-06-19 — created by backend-architect (sentinel, effort=1, depends on none)

## Security Review

### Finding 1 — Backend sentinel: empty diff means the server-side checklist is N/A (clean)

**Severity:** info (FYI — no finding, no action)
**Threat (STRIDE).** This sentinel asserts a genuinely empty backend diff (no
`background.js`, no Python controller change). With no server/SW surface touched,
the server-side default-checklist items are N/A by construction — recorded so the PO
sees they were applied, not skipped:
- **Authn/authz:** N/A — no endpoint added; the `ANNOTATE` resolve contract is
  frozen and the localhost host-guard in `addScreenshot()` (`background.js:112`) is
  unchanged (the extension's whole access-control story stays intact).
- **Input validation / injection:** N/A — no new message handler, no new
  `/report/save` field, no DB query. The only untrusted input in the feature (stored
  toolbar pos) is guarded entirely content-script-side (see STORY-fe-001 § Security
  Review).
- **CSRF / CORS / rate-limiting:** N/A — no HTTP surface added.
- **Secrets / audit / multi-tenant:** N/A — no credentials, no server entity table,
  no tenancy model.
**Recommendation:** none. The 3 validate items (empty backend diff / frozen
`ANNOTATE` / position-never-on-a-backend-surface) are exactly the right
diff-checkable assertions to confirm the sentinel holds. Disposition: **clean — accept.**

**PO disposition:** ACCEPT_AS_RECOMMENDATION — Finding 1 (INFO, clean): the backend sentinel asserts a genuinely empty diff (no `background.js`, no Python controller change), so the server-side STRIDE checklist (authn/authz, input-validation, CSRF/CORS/rate-limiting, secrets/audit/multi-tenant) is N/A by construction; the frozen `ANNOTATE` contract + localhost host-guard are untouched and the one untrusted input (stored toolbar pos) is guarded content-script-side (fe-001). The 3 validate items (empty backend diff / frozen `ANNOTATE` / position-never-on-a-backend-surface) are the right enforcement. No action.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**Added a `## How we validate it was done correctly` checklist (3 `- [ ]` items).**
The sentinel shipped with no validate checklist; finalize requires ≥1 checkable
`- [ ]` item per story (recurring snapdeck sentinel gap — same fix applied on the w0
sibling features). The items are diff-checkable empty-backend / frozen-`ANNOTATE` /
position-never-on-a-backend-surface assertions the backend-validator can confirm. The
sentinel verdict (no backend work) is sound and unchanged — confirmed against
scope.md (toolbar position lives in `chrome.storage.local`, NOT the report store /
`model`) and the FE story set (no `background.js` in any FE `files_modified`). Status
`pending → approved`.
