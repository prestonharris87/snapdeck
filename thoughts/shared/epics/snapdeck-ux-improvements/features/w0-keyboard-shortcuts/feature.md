---
type: feature
slug: w0-keyboard-shortcuts
wave: 0
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-023636-42973
depends_on: []
frontend_lane: N/A
visual_references: []
---

# Feature: Keyboard shortcut for capture

## Summary

Capture-and-annotate the visible localhost tab is Snapdeck's most frequent
action, but today it requires opening the extension popup and clicking the
capture button — an extra step on the hot path. This feature gives that one
action a **focus-only** keyboard shortcut (`Cmd/Ctrl+Shift+S`) so the user can
trigger capture+annotate directly from the page they're looking at, without ever
opening the popup. It is a thin caller: a manifest `commands` block plus one
top-level `chrome.commands.onCommand` listener that dispatches to the existing,
unchanged `addScreenshot()` seam in `extension/background.js`.

## User-facing behavior

The user is on a focused `http://localhost/*` or `http://127.0.0.1/*` tab in
their dev app. They press `Cmd+Shift+S` (mac) / `Ctrl+Shift+S` (Windows/Linux).
The extension popup does **not** open. Instead, the visible tab is captured and
the in-page annotation overlay appears — exactly the same flow as clicking
"capture" in the popup. When the user finishes annotating, the screenshot is
appended to the in-progress report (the report count increments by one). If the
user dismisses the overlay without finishing, nothing is added and no
success/error feedback is shown.

If the user presses the shortcut on a tab that is **not** a localhost dev page,
nothing is captured. Because there is no open popup to render the usual
not-a-target message, the failure is surfaced through a popup-independent,
user-visible signal (an action-badge cue or a `chrome.notifications` toast) — the
user is never left guessing whether the shortcut "worked."

The binding is the Chrome default focus-only command type (not a global
shortcut), and remains user-rebindable from `chrome://extensions/shortcuts`.

There are no new screens for this feature — see UX notes below.

## UX patterns / interaction notes

**Non-UI feature (`skip_ui_designer: true`, `frontend_lane: N/A`).** This change
is entirely in the extension's manifest + background service worker. There are
**no new screens, no popup-UI changes, and no content-script/overlay changes**.
The only "UI" the user perceives is (a) the already-existing in-page annotation
overlay that `addScreenshot()` drives, and (b) the new result signal for the
shortcut path (action-badge text or a `chrome.notifications` toast) whose exact
mechanism is the architect's call — the only hard requirement is **non-silence**
on the not-a-target / error result.

Interaction model: a single keystroke replaces "click toolbar icon → click
capture button." Discoverability is handled by Chrome's native shortcut surface
(`chrome://extensions/shortcuts`) and the command `description`; this feature
does not add an in-product hint.

## Acceptance criteria

- [ ] `manifest.json` declares a `commands` block with a capture command whose
      `suggested_key` is `{ "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" }`
      and a human-readable `description`.
- [ ] The capture command is **focus-only** — it does NOT set `"global": true`
      (Chrome's default command type; product intent is page-focused capture).
- [ ] A `chrome.commands.onCommand.addListener(...)` is registered at the **top
      level** of `background.js` (module scope, alongside the existing top-level
      `chrome.runtime.onMessage` listener), so it re-binds every time the MV3
      service worker wakes.
- [ ] On the capture command, when the focused tab is `http://localhost/*` or
      `http://127.0.0.1/*`, the listener dispatches to the existing **zero-arg
      `addScreenshot()`** function — the extension popup does NOT open, and on a
      completed annotation exactly one screenshot is appended to the in-progress
      report (identical to the popup's `ADD_SCREENSHOT` path).
- [ ] `addScreenshot()` is called as-is (it resolves the active tab internally and
      owns the localhost guard); this feature makes **no changes** to report
      storage, IndexedDB, or the `report` record shape (owned by sibling
      `w0-per-target-reports`).
- [ ] On a non-target (non-localhost) focused tab, the shortcut performs **no
      capture** and surfaces the not-a-target guard via a **popup-independent,
      user-visible signal** (action-badge text or `chrome.notifications`) — no
      silent failure, no capture of a non-localhost page.
- [ ] A capture/annotate error path (e.g. the annotation overlay is unavailable
      because the content script hasn't loaded) also surfaces a popup-independent
      visible signal rather than failing silently.
- [ ] A cancelled annotate (user dismisses the overlay) leaves the report
      unchanged (count unchanged) and produces **no** false success/error signal.
- [ ] The localhost-only restriction is unchanged, and the binding remains
      user-rebindable via `chrome://extensions/shortcuts`.

## E2E test spec (written by Product Owner)

> Implementation note for browser-tester: these scenarios run against the
> unpacked extension. Where a synthetic OS-level keystroke for a `commands`
> binding cannot be reliably delivered in the harness, codify the "presses the
> shortcut" step by invoking the registered capture command through the
> extension command path (the same entry point the keystroke triggers); the
> behavioral assertions in **Then** are unchanged.

### Test: shortcut-captures-on-localhost-target

**Given** the extension is loaded and the user is on a focused `http://localhost/*` (or `http://127.0.0.1/*`) tab whose content script is loaded
**And** the in-progress report currently has N screenshots
**When** the user presses `Cmd/Ctrl+Shift+S`
**Then** the extension popup does NOT open
**And** the in-page annotation overlay appears for the visible tab
**And** after the user completes the annotation, the in-progress report has N+1 screenshots (the same outcome as the popup capture path)

### Test: shortcut-on-non-target-surfaces-visible-signal

**Given** the extension is loaded and the user is on a focused NON-localhost tab (e.g. `https://example.com/`)
**And** the in-progress report currently has N screenshots
**When** the user presses `Cmd/Ctrl+Shift+S`
**Then** no screenshot is captured and the report still has N screenshots
**And** a popup-independent, user-visible not-a-target signal is shown (action-badge text or a `chrome.notifications` toast) — the failure is NOT silent

### Test: shortcut-rebinds-after-service-worker-wake

**Given** the extension is loaded and the MV3 background service worker has been evicted/terminated since the last action
**And** the user is on a focused `http://localhost/*` tab
**When** the user presses `Cmd/Ctrl+Shift+S` (which wakes the service worker)
**Then** the capture command is still handled (the top-level `onCommand` listener re-registered on wake)
**And** the annotation overlay appears and a completed annotation appends one screenshot to the report
**And** the previously stored report contents are preserved across the worker restart (IndexedDB `report` record survives)

### Test: cancelled-annotate-leaves-report-unchanged

**Given** the extension is loaded and the user is on a focused `http://localhost/*` tab
**And** the in-progress report currently has N screenshots
**When** the user presses `Cmd/Ctrl+Shift+S` and then dismisses the annotation overlay without completing it
**Then** the report still has N screenshots (unchanged)
**And** no success signal and no error signal is shown for the cancelled action

### Test: capture-command-binding-is-focus-only

**Given** the extension's `manifest.json`
**When** the `commands` block is inspected
**Then** a capture command exists with `suggested_key.default = "Ctrl+Shift+S"` and `suggested_key.mac = "Command+Shift+S"`
**And** the command does NOT declare `"global": true` (it is the default focus-only command type)

### Motion E2E

n/a — this is a non-UI (extension manifest + background service worker) feature.
It adds no animated elements; the only on-screen surfaces (the existing
annotation overlay and the result badge/notification) are owned outside this
feature's scope and introduce no new animation.

## In scope

- A manifest `commands` entry binding capture to `Cmd/Ctrl+Shift+S`, declared as
  a **focus-only** command (Chrome's default — NOT `"global": true`).
- A top-level `chrome.commands.onCommand.addListener(...)` in `background.js`
  that, on the capture command, dispatches to the existing `addScreenshot()`
  function — the same code path the popup's `ADD_SCREENSHOT` message uses.
- A **popup-independent user-visible signal** for the shortcut's result, since
  there is no open popup to render the `{ error }` / `{ cancelled }` / success
  return. At minimum a not-a-target / error result MUST surface visibly (e.g.
  action badge text or a `chrome.notifications` toast) — **no silent failure**.
  Exact mechanism is the architect's call; the requirement is non-silence.
- Listener registration at top level so it re-binds every time the MV3 service
  worker wakes (the worker is ephemeral; listeners registered inside async
  callbacks would not survive a restart).

## Out of scope

- **Secondary bindings (save / open-popup) are deferred.** This feature ships
  the single capture binding only. A `SAVE_REPORT` shortcut carries a larger
  failure surface (controller discovery, richer error reporting) and an
  open-popup binding (`_execute_action`) is marginal value — both can be a
  follow-up feature if desired. Keeping this atomic preserves the low-risk,
  move-fast profile.
- **No changes to report storage / IndexedDB.** The single-`report`-record seam
  (`getReport`/`setReport`/`addScreenshot()`'s persistence tail) is being
  re-keyed by sibling feature `w0-per-target-reports`. This feature must NOT
  touch that surface — it only adds a listener that calls `addScreenshot()`.
- No changes to the annotation overlay, content scripts, or popup UI.
- No changes to the localhost-only `host_permissions` / `matches`.

## Stories (populated by architects)

- (none yet)

## Defects (populated as found)

- (none yet)
