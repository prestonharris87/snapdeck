---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T02:40:00Z
---

# Per-target in-progress reports

## Problem statement

Snapdeck's in-progress report lives in IndexedDB as a single global record
(db `snapdeck`, object store `kv`, key `"report"`). A developer running two
local worktrees on different dev-server ports therefore shares one report
across both — screenshots captured on port A and port B land in the same
record, and the popup count/note reflect a blend of the two. This feature
re-keys the in-progress report from one global record to a per-browser-port
store, so "the current target's report" becomes a first-class concept:
switching tabs surfaces that port's own report and never mixes captures across
worktrees. It is the foundational shell change that the dynamic icon's orange
report-in-progress count (`w1-dynamic-icon-badge`) and the popup gallery
(`w2-screenshot-gallery`) both build on.

## In scope

- Re-key the in-progress report store from the single `kv` key `"report"` to a
  per-port key `report:<browserPort>` in the same `snapdeck`/`kv` IndexedDB
  object store. No DB version bump required (the `kv` store is already generic).
- "Current target" resolution: every report read/write resolves the active
  tab's browser-port at handling time via the existing
  `portOfUrl(activeTab.url)` seam, and operates on `report:<port>`.
- `getReport()` / `setReport()` / `clearReport()` become port-scoped (take the
  resolved port; default empty record stays `{ note: "", screenshots: [] }`).
- `ADD_SCREENSHOT` appends only to the current target's report; capturing on a
  port-A tab never touches port B's record.
- `SET_NOTE`, `SAVE_REPORT`, `CLEAR_REPORT` all operate on the current target's
  report only, leaving other ports' reports untouched. (`SAVE_REPORT` already
  derives `browserPort`; it now loads/clears the report keyed by that same port.)
- `GET_STATE` returns the current target's `{ count, note }` (the values the
  popup and the future badge consume), plus an additive `port` field naming the
  resolved target (`null` when the active tab is not a localhost target).
- Non-target handling: when the active tab has no resolvable localhost port,
  there is no current target — `GET_STATE` returns `{ count: 0, note: "",
  port: null }`. (`ADD_SCREENSHOT`/`SAVE_REPORT` keep their existing
  localhost/controller guards.)
- Any cross-tab port-resolution cache lives in `chrome.storage.session`
  (MV3-ephemeral-safe), never in a module-level service-worker variable. The
  per-port reports themselves stay in IndexedDB (survive service-worker
  restarts).

## Out of scope (explicit)

- The dynamic per-tab icon/badge state machine and its orange count
  (`w1-dynamic-icon-badge` owns this — it consumes the per-port keying + the
  `GET_STATE` `count`).
- The popup screenshot gallery, re-open, edit, and delete flows
  (`w2-screenshot-gallery` owns these — they read the per-port record's
  `screenshots[]`).
- The keyboard shortcut path (`w0-keyboard-shortcuts`) — it dispatches to the
  existing `addScreenshot()` seam and does NOT touch report/IndexedDB storage;
  that surface stays mine. Capture/annotate behavior, the editor overlay, the
  controller `/resolve` + `/report/save` contract, and the saved `report.json`
  projection are all unchanged.
- No migration of pre-epic global reports. The legacy `"report"` key may be
  discarded/abandoned on upgrade; no read-and-port-forward of old data.

## Branch policy

Lands on the epic feature branch under BOSS push coordination (multi-team
mode). Commits are autonomous/pre-approved; `git push` only after a BOSS
`READY TO PUSH` ack. Strip any local-only patch blocks and revert any
local-path config before push; rebase onto the upstream integration branch
first per `CLAUDE.md` § "Local-dev patches and runbook".

⚠️ **Merge coordination:** `extension/background.js` is shared this wave.
`w0-keyboard-shortcuts` adds a single top-level `commands.onCommand` listener
(register-only, no report storage). My edits are concentrated in the IndexedDB
report helpers + the message handlers (`getReport`/`setReport`/`clearReport`,
`GET_STATE`/`SET_NOTE`/`ADD_SCREENSHOT`/`SAVE_REPORT`/`CLEAR_REPORT`,
`addScreenshot`/`saveReport`). Region-isolated from the shortcuts listener;
flag both footprints at the push window.

## Critical directives

- **MV3 ephemerality.** The service worker is restartable. Per-port reports
  MUST persist in IndexedDB. Any port-resolution cache MUST live in
  `chrome.storage.session` — never a plain module variable. Do not introduce
  module-level report state.
- **Reuse the existing port seam.** Derive the report key with the existing
  `portOfUrl(url)` helper against the active tab's URL — the same derivation
  `saveReport()` already uses. Do not invent a second port-derivation path; keep
  "icon is green / capture will save" and "report key" derived from one source
  of truth.
- **Caller-facing signatures stay UNCHANGED.** `addScreenshot()` and
  `saveReport()` already resolve the active tab internally (`activeTab()`), so
  each derives its own target port via `portOfUrl` — they remain zero-arg. The
  message API (`GET_STATE`/`SET_NOTE`/`ADD_SCREENSHOT`/`SAVE_REPORT`/
  `CLEAR_REPORT`) keeps its existing payloads; the service worker resolves the
  current target, callers never pass a port. The re-keying is internal to the
  storage helpers. (Direct answer to BOSS's shared-`background.js` ruling: the
  `addScreenshot()` seam `w0-keyboard-shortcuts` calls does NOT change shape — no
  call-site realignment required of the shortcuts feature.) Port-scoping is
  pushed *down* into `getReport(port)`/`setReport(port, r)`/`clearReport(port)`,
  which the unchanged-signature callers invoke with their internally-resolved
  port.
- **Freeze the contract before siblings build.** `w1-dynamic-icon-badge` and
  `w2-screenshot-gallery` depend on the key format and the `GET_STATE` shape.
  Once stories lock these, the team-lead declares a 🤝 CONTRACT on
  `#snapdeck-ux-improvements/active`; do not change the key format or
  `GET_STATE` return shape afterward without re-broadcasting.
- **No controller/CLI changes.** The `/resolve` registry and `/report/save`
  endpoints are unchanged; this is extension-side keying only.

## Mockup decision

skip_ui_designer: true — no new screens or visual components. The change is
service-worker/IndexedDB plumbing; the existing popup (`popup.html`/`popup.js`)
keeps calling `GET_STATE` for "the current target" and renders the same
count/note UI. `frontend_lane: N/A` — the extension popup is raw HTML/JS with no
project UI-library lane involved. Nothing for the ui-designer to enumerate.

## Acceptance criteria (seeds for PO to expand)

- The in-progress report store is keyed by browser-port (derived from the
  active tab's URL via `portOfUrl`), not a single global `"report"` record.
- Adding a screenshot on a tab at port A appends only to `report:A`; adding on
  port B appends only to `report:B`.
- Starting a report on port A, switching to port B, switching back to A
  restores A's report and screenshot count unchanged.
- `SAVE_REPORT` and `CLEAR_REPORT` operate on the current target's report only,
  leaving other ports' reports untouched; `SAVE_REPORT` clears only the saved
  port's record on success.
- `GET_STATE` returns the current target's `{ count, note, port }`; on a
  non-localhost tab it returns `{ count: 0, note: "", port: null }`.
- Per-port reports survive a service-worker restart (IndexedDB); the
  port-resolution cache (if any) survives via `chrome.storage.session`, with no
  module-level report state.
- No migration of pre-epic global report data; legacy `"report"` key is not
  read forward.

## E2E coverage hints (PO will write the actual specs)

- Two-port isolation: capture on port-A tab, switch to port-B tab, confirm B's
  count is independent; switch back to A, confirm A's count/screenshots intact.
- Save isolation: with reports on A and B, save A; confirm A clears and B is
  untouched; confirm the saved payload's `browser_port` matches A.
- Service-worker restart persistence: build a report, force-restart the worker,
  confirm the current target's count survives via `GET_STATE`.
- Non-target tab: on a non-localhost tab, `GET_STATE` reports `count: 0`,
  `port: null` (the gray/empty signal the badge feature consumes).
