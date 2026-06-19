---
type: feature
slug: w0-per-target-reports
wave: 0
parent_epic: snapdeck-ux-improvements
status: planned
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: []
frontend_lane: N/A
visual_references: []
---

# Feature: Per-target in-progress reports

## Summary

Re-key the extension's in-progress report from a single global IndexedDB record
(db `snapdeck`, store `kv`, key `"report"`) to a store keyed by the
worktree/browser-port (`report:<browserPort>` in the same `kv` store, no DB
version bump), so "the current target's report" becomes a first-class concept.
A developer/tester running Snapdeck across two or more local worktrees on
different dev-server ports gets each target its own in-progress report —
switching tabs surfaces that target's screenshots and count, and screenshots
from one worktree never bleed into another. This is the foundational shell
change that the dynamic icon's report-in-progress (orange) count
(`w1-dynamic-icon-badge`) and the popup screenshot gallery
(`w2-screenshot-gallery`) both build on.

## User-facing behavior

The user here is the developer/tester running Snapdeck across one or more local
worktrees. There is no new screen — the popup looks and behaves exactly as
before, still calling `GET_STATE` to render "the current target's" screenshot
count and note. What changes is which report those values describe:

- With two worktrees open in separate tabs (say port A `:5101` and port B
  `:5102`), capturing a screenshot on the port-A tab adds it to A's report
  only. The popup's count, while the port-A tab is active, reflects A's report.
- Switching to the port-B tab and opening the popup shows B's own in-progress
  report and count — independent of A. Capturing on B never changes A's count.
- Switching back to the port-A tab restores A's report and count exactly as it
  was left — nothing was mixed or lost.
- Saving (or clearing) while a given target's tab is active affects only that
  target's report. Saving A's report files A's screenshots and empties A's
  in-progress report; B's stays untouched.
- On a non-localhost tab there is no current target: the popup shows an empty
  state (count 0). Capture/save still refuse with the existing localhost guard.

There is no perceptible behavior change for a single-worktree user — the same
freeze → annotate → file loop works as it always did; the report is simply
keyed by the one port they're on.

**Mockups:** none — `skip_ui_designer: true`. No new screens or visual
components; the existing `popup.html`/`popup.js` surface is unchanged.

## UX patterns / interaction notes

Non-UI plumbing — this is a service-worker / IndexedDB re-keying with no new
screens, controls, or visual states. The popup (`popup.html`/`popup.js`) is
unchanged: it still sends `GET_STATE` for "the current target" and renders the
returned `count`/`note` with the same markup. The only contract addition the
popup *could* later consume is the additive `port` field on `GET_STATE`
(currently it does not need it); the badge feature (`w1-dynamic-icon-badge`)
is the first real consumer of `port`.

## Acceptance criteria

- [ ] The in-progress report is persisted under a per-port IndexedDB key
  `report:<browserPort>` in the existing `snapdeck`/`kv` object store — not the
  single global `"report"` key. No IndexedDB version bump (the generic `kv`
  store is reused as-is).
- [ ] `<browserPort>` is derived from the active tab's URL via the existing
  `portOfUrl(url)` helper — the same derivation `saveReport()` already uses. No
  second port-derivation path is introduced.
- [ ] `getReport(port)` / `setReport(port, r)` / `clearReport(port)` are
  port-scoped; the empty-record default stays `{ note: "", screenshots: [] }`.
- [ ] Capturing a screenshot on a tab at port A appends only to `report:A`;
  capturing on port B appends only to `report:B` — neither write touches the
  other port's record.
- [ ] `SET_NOTE` writes the note only to the current target's report;
  `CLEAR_REPORT` clears only the current target's record.
- [ ] `SAVE_REPORT` loads and POSTs the current target's report, and on a
  successful save clears only that port's record (other ports' reports remain);
  the saved payload's `browser_port` equals the resolved current-target port.
- [ ] `GET_STATE` returns `{ count, note, port }` for the current target, where
  `count` = that target's `screenshots.length`, `note` = its note, and `port` =
  the resolved browser-port.
- [ ] On a tab with no resolvable localhost port (non-target), `GET_STATE`
  returns `{ count: 0, note: "", port: null }`.
- [ ] Caller-facing signatures are unchanged: `addScreenshot()` and
  `saveReport()` remain zero-arg (they resolve the active tab internally), and
  the message API payloads (`GET_STATE` / `SET_NOTE` / `ADD_SCREENSHOT` /
  `SAVE_REPORT` / `CLEAR_REPORT`) are unchanged — callers never pass a port.
  Port-scoping is pushed *down* into the storage helpers.
- [ ] Per-port reports persist in IndexedDB and survive a service-worker
  restart; any cross-tab port-resolution cache lives in
  `chrome.storage.session`, with no module-level report state.
- [ ] No migration of pre-epic global report data — the legacy `"report"` key
  is not read forward and may be discarded/abandoned on upgrade.
- [ ] The existing localhost/controller guards in `addScreenshot()` /
  `saveReport()` and the controller `/resolve` + `/report/save` contract and the
  saved `report.json` projection are all unchanged.
- [ ] The write path (`addScreenshot` / `saveReport`) derives its target port via
  the SAME localhost-gated resolution as the read path (`currentTargetPort()`, or a
  shared gated helper that both paths call) — there is no second, looser port
  predicate. A capture/save attempted on a deceptive host such as
  `http://localhost.evil.com` resolves to **no current target** (rejected with the
  existing localhost-guard error) and writes **no** `report:*` record, NOT a
  `report:80`. Write-key ≡ read-key by construction. (Security, fe-001 LOW-1
  PROMOTE; satisfies scope.md's "one source of truth for the port" directive.)

## In scope

- Re-key the in-progress report store from the single `kv` key `"report"` to a
  per-port key `report:<browserPort>` in the same `snapdeck`/`kv` IndexedDB
  object store. No DB version bump required (the `kv` store is already generic).
- "Current target" resolution: every report read/write resolves the active
  tab's browser-port at handling time via the existing `portOfUrl(activeTab.url)`
  seam, and operates on `report:<port>`.
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
  port: null }`. (`ADD_SCREENSHOT` / `SAVE_REPORT` keep their existing
  localhost/controller guards.)
- Any cross-tab port-resolution cache lives in `chrome.storage.session`
  (MV3-ephemeral-safe), never in a module-level service-worker variable. The
  per-port reports themselves stay in IndexedDB (survive service-worker
  restarts).

## Out of scope

- The dynamic per-tab icon/badge state machine and its orange count
  (`w1-dynamic-icon-badge` owns this — it consumes the per-port keying + the
  `GET_STATE` `count`/`port`).
- The popup screenshot gallery, re-open, edit, and delete flows
  (`w2-screenshot-gallery` owns these — they read the per-port record's
  `screenshots[]`).
- The keyboard shortcut path (`w0-keyboard-shortcuts`) — it dispatches to the
  existing `addScreenshot()` seam and does NOT touch report/IndexedDB storage.
- Capture/annotate behavior, the editor overlay, the controller `/resolve` +
  `/report/save` contract, and the saved `report.json` projection are all
  unchanged.
- No migration of pre-epic global reports. The legacy `"report"` key may be
  discarded/abandoned on upgrade; no read-and-port-forward of old data.

## E2E test spec (written by Product Owner)

> These specs drive the MV3 service worker through its message API
> (`GET_STATE` / `SET_NOTE` / `ADD_SCREENSHOT` / `SAVE_REPORT` / `CLEAR_REPORT`)
> and through tab activation. "Active tab" = the tab `chrome.tabs.query({active,
> currentWindow})` resolves, which is what `activeTab()`/`portOfUrl` key off.
> The two ports below (`:5101`, `:5102`) stand in for two worktrees.

### Test: Two-port capture isolation

**Given** two localhost tabs are open — tab A at `http://localhost:5101` and
tab B at `http://localhost:5102` — both with empty in-progress reports, and
tab A is the active tab
**When** the user captures one screenshot on tab A (`ADD_SCREENSHOT`, completing
the annotation overlay) and then sends `GET_STATE`
**Then** `GET_STATE` returns `{ count: 1, note: "", port: 5101 }`
**When** the user makes tab B the active tab and sends `GET_STATE`
**Then** `GET_STATE` returns `{ count: 0, note: "", port: 5102 }` — B's report is
independent and empty
**When** the user captures one screenshot on tab B, then makes tab A active
again and sends `GET_STATE`
**Then** `GET_STATE` on tab A still returns `{ count: 1, port: 5101 }` — A's
screenshot is intact and unaffected by the capture on B

### Test: Note isolation across ports

**Given** tab A (`:5101`) and tab B (`:5102`) each have an in-progress report and
tab A is the active tab
**When** the user sends `SET_NOTE` with note `"A notes"` while tab A is active
**Then** `GET_STATE` on tab A returns `note: "A notes"`
**When** the user makes tab B active and sends `GET_STATE`
**Then** it returns `note: ""` — B's note is untouched by A's `SET_NOTE`

### Test: Save isolation — save A clears only A

**Given** tab A (`:5101`) has 2 screenshots and tab B (`:5102`) has 1 screenshot
in their in-progress reports, a Snapdeck controller owns port 5101, and tab A is
the active tab
**When** the user sends `SAVE_REPORT`
**Then** the POST to `/report/save` carries `browser_port: 5101` and tab A's 2
screenshots
**When** the controller responds `{ ok: true }` and the user sends `GET_STATE` on
tab A
**Then** `GET_STATE` returns `{ count: 0, note: "", port: 5101 }` — only A's
record was cleared
**When** the user makes tab B active and sends `GET_STATE`
**Then** it returns `{ count: 1, port: 5102 }` — B's report is untouched by the
save of A

### Test: Service-worker restart persistence

**Given** tab A (`:5101`) has 3 screenshots in its in-progress report
**When** the MV3 service worker is force-restarted (terminated, then woken by the
next message), with tab A the active tab, and the user sends `GET_STATE`
**Then** `GET_STATE` returns `{ count: 3, port: 5101 }` — the per-port report
survived the restart because it lives in IndexedDB, and no report state was lost
to module-level variables being reset

### Test: Non-target tab reports empty

**Given** the active tab is a non-localhost page (e.g. `https://example.com`)
**When** the user sends `GET_STATE`
**Then** it returns `{ count: 0, note: "", port: null }` — there is no current
target (the gray/empty signal the badge feature consumes)
**When** the user sends `ADD_SCREENSHOT` on that tab
**Then** it returns the existing localhost-guard error and creates no `report:*`
record for any port

### Test: Deceptive-host write/read gate parity (security)

**Given** the active tab is a deceptive non-loopback host whose name embeds a
loopback label — `http://localhost.evil.com/` (which a bare `portOfUrl` would read
as port `:80`)
**When** the user sends `ADD_SCREENSHOT`
**Then** the capture is rejected with the existing localhost-guard error and **no**
`report:80` (or any `report:*`) record is written — the write path resolves the
target through the same localhost-gated predicate as the read path, which
classifies the host as no-target
**When** the user then sends `GET_STATE` on that same tab
**Then** it returns `{ count: 0, note: "", port: null }` — the read path agrees:
no current target. Write-key and read-key never diverge for a deceptive host.

### Motion E2E (required for any UI feature; write `n/a` for backend-only)

n/a — this feature is service-worker / IndexedDB plumbing with no animated
surface of its own. The popup is unchanged and renders the same count/note UI it
already does; there are no new transitions or visual state changes to assert.

## Stories (populated by architects)

- [ ] STORY-fe-001 — Re-key in-progress report to per-port + current-target resolution (frontend-engineer) · substantive · approved
- [ ] STORY-fe-002 — `GET_STATE` additive `port` field + non-target empty-state (frontend-engineer) · substantive · approved · depends_on: [STORY-fe-001]
- [ ] STORY-be-001 — Sentinel: no backend changes (controller `/resolve` + `/report/save` unchanged) · approved
- [ ] STORY-db-001 — Sentinel: no server-side DB changes (IndexedDB is client-side) · approved
- [ ] STORY-do-001 — Sentinel: no devops changes (manifest already grants `storage` + `unlimitedStorage`) · approved

## Defects (populated as found)

- (none yet)

## No-work domains

Domains an architect explicitly decided needed no work for this feature. The sentinel stories that recorded these decisions were pruned at the end of `/mat_write_feature`; the rationale is preserved here.

- **backend** — No backend changes required for this feature.
- **database** — **No database changes required for this feature.**
- **devops** — No devops changes required for this feature.
