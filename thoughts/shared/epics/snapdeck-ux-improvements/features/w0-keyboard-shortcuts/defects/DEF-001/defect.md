---
type: defect
id: DEF-001
name: "Capture-shortcut error/success badge shadowed on report-in-progress tabs"
domains: [be]
parent_epic: snapdeck-ux-improvements
parent_feature: w0-keyboard-shortcuts
linked_stories: [STORY-be-001]
story_authors:
  STORY-be-001: backend-architect
assignees:
  be: backend-engineer
affected_layer: backend
affected_ui_variants: n/a
test_mode: automated
suspected_files:
  - extension/background.js
  - extension/background.shortcuts.test.mjs
status: validated
created_at: 2026-06-19T20:55:00Z
---

# Capture-shortcut badge flash shadowed on report-in-progress tabs

> Contrarian-surfaced on w1-dynamic-icon-badge fe-003; BOSS-routed to
> w0-keyboard-shortcuts (owning team) as DEF-001. Design locked in the
> cross-team `#snapdeck-ux-improvements/defect-badge-flash-shadow` subchannel.

## Repro steps

1. Load the unpacked extension.
2. Open a focused `http://localhost/*` tab that is a registered target **with a
   report in progress** — `w1-dynamic-icon-badge` paints an orange per-`tabId`
   count badge on that tab (the "report-in-progress(N)" state).
3. Press `Cmd/Ctrl+Shift+S` in a state that produces a capture **error** (e.g.
   the annotation overlay / content script is unavailable).

## Current behavior

`runCaptureCommand()` sets the `!` / `✓` capture flash on the **global** action
badge (no `tabId`). Chrome shows a tab's per-`tabId` badge in preference to the
global badge, so on a tab that already carries a per-tab steady-state badge (the
report-in-progress count) the global `!` / `✓` flash is **shadowed — invisible**.
The user gets no error feedback on exactly the tabs where capture is most used.

## Expected behavior

The capture-result flash (`!` / `✓`) is shown **on the active tab** — it takes
precedence over any per-tab steady-state badge for the duration of the flash,
then self-clears and the steady-state badge re-asserts.

## Resolution — cross-team contract, option (c)

Mutually, jointly agreed by `w0-keyboard-shortcuts` (owning) +
`w1-dynamic-icon-badge` (steady-state badge owner), under BOSS delegation:

- kb scopes the `!` / `✓` flash (+ color / title) to the active tab's `{tabId}`.
- kb self-clears the flash to `""` on its existing 2s / 4s timeout, per-`tabId`.
- kb **drops the destructive global pre-clear**; on a new run it cancels the
  prior pending flash-timer and hands the prior tab back — never blanking the
  current tab's count.
- **No cross-feature seam / storage write.** `w1-dynamic-icon-badge`'s existing
  wake-reconcile (`reportCountChanged` tick + `onActivated` / `onUpdated` /
  cold-start) re-asserts the steady-state badge. fe-003 unchanged.
- **Accepted residual:** a brief, error-case-only, cosmetic empty-badge gap after
  the error flash clears, self-healed on dynamic-icon's next wake event. Not a
  defect (a successful capture fires `reportCountChanged`, so the success path
  has no gap).

## Test assertion (automated — `node --test extension/*.test.mjs`)

Additions to `extension/background.shortcuts.test.mjs`:

- error flash `setBadgeText` called with `{ tabId, text: "!" }` (per-tab, **not**
  global) — **FAILS pre-fix** (was `{ text: "!" }`, `tabId` undefined).
- success flash `setBadgeText` called with `{ tabId, text: "✓" }`.
- teardown clears the tab's badge per-`tabId` (`{ tabId, text: "" }`).
- cancelled run makes **zero** badge calls — the count is preserved (no
  destructive pre-clear).
- rapid re-press hands the prior tab back (clears the prior `tabId`'s badge).

## Notes

The fix is entirely within `w0-keyboard-shortcuts`' own released code
(`runCaptureCommand()` + its new flash helpers). It does **not** touch report
storage / IndexedDB / `addScreenshot()` (owned by `w0-per-target-reports`).
Lands in the Wave-1 PR; BOSS serializes alongside `w1-dynamic-icon-badge`'s
fe-003.
