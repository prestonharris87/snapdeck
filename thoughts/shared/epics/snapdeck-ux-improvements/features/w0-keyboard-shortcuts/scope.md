---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T02:37:37Z
---

# Keyboard shortcut for capture

## Problem statement

Capture-and-annotate the visible localhost tab is Snapdeck's most frequent
action, but today it requires opening the extension popup and clicking the
capture button. That is an extra step on the hot path. Give that one action a
**focus-only** keyboard shortcut so the user can trigger capture+annotate
directly from the page they are looking at, without ever opening the popup.

The mechanism already exists: `addScreenshot()` in `extension/background.js`
(currently dispatched by the popup via the `ADD_SCREENSHOT` message) performs
the localhost guard, captures the visible tab, and drives the in-page annotate
overlay. This feature adds a Chrome `commands` binding and a top-level
`chrome.commands.onCommand` listener that dispatches to that **existing** seam.

## In scope

- A manifest `commands` entry binding capture to `Cmd/Ctrl+Shift+S`, declared as
  a **focus-only** command (Chrome's default — NOT `"global": true`).
- A top-level `chrome.commands.onCommand.addListener(...)` in `background.js`
  that, on the capture command, dispatches to the existing `addScreenshot()`
  function — the same code path the popup's `ADD_SCREENSHOT` message uses.
- A **popup-independent user-visible signal** for the shortcut's result, since
  there is no open popup to render the `{ error }` / `{ cancelled }` / success
  return. At minimum: a not-a-target / error result MUST surface visibly (e.g.
  action badge text or a `chrome.notifications` toast) — **no silent failure**.
  Exact mechanism is the architect's call; the requirement is non-silence.
- Listener registration at top level so it re-binds every time the MV3
  service worker wakes (the worker is ephemeral; listeners registered inside
  async callbacks would not survive a restart).

## Out of scope (explicit)

- **Secondary bindings (save / open-popup) are deferred.** This feature ships
  the single capture binding only. A `SAVE_REPORT` shortcut carries a larger
  failure surface (controller discovery, richer error reporting) and an
  open-popup binding (`_execute_action`) is marginal value — both can be a
  follow-up feature if desired. Keeping this atomic preserves the low-risk,
  move-fast profile.
- **No changes to report storage / IndexedDB.** The single-`report`-record
  seam (`getReport`/`setReport`/`addScreenshot`'s persistence tail) is being
  re-keyed by sibling feature `w0-per-target-reports`. This feature must NOT
  touch that surface — it only adds a listener that calls `addScreenshot()`.
- No changes to the annotation overlay, content scripts, or popup UI.
- No changes to the localhost-only host_permissions / matches.

## Branch policy

Lands on the epic feature branch `feature/snapdeck-ux-improvements` (Wave 0).
Same-wave, parallel-safe with `w0-editor-foundation` and
`w0-per-target-reports`; no `depends_on`. Footprint in `background.js` is a
single top-level listener + a small dispatch — coordinate the merge window with
BOSS at push time since siblings also edit `background.js`.

## Critical directives

- **Dispatch to the existing `addScreenshot()` seam — do NOT reimplement
  capture or report-write logic.** The localhost guard, the visible-tab
  capture, and the annotate-overlay handshake all already live inside
  `addScreenshot()`; calling it inherits the guard automatically.
- **Do NOT touch report storage** (`idb`/`getReport`/`setReport`/the `report`
  record shape). `w0-per-target-reports` owns that surface this wave. Treat
  `addScreenshot()` as a stable function-level seam.
- **Register `chrome.commands.onCommand` at top level**, alongside the existing
  top-level `chrome.runtime.onMessage` listener — never inside an async
  callback (MV3 ephemeral worker would drop it on wake).
- **Keep the binding focus-only.** Do not request a global shortcut; Chrome
  restricts global commands and the product intent is page-focused capture.
- Verify `Cmd/Ctrl+Shift+S` is an acceptable, non-conflicting suggested key on
  Chrome (use `suggested_key` with separate `default` / `mac` entries); leave
  the binding user-rebindable via `chrome://extensions/shortcuts`.

## Mockup decision

`skip_ui_designer: true`, `frontend_lane: N/A`. This is a pure
extension-background + manifest change — a `commands` manifest block, one
top-level `onCommand` listener, and a background-driven result signal
(badge/notification). There are no new screens, no popup UI changes, and no
content-script/overlay changes. Nothing for the ui-designer to enumerate; the
frontend-architect (or backend/devops-architect, given the extension surface)
can spec entirely from the existing `background.js` + `manifest.json`.

## Acceptance criteria (seeds for PO to expand)

- The manifest declares a `commands` entry binding capture to `Cmd/Ctrl+Shift+S`
  (`suggested_key`: `Ctrl+Shift+S` default, `Command+Shift+S` mac), focus-only
  (no `"global": true`).
- Pressing the shortcut on a focused `http://localhost/*` / `http://127.0.0.1/*`
  tab triggers capture+annotate via `addScreenshot()` without opening the popup,
  and on completion the screenshot is added to the in-progress report exactly as
  the popup path does.
- The `chrome.commands.onCommand` listener is registered at top level so it
  re-binds on service-worker wake (MV3 ephemeral worker).
- On a non-target tab (non-localhost), the shortcut surfaces the same
  not-a-target guard as the popup capture path via a popup-independent visible
  signal — **no silent failure, no capture of a non-localhost page.**
- The localhost-only restriction is unchanged — the shortcut only captures on
  `http://localhost/*` / `http://127.0.0.1/*` tabs (guard intrinsic to
  `addScreenshot()`).
- A cancelled annotate (user dismisses the overlay) leaves the report unchanged
  and does not produce a false success/error signal.

## E2E coverage hints (PO will write the actual specs)

- Shortcut on a localhost target tab → annotate overlay opens, completing it
  appends one screenshot to the report (no popup involved).
- Shortcut on a non-localhost tab → visible not-a-target signal fires; report
  count unchanged; no capture occurs.
- Shortcut fired after the service worker has been evicted/restarted → still
  works (proves top-level listener re-registration).
- Cancelling the annotate overlay after a shortcut-triggered capture → report
  unchanged.
