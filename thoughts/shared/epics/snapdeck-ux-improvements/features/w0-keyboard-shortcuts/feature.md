---
type: feature
slug: w0-keyboard-shortcuts
wave: 0
parent_epic: snapdeck-ux-improvements
status: stub
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: []
frontend_lane: N/A
visual_references: []
---

# Feature: Keyboard shortcut for capture

## Summary

Give the most frequent action — capture & annotate the visible tab — a
focus-only keyboard shortcut so the user does not have to open the popup first.
Register the Chrome `commands` API binding `Cmd/Ctrl+Shift+S` and dispatch it to
the existing `addScreenshot` seam in `extension/background.js`. Independent and
low-risk: it adds a manifest `commands` block and one top-level
`chrome.commands.onCommand` listener, dispatching to a function that already
exists. Any save / open-popup secondary bindings are finalized during feature
scoping.

## Acceptance criteria seeds

- The manifest declares a `commands` entry binding capture to
  `Cmd/Ctrl+Shift+S` (focus-only; not a global shortcut, per Chrome's rules).
- Pressing `Cmd/Ctrl+Shift+S` on a focused target tab triggers capture+annotate
  via `addScreenshot` without opening the popup.
- The `commands.onCommand` listener is registered at top level so it rebinds on
  service-worker wake (MV3 ephemeral worker).
- On a non-target tab, the shortcut surfaces the same not-a-target guard as the
  popup capture path (no silent failure, no capture of a non-localhost page).
- The localhost-only restriction is unchanged — the shortcut only captures on
  `http://localhost/*` / `http://127.0.0.1/*` tabs.
