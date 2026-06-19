---
type: feature
slug: w1-dynamic-icon-badge
wave: 1
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-150619-36719
depends_on: [w0-per-target-reports]
frontend_lane: N/A
skip_ui_designer: true
visual_references: []
---

# Feature: Dynamic per-tab toolbar icon + badge

## Summary

Turn Snapdeck's static toolbar (`action`) icon into a **per-`tabId` state machine**:
**gray** when the current tab is not a resolvable Snapdeck target, **green** when it is
a registered target (a localhost tab whose browser-port is owned by a live controller),
and **orange with a live screenshot-count badge** while that target has an in-progress
report — returning to green (badge cleared) once the report is saved or cleared. It
consumes the **released** `w0-per-target-reports` contract (`report:<port>` keying plus
`GET_STATE → { count, note, port }`): the orange badge shows the current target's report
`count`, and `port: null` means "no current target" ⇒ gray. The user — a developer/tester
running Snapdeck across one or more local worktrees — gets at-a-glance signal of whether
the active tab is captureable and whether a capture session is in flight, with no popup
open.

## User-facing behavior

There is no new screen. The only surface is the existing toolbar icon and its badge,
which now changes color and shows a count depending on the active tab:

- Open a non-localhost page (e.g. `https://example.com`): the icon is **gray
  immediately** — Snapdeck does nothing here, and the user sees that without clicking.
- Open a localhost dev-app tab whose worktree has `deck up` running (a live controller
  owns the port): the icon turns **green** — "this tab is a Snapdeck target; capture &
  save will work." The green resolution is cached, so re-visiting that tab is instant.
- Open a localhost tab with no controller running for its port: the icon stays **gray**
  — there is no registered target to file a report to (v1 makes no separate
  "localhost-but-unregistered" distinction; it reads as gray).
- Capture a screenshot on a green target (via the popup button or the `Cmd/Ctrl+Shift+S`
  keyboard shortcut from `w0-keyboard-shortcuts`): the icon turns **orange** and the
  badge shows the count of unsaved screenshots, incrementing live with each capture —
  no tab switch required to see the new count.
- Save (or clear) that target's report: the badge clears and the icon returns to
  **green**.
- Switch between two worktree tabs (port A `:5101`, port B `:5102`) in different states:
  each tab shows its **own** per-`tabId` state — A's orange count and B's green don't
  bleed into each other, and switching back to a previously-resolved tab is instant (no
  re-probe).
- The transient `✓`/`!` capture-feedback flash that the keyboard-shortcut path already
  shows (released `w0-keyboard-shortcuts` behavior) still flashes, and when it resets the
  icon/badge settle back to the **correct per-tab steady state** — never stuck on `✓`/`!`.

**Mockups:** none — `skip_ui_designer: true`. The only visual artifacts are three
color-states of the existing 16/48/128 Snapdeck toolbar icon plus a numeric badge; a
16px toolbar icon is outside the ui-designer's HTML-mockup tooling. The frontend-architect
specs the three icon states (green anchored to the existing `#1E8E3E` badge token,
orange/gray selected per `design.md`) and the asset-PNG-variants-vs-programmatic
(`OffscreenCanvas`/`ImageData`) generation approach.

## UX patterns / interaction notes

Non-UI plumbing — this is service-worker / `action`-API work with no DOM, no
component-library surface, and `frontend_lane: N/A`. There is no HTML screen, control, or
animated transition to design; the interaction model is entirely "the toolbar icon
reflects the active tab's Snapdeck state, derived on tab activation/update." The three
steady states (gray / green / orange+count) and the asset-vs-programmatic icon-generation
decision are specified by the frontend-architect, not the ui-designer.

## Acceptance criteria

- [ ] **AC1 — Gray is instant for non-localhost, no probe.** On `tabs.onActivated` /
  `tabs.onUpdated` for a tab whose URL is not `http://localhost|127.0.0.1` (per the
  released `currentTargetPort()` predicate at `background.js:70`), the icon is set to the
  **gray** state immediately and **no** `/resolve` probe (`findController()` fetch
  fan-out, `background.js:89`) is fired for that tab.
- [ ] **AC2 — Green = localhost target owned by a live controller, via a cached probe.**
  On a localhost tab whose browser-port (`portOfUrl()`, `background.js:51`) resolves to a
  live controller — `findController(port)` returns a controller port — the icon is set
  **green**. The resolution result is cached in `chrome.storage.session` keyed by port;
  a second activation of an already-resolved tab is served from cache and fires **no** new
  `/resolve` probe.
- [ ] **AC3 — Localhost with no live controller → gray.** A localhost tab whose
  `findController()` probe resolves to `null` (no controller owns the port) is set
  **gray** (v1 default; no separate "localhost-unregistered" signal).
- [ ] **AC4 — Orange + numeric badge while a report is in progress.** When the current
  target's report has `count > 0` (read via the released `GET_STATE` path, which returns
  `{ count, note, port }` at `background.js:167`), the active tab's icon is **orange** and
  its badge shows the numeric `count`. Orange takes precedence over green: a target with
  an in-progress report reads as orange, not green.
- [ ] **AC5 — Live count increment without a tab switch.** Adding a screenshot to the
  current target — via the popup `ADD_SCREENSHOT` path **or** the released
  `w0-keyboard-shortcuts` capture path (`runCaptureCommand()` → `addScreenshot()`) —
  updates the active tab's orange badge `count` live, with no tab switch required. The
  exact trigger (a new lightweight notify/push message vs. a re-query on an observable
  event) is architect-owned, but it MUST satisfy AC11's released-code boundary.
- [ ] **AC6 — Back to green on save/clear.** After the current target's report is saved
  (`SAVE_REPORT` success) or cleared (`CLEAR_REPORT`), the active tab's badge clears
  (empty text) and the icon returns to **green**.
- [ ] **AC7 — Per-`tabId` state that survives a service-worker restart.** All icon/badge
  state is applied per `tabId` via the tabId-scoped `action` API
  (`setIcon`/`setBadgeText`/`setBadgeBackgroundColor`/`setTitle`, each passing `{ tabId }`),
  driven by `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`. After the MV3 service
  worker is terminated and woken, the active tab's state is re-derived correctly on wake
  (count from IndexedDB via the `GET_STATE` path; resolution from the
  `chrome.storage.session` cache or a fresh probe).
- [ ] **AC8 — All listeners registered at top level.** Every `tabs.onActivated` /
  `tabs.onUpdated` / `action` / `runtime` / `commands` listener this feature registers is
  added **synchronously at the top level** of `background.js` — never inside an async
  callback — so the MV3 ephemeral worker rebinds them on wake.
- [ ] **AC9 — No module-level state; cache in `chrome.storage.session`.** The
  port-resolution cache lives in `chrome.storage.session`; there is **no** module-level
  icon/badge/cache variable holding state across events. Per-tab icon/badge is set via the
  `action` API and re-derived on demand.
- [ ] **AC10 — One source of truth for the port (deceptive-host parity).** Port/target
  resolution reuses the released `currentTargetPort()` / `portOfUrl()` predicate exactly;
  no second port-derivation and no looser localhost predicate are introduced. A deceptive
  host such as `http://localhost.evil.com` classifies as **no current target → gray**, and
  fires **no** `/resolve` probe (it is not localhost) — matching the released w0 write/read
  gate parity (w0 `fe-001` LOW-1).
- [ ] **AC11 — Released-code boundary; steady-state-after-flash.** The feature does **not**
  modify `runCaptureCommand()` (released `w0-keyboard-shortcuts` code, `background.js:118`)
  nor the released w0 `addScreenshot()` / `saveReport()` / `currentTargetPort()` /
  `getReport()` / `GET_STATE` seams — they are consumed read-only. After the transient
  `✓`/`!` capture-feedback flash that `runCaptureCommand()` drives on the **global**
  `action` badge (green `#1E8E3E` / red `#C0392B`, `setTimeout`-reset) resets, the correct
  per-`tabId` steady state re-asserts — no stuck `✓`/`!`, no flicker, no fight over the
  badge — using only the per-`tabId` `action` calls this feature owns. (If planning or the
  Contrarian 5.5 pass concludes the reconcile is impossible without editing kb's code,
  that is a **defect in released work** to escalate to BOSS — never a unilateral edit.)
- [ ] **AC12 — Two-tier responsiveness; no sluggish tab switch.** Tab switching stays
  responsive: instant gray for non-localhost (no probe), with the `findController()`
  `/resolve` fan-out running **only** on a `chrome.storage.session` cache miss for a
  localhost tab. A tab switch is never blocked on a synchronous network probe.
- [ ] **AC13 — No new manifest permission.** The feature adds **no** new `manifest.json`
  permission — `action`, `tabs`, and `storage` (which covers `chrome.storage.session`) are
  already granted — avoiding the MV3 auto-update re-acceptance hazard. The icon-state asset
  approach (PNG variants vs. programmatic `OffscreenCanvas`/`ImageData`) is architect-owned;
  green is anchored to the existing `#1E8E3E` badge token, orange and gray selected per
  `design.md`.

## In scope

- A per-`tabId` icon state machine with three steady states, set via the tabId-scoped
  `action` API (`setIcon`/`setBadgeText`/`setBadgeBackgroundColor`/`setTitle`):
  - **gray** — the current tab is not a resolvable Snapdeck target (non-localhost, or
    localhost with no live controller). Instant; no network probe for the non-localhost
    case.
  - **green** — a localhost tab whose browser-port is owned by a live controller, per a
    **cached** `/resolve` probe (reuse the existing `findController()` seam), with the
    resolution result cached in `chrome.storage.session`.
  - **orange + numeric badge** — the current target has an in-progress report; the badge
    shows `count` from `GET_STATE`, increments live as screenshots are added, and the icon
    returns to **green** (badge cleared) once the report is saved or cleared.
- State driven by `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`, applied per
  `tabId` so it survives service-worker restarts.
- **All** `tabs` / `action` / `runtime` listeners registered at **top level** of
  `background.js` (MV3 ephemeral-worker rebind safety) — no registration inside async
  callbacks.
- **Two-tier responsiveness:** instant gray for non-localhost (no probe at all); the
  `/resolve` registry probe runs only on a `chrome.storage.session` cache miss for a
  localhost tab; tab switching stays responsive (never block a switch on a synchronous
  network probe).
- Reuse the released **read-path** seams as the single source of truth: port via
  `currentTargetPort()` / `portOfUrl()`, count via `GET_STATE` / `getReport()`. No second
  port-derivation path; no looser localhost predicate (a deceptive `localhost.evil.com`
  host resolves to no-target → gray, matching the w0 write/read gate parity).
- The port-resolution cache lives in `chrome.storage.session` (MV3-ephemeral-safe); no
  module-level icon/cache state.
- **Live count freshness:** adding a screenshot — via the popup capture path OR the
  released `w0-keyboard-shortcuts` capture path — updates the active tab's orange badge
  count without requiring a tab switch (define the trigger: a lightweight push message to
  the badge updater, or a re-query on the relevant event).
- **Reconcile with the existing transient capture/save badge feedback** in
  `runCaptureCommand()`: today it drives the **global** (non-`tabId`-scoped) `action`
  badge with transient `✓`/`!` flashes (`#1E8E3E` green / `#C0392B` red) on a `setTimeout`
  reset. The new per-tab state machine must coexist so that after a transient flash resets,
  the correct per-tab steady state re-asserts (no stuck `✓`/`!`, no flicker), and the two
  do not fight for the badge. **`runCaptureCommand()` is READ-ONLY released code — the
  reconcile happens entirely on this feature's side.**
- Icon assets: three color-states of the existing Snapdeck logo (gray / green / orange).
  Anchor green to the existing badge token `#1E8E3E`; select an orange and a gray per
  `design.md`. The frontend-architect decides asset-PNG-variants vs programmatic
  `OffscreenCanvas`/`ImageData` generation.

## Out of scope

- Any change to the `w0-per-target-reports` storage contract — `report:<port>` keying,
  the `GET_STATE` payload shape, and `currentTargetPort()`/`portOfUrl()` semantics are
  **consumed only**, never modified.
- The controller `/resolve` + `/report/save` HTTP contract — unchanged.
- The popup UI (`popup/popup.html`, `popup/popup.js`) — unchanged; the toolbar icon +
  badge is the only new surface.
- The capture / annotate / editor-overlay flow.
- A broad messaging-API redesign. (A single lightweight notify/push message to keep the
  active tab's count live IS in scope; reworking the existing message types is not.)
- Multi-window perfection beyond per-`tabId` correctness (best-effort across windows).
- Migration of any pre-existing state — there is none for icon/badge.
- Editing `runCaptureCommand()` or any other released `w0-keyboard-shortcuts` /
  `w0-per-target-reports` code. If the flash reconcile genuinely requires it, that is a
  BOSS-escalated defect in released work, not in-feature work.

## E2E test spec (written by Product Owner)

> These specs drive the MV3 service worker through tab activation
> (`chrome.tabs.onActivated` / `onUpdated`) and assert the resulting **per-`tabId`
> `action` state** (the icon-state path set via `setIcon`, the badge text via
> `setBadgeText`, the badge color via `setBadgeBackgroundColor`, the title via
> `setTitle` — all scoped with `{ tabId }`). "Active tab" = the tab
> `chrome.tabs.query({active, currentWindow})` resolves, which is what
> `currentTargetPort()`/`portOfUrl()` key off. `/resolve` probes are observed by
> intercepting the `http://127.0.0.1:<ctrlPort>/resolve?port=<browserPort>` fetches that
> `findController()` issues (`background.js:89`). The two ports below (`:5101`, `:5102`)
> stand in for two worktrees. This is service-worker / `action`-API plumbing — there is no
> login screen and no SPA hard-refresh gotcha (the per-port report lives in the worker's
> own IndexedDB and the resolution cache in `chrome.storage.session`).

### Test: Non-localhost tab → gray, no probe

**Given** the active tab is a non-localhost page (e.g. `https://example.com`)
**When** the tab is activated (`tabs.onActivated` fires for its `tabId`)
**Then** the icon for that `tabId` is set to the **gray** state and the badge is empty
**And** **no** `/resolve` fetch is issued for that tab (the non-localhost case fires no
probe at all — instant gray)

### Test: Localhost target owned by a live controller → green (cached)

**Given** tab A is `http://localhost:5101` and a Snapdeck controller answers
`/resolve?port=5101` with `{ ok: true }`, and A's report is empty (`count: 0`)
**When** tab A is activated for the first time
**Then** exactly one `/resolve` probe resolves to the owning controller, the resolution is
cached in `chrome.storage.session` keyed by port `5101`, and tab A's icon is set **green**
with an empty badge
**When** the user switches away and later re-activates tab A (still resolved, still empty)
**Then** tab A is set **green** again from the `chrome.storage.session` cache and **no**
new `/resolve` probe is fired (cache hit)

### Test: Localhost tab with no live controller → gray

**Given** tab A is `http://localhost:5109` and **no** controller answers
`/resolve?port=5109` (every probe in the `findController()` fan-out rejects/resolves null)
**When** tab A is activated
**Then** tab A's icon is set **gray** (no registered target) with an empty badge — distinct
from the green state

### Test: In-progress report → orange + badge = count; live increment on popup capture

**Given** tab A (`http://localhost:5101`) is a green target whose report currently has
`count: 0`
**When** a screenshot is added on tab A via the popup `ADD_SCREENSHOT` path (completing the
annotation overlay) and `GET_STATE` for the current target returns `{ count: 1, port: 5101 }`
**Then** tab A's icon is set **orange** and its badge text is `1`, **without** a tab switch
**When** a second screenshot is added on tab A (`GET_STATE` now returns `{ count: 2 }`)
**Then** tab A's badge text updates **live** to `2` (still orange), again with no tab switch

### Test: Live increment on the keyboard-shortcut capture path (no tab switch)

**Given** tab A (`http://localhost:5101`) is a green target with report `count: 0`, the
active tab
**When** the user triggers the released `w0-keyboard-shortcuts` capture
(`Cmd/Ctrl+Shift+S` → `runCaptureCommand()` → `addScreenshot()`) and the capture completes
so the target's report `count` becomes `1`
**Then** after the keyboard path's transient `✓` flash resets, tab A's icon is **orange**
and its badge shows `1` — the per-tab count went live off the keyboard-shortcut path with
no tab switch, and `runCaptureCommand()` itself was not modified

### Test: Save report → icon returns to green, badge clears

**Given** tab A (`http://localhost:5101`) is **orange** with badge `2` (2 unsaved
screenshots) and a controller owns port `5101`
**When** the report is saved (`SAVE_REPORT` succeeds and the released path clears
`report:5101`) so `GET_STATE` returns `{ count: 0, port: 5101 }`
**Then** tab A's badge clears (empty text) and its icon returns to **green**
**And** the same holds if instead the report is cleared via `CLEAR_REPORT` (green, empty
badge)

### Test: Per-`tabId` isolation + responsive switching (A orange ↔ B green)

**Given** tab A (`:5101`) is **orange** with badge `2`, and tab B (`:5102`) is a green
target with an empty report, and both ports have already been resolved (cached in
`chrome.storage.session`)
**When** the user switches from tab A to tab B
**Then** tab B shows its own **green** empty-badge state and tab A's orange/`2` is
unaffected; the switch fires **no** new `/resolve` probe (both resolutions are cache hits)
and is not blocked on any network call
**When** the user switches back to tab A
**Then** tab A still shows **orange** with badge `2` — each tab carries its own per-`tabId`
state

### Test: Service-worker restart with an active orange tab → state re-derived on wake

**Given** tab A (`http://localhost:5101`) has an in-progress report with `count: 3` (orange,
badge `3`) and is the active tab
**When** the MV3 service worker is force-terminated and then woken (e.g. by the next tab
event), with the top-level `tabs`/`action` listeners rebinding on wake
**Then** the listeners are re-registered (top-level rebind) and tab A's state is re-derived
correctly — icon **orange**, badge `3` — with `count` read from IndexedDB via the
`GET_STATE` path and resolution served from `chrome.storage.session` (or a fresh probe);
no state was lost to a reset module-level variable

### Test: Steady-state-after-flash — transient `✓`/`!` reconcile (released-code boundary)

**Given** tab A (`http://localhost:5101`) is the active tab and, before the capture, is a
green target with report `count: 0`
**When** the keyboard-shortcut capture runs (`runCaptureCommand()` drives its transient
global `✓` flash with `setTimeout` reset) and completes, taking the report to `count: 1`
**Then** after the transient `✓` flash resets, the badge is **not** left stuck on `✓` (nor
on `!` for the error case) — the correct per-`tabId` steady state re-asserts (icon
**orange**, badge `1`) using only the per-`tabId` `action` calls this feature owns, with no
flicker and no fight over the badge, and **without** any edit to `runCaptureCommand()`
**When** instead the capture is cancelled (`runCaptureCommand()` applies its neutral reset
and returns no flash)
**Then** tab A settles back to its correct steady state (here: **green**, empty badge) —
no stuck transient signal

### Test: Deceptive host → gray, no probe (one source of truth for the port)

**Given** the active tab is a deceptive non-loopback host whose name embeds a loopback
label — `http://localhost.evil.com/` (which a bare `portOfUrl` would read as port `:80`)
**When** the tab is activated
**Then** the released `currentTargetPort()` predicate classifies it as **no current
target**, the icon is set **gray**, the badge is empty, and **no** `/resolve` probe is
fired (it is not localhost) — the icon path uses the same single source of truth as the
released w0 read/write gate, so a deceptive host never reads as a green target

### Test: Badge reconciles after a dropped count-tick

> Contract (BOSS-ratified): the live-count trigger is a best-effort, lossy
> `chrome.storage.session` tick (`{ reportCountChanged: { port, count, ts } }`)
> that `w0-per-target-reports` emits after each report-count change; fe-003
> consumes it via a key-filtered `storage.session.onChanged` listener. The tick is
> a **repaint nudge only, never the source of truth** — the badge's authoritative
> count is always the released `GET_STATE { count, port }`, reconciled on every wake
> (SW cold-start + `tabs.onActivated`/`onUpdated`). A dropped tick must never leave
> the badge drifted. Pairs with fe-003's `droppedTick_wakeReconcilesFromGetState`
> unit case.

**Given** the current target (port P) has an in-progress report with N screenshots
and its tab is active (badge orange, count N)
**When** a screenshot is added but the `reportCountChanged` `storage.session` tick is
**not** delivered (dropped on SW teardown mid-write, lost to a session wipe, or a
same-ms `ts` collision), and then a wake event fires (SW cold-start, or
`tabs.onActivated`/`onUpdated` for that tab)
**Then** the badge reconciles from the released `GET_STATE { count, port }` to the
correct count (N+1) — it never drifts from the authoritative report count, because the
tick is only a repaint nudge

### Motion E2E (required for any UI feature; write `n/a` for backend-only)

n/a — this feature is service-worker / `action`-API work with `frontend_lane: N/A`. The
only surface is the toolbar icon/badge, which has no DOM and no animated transition to
assert; its "motion" is discrete `action`-API state changes (gray/green/orange + badge
count), which are covered as state assertions by the E2E specs above. There is no
component-library motion-token catalog applicable to a 16px toolbar icon.

## Stories (populated by architects)

- [ ] STORY-fe-001 — <summary> (frontend-engineer)
- [ ] STORY-be-001 — <summary> (backend-engineer)
- [ ] STORY-db-001 — <summary> (database-engineer)
- [ ] STORY-do-001 — <summary> (devops-engineer)

## Defects (populated as found)

- (none yet)
