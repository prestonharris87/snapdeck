# Post-mortem: DEF-001 — capture-shortcut badge flash shadowed

## Root cause

`runCaptureCommand()` in `extension/background.js` painted its `!` / `✓` result
flash on the **global** action badge (`chrome.action.setBadgeText({ text })`,
no `tabId`). Chrome renders a tab's per-`tabId` badge in preference to the global
badge, so on a tab that already carries a per-tab steady-state badge — e.g. the
report-in-progress count painted by `w1-dynamic-icon-badge` — the global flash
was **shadowed (invisible)**. The error case (`!`) is the user-visible defect:
no failure feedback on exactly the tabs where capture is most used.

There was also a secondary issue surfaced during design: the start-of-invocation
**global neutral reset** (`setBadgeText({ text: "" })`) would, once flashes went
per-tab, blank a tab's steady-state count on *every* press — including cancelled
/ in-flight captures. Dropped as part of the fix.

## Fix

`extension/background.js`, `runCaptureCommand()` + four new module-scope helpers
(`clearFlash`, `cancelPendingFlash`, `setFlash`, `scheduleFlashClear`):

- The `!` / `✓` flash (+ color / title) is scoped to the **active tab's `{tabId}`**
  (resolved via the existing `activeTab()` seam), so it takes precedence over any
  per-tab steady-state badge for the flash window.
- The flash **self-clears per-`tabId`** to `""` on its existing 2s / 4s timer.
- The **destructive global pre-clear was dropped**. A new invocation calls
  `cancelPendingFlash()` — cancels the prior pending timer and hands the *prior*
  tab back (clears its badge) — but never blanks the *current* tab. A cancelled
  capture now makes **zero** badge calls, preserving the steady-state count.
- A `null` tabId (active tab unresolvable) falls back to a global flash — still
  non-silent.

**Resolution option (c)** (cross-team contract, locked in
`#snapdeck-ux-improvements/defect-badge-flash-shadow`): **no cross-feature seam /
storage write.** `w1-dynamic-icon-badge` re-asserts its steady-state badge via its
own existing wake-reconcile (`reportCountChanged` tick + `onActivated` /
`onUpdated` / cold-start). The only residual is a brief, error-case-only,
cosmetic empty-badge gap, self-healed on dynamic-icon's next wake — accepted, not
a defect (the success path fires `reportCountChanged`, so it has no gap).

## What was tested live

Automated assertion mode — `node --test extension/background.shortcuts.test.mjs`:

- `onCommand_errorFlash_scopedToActiveTabId_notGlobal` — the repro; asserts the
  `!` flash is set with `{ tabId: <active>, text: "!" }`, **not** global.
- `onCommand_successFlash_scopedToActiveTabId` — `✓` set per-`tabId`.
- `onCommand_flashTeardown_clearsActiveTabBadgePerTabId` — timeout teardown clears
  per-`tabId`.
- `onCommand_rapidRePress_handsBackPriorTab` — rapid re-press hands the prior tab
  back; does not touch the new tab's steady-state badge.
- `onCommand_cancelledAnnotate_leavesBadgeUntouched` — cancelled run makes zero
  badge calls (count preserved).

**FAIL→PASS verified:** against the pre-fix (released) `background.js`, tests
5, 9, 10, 11, 12 fail (5 fail / 7 pass); against the fix, 12 / 12 pass. Full
cohort `node --test extension/*.test.mjs` green.

## What was NOT tested

- No live in-browser verification of the actual Chrome per-tab-vs-global badge
  precedence (the unit suite stubs `chrome.action`). The precedence behavior is
  well-documented Chrome `action` API semantics; the integration is exercised at
  Wave-1 PR gate-2.
- The cosmetic error-case empty-badge gap (and dynamic-icon's wake-reconcile that
  heals it) is owned and tested on the `w1-dynamic-icon-badge` / fe-003 side.

## Files modified

- `extension/background.js` — `runCaptureCommand()` + flash helpers (per-tabId).
- `extension/background.shortcuts.test.mjs` — badge-stub captures `tabId`;
  beforeEach flushes module flash-state across tests; re-entrancy mock handles
  the added `activeTab()` query; cancelled test strengthened; 4 new DEF-001 tests.

## Files I touched but probably shouldn't have

None. No report-storage / IndexedDB / `addScreenshot()` changes (owned by
`w0-per-target-reports`). No edit to `w1-dynamic-icon-badge` artifacts. The
fix is entirely within `w0-keyboard-shortcuts`' own released code.

## Cross-domain concerns

- The fix is the kb side of a two-part cross-team contract; `w1-dynamic-icon-badge`
  ships the matching steady-state re-assert (fe-003, unchanged under option c).
- Both teams edit `background.js` action-badge calls; **BOSS serializes** at the
  Wave-1 landing. Lands in the Wave-1 PR — no separate PR, no push from kb.
