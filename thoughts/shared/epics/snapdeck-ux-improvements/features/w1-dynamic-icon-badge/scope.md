---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-19T15:08:33Z
---

# Dynamic per-tab toolbar icon + badge

## Problem statement

The Snapdeck toolbar (`action`) icon is static — it gives the user no signal about
whether the current tab is a Snapdeck target or whether a capture session is in
progress. This feature turns the icon into a **per-`tabId` state machine**: gray when
the current page is not a Snapdeck target, green when it is a registered target (a
localhost tab whose browser-port is owned by a live controller), and orange with a
live screenshot-count badge while that target has an in-progress report — returning to
green once the report is saved/cleared. It builds directly on the **released**
`w0-per-target-reports` contract (`report:<port>` keying + `GET_STATE { count, note,
port }`); the orange count is the current target's report `count`, and `port` presence
drives the gray-vs-target distinction.

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
    shows `count` from `GET_STATE`, increments live as screenshots are added, and the
    icon returns to **green** (badge cleared) once the report is saved or cleared.
- State driven by `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`, applied
  per `tabId` so it survives service-worker restarts.
- **All** `tabs` / `action` / `runtime` listeners registered at **top level** of
  `background.js` (MV3 ephemeral-worker rebind safety) — no registration inside async
  callbacks.
- **Two-tier responsiveness:** instant gray for non-localhost (no probe at all); the
  `/resolve` registry probe runs only on a `chrome.storage.session` cache miss for a
  localhost tab; tab switching stays responsive (never block a switch on a synchronous
  network probe).
- Reuse the released **read-path** seams as the single source of truth: port via
  `currentTargetPort()` / `portOfUrl()`, count via `GET_STATE` / `getReport()`. No
  second port-derivation path; no looser localhost predicate (a deceptive
  `localhost.evil.com` host resolves to no-target → gray, matching the w0 write/read
  gate parity).
- The port-resolution cache lives in `chrome.storage.session` (MV3-ephemeral-safe);
  no module-level icon/cache state.
- **Live count freshness:** adding a screenshot — via the popup capture path OR the
  released `w0-keyboard-shortcuts` capture path — updates the active tab's orange badge
  count without requiring a tab switch (define the trigger: a lightweight push message
  to the badge updater, or a re-query on the relevant event).
- **Reconcile with the existing transient capture/save badge feedback** in
  `runCaptureCommand()`: today it drives the **global** (non-`tabId`-scoped) `action`
  badge with transient `✓`/`!` flashes (`#1E8E3E` green / `#C0392B` red) on a
  `setTimeout` reset. The new per-tab state machine must coexist so that after a
  transient flash resets, the correct per-tab steady state re-asserts (no stuck `✓`/`!`,
  no flicker), and the two do not fight for the badge.
- Icon assets: three color-states of the existing Snapdeck logo (gray / green / orange).
  Anchor green to the existing badge token `#1E8E3E`; select an orange and a gray per
  `design.md`. The frontend-architect decides asset-PNG-variants vs programmatic
  `OffscreenCanvas`/`ImageData` generation.

## Out of scope (explicit)

- Any change to the `w0-per-target-reports` storage contract — `report:<port>` keying,
  the `GET_STATE` payload shape, and `currentTargetPort()`/`portOfUrl()` semantics are
  **consumed only**, never modified.
- The controller `/resolve` + `/report/save` HTTP contract — unchanged.
- The popup UI (`popup/popup.html`, `popup/popup.js`) — unchanged; the toolbar
  icon + badge is the only new surface.
- The capture / annotate / editor-overlay flow.
- A broad messaging-API redesign. (A single lightweight notify/push message to keep the
  active tab's count live IS in scope; reworking the existing message types is not.)
- Multi-window perfection beyond per-`tabId` correctness (best-effort across windows).
- Migration of any pre-existing state — there is none for icon/badge.

## Branch policy

BOSS-mode multi-team epic. Commits land on the epic feature branch
`feature/snapdeck-ux-improvements` (atomic pathspec while warm teammates stage in
parallel). Commits are pre-approved; **BOSS coordinates the push window** — whisper
`READY TO PUSH` and await ack; never self-push. I am the **sole Wave-1 toucher of
`background.js`** — re-confirm at `STORIES_LOCKED` whether implement-serialization vs
the w1 siblings is needed (their regions are orthogonal: `w1-draggable-toolbar-toggle`
→ toolbar position in `storage.local` + `annLayer` visibility; `w1-text-box-autofit`
→ `editor.js`/`model`).

## Critical directives

1. **One source of truth for the port.** Reuse `currentTargetPort()` / `portOfUrl()`
   and `GET_STATE`; do NOT introduce a second port-derivation or a looser localhost
   predicate. A deceptive host (`http://localhost.evil.com`) must classify as no-target
   → **gray**, matching the released w0 write/read gate parity (w0 `fe-001` LOW-1).
2. **All listeners at top level.** `tabs.onActivated`, `tabs.onUpdated`, and the
   `action`/`runtime` listeners are registered synchronously at the top of
   `background.js` so the MV3 ephemeral worker rebinds them on wake. No listener
   registration inside an async callback.
3. **No module-level state.** The port-resolution cache lives in
   `chrome.storage.session`; per-tab icon/badge is set via the `tabId`-scoped `action`
   API and re-derived on demand. State must survive a service-worker restart.
4. **Reconcile with existing badge feedback (hidden-coupling hot-spot).**
   `runCaptureCommand()` already drives the GLOBAL `action` badge for transient `✓`/`!`
   capture-feedback flashes. The per-tab state machine must coexist with it: decide
   explicitly whether the per-tab model absorbs or cleanly layers over the existing
   flash logic, with no stuck transient badge and no fight over the badge. **Flag for
   Contrarian 5.5 review.**
   **BOSS ruling (released-work boundary, 2026-06-19):** `runCaptureCommand()` is
   `w0-keyboard-shortcuts`' **RELEASED** code — it is **READ-ONLY** for this feature.
   Reconcile entirely on our side: the per-`tabId` state machine re-asserts the correct
   steady state *after* kb's transient flash, using only the per-`tabId` `action` calls
   this feature owns. Do **NOT** edit kb's `runCaptureCommand()` lines. If planning or
   the Contrarian pass concludes the reconcile is genuinely impossible without changing
   kb's badge behavior, that is a **defect in released work** — surface it to BOSS (who
   re-engages the kb team via the defect flow); do NOT modify kb's code unilaterally.
   The E2E spec MUST assert **steady-state-after-flash** explicitly.
5. **Cheap tab switching.** Gray is instant for non-localhost (no probe). The
   `findController()` `/resolve` fan-out (`CONTROLLER_TRIES` fetches) runs ONLY on a
   `storage.session` cache miss for a localhost tab. Never block a tab switch on a
   synchronous network probe.
6. **Count freshness trigger.** Adding a screenshot (popup OR keyboard-shortcut path)
   must update the active tab's orange badge count live; save/clear returns it to green.
   Define the trigger explicitly (push message vs re-query on event).

## Mockup decision

`skip_ui_designer: true` — no new HTML screen or component. The only visual artifacts
are three color-states of the existing 16/48/128 Snapdeck toolbar icon plus a numeric
badge; the ui-designer's HTML-mockup tooling does not fit a 16px toolbar icon. The
frontend-architect specs the three states (anchoring green to the existing `#1E8E3E`
badge token and selecting orange/gray per `design.md`) and the asset-vs-programmatic
icon-generation approach. `frontend_lane: N/A` — this is service-worker / `action`-API
work with no DOM or component-library surface.

## Acceptance criteria (seeds for PO to expand)

- On a non-localhost tab the icon is **gray immediately** (instant, no probe fired).
- On a localhost tab whose browser-port is owned by a live controller (per a cached
  `/resolve` probe), the icon is **green** ("registered target").
- On a localhost tab with no live controller, the icon is **gray** (no registered
  target) — distinct from green; decide whether a separate "localhost-but-unregistered"
  signal is warranted (default: gray).
- While the current target has an in-progress report, the icon is **orange** and the
  badge shows the live screenshot `count`; the count increments as screenshots are
  added (popup or keyboard-shortcut path), without a tab switch.
- After the report is saved (or cleared), the icon returns to **green** and the badge
  clears.
- Icon/badge state is driven by `tabs.onActivated` / `tabs.onUpdated` and set per
  `tabId` so it survives service-worker restarts; the registry-resolution cache lives in
  `chrome.storage.session`.
- All `tabs` / `action` listeners are registered at top level (MV3 ephemeral-worker
  rebind).
- Tab switching with the two-tier check stays responsive (instant gray for
  non-localhost; cached registry probe only for localhost tabs without an active report)
  — no sluggish tab switch.
- The existing transient `✓`/`!` capture/save feedback flash never leaves the badge
  stuck; the correct per-tab steady state re-asserts after the flash.

## E2E coverage hints (PO will write the actual specs)

- Non-localhost tab → gray icon, empty badge, **no** `/resolve` probe fired.
- Localhost tab owned by a live controller → green icon after the cached resolve.
- Localhost tab with no live controller → gray icon.
- In-progress report on the current target → orange icon + badge = `count`; a new
  capture increments the badge live (no tab switch).
- Save report → icon returns to green, badge clears.
- Tab switch A↔B with different states → each tab shows its own per-`tabId` state; the
  switch stays responsive (cached probe, no sluggishness; second visit to a known tab
  fires no probe).
- Service-worker restart with an active orange tab → state re-derived correctly on wake
  (listeners rebound at top level; count read from IndexedDB via `GET_STATE`).
- Transient capture-feedback flash (`✓`/`!`) → does not leave the badge stuck; per-tab
  steady state re-asserts after the flash resets.
