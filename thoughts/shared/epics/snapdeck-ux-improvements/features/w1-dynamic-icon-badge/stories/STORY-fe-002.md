---
type: story
id: STORY-fe-002
name: "Tab-event icon derivation + two-tier resolve + session cache"
domain: frontend
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 3
status: pending
depends_on: [STORY-fe-001]
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-150619-36719
frontend_lane: N/A
visual_references: []
defects: []
diff_estimate: substantive
---

# Story: Tab-event icon derivation + two-tier resolve + session cache

## What we're doing

Wire the per-`tabId` icon **state machine** to tab events. Register top-level
`chrome.tabs.onActivated` / `onUpdated` listeners (MV3 ephemeral-worker rebind) that
re-derive the **active** tab's Snapdeck state and paint it via fe-001's
`applyIconState`. Derivation reuses the **released** w0 read path as the single source
of truth — `currentTargetPort()` for the port (deceptive-host parity), `findController()`
for the `/resolve` probe, `getReport(port)` for the count — with a two-tier responsiveness
rule: instant **gray** for non-localhost (no probe at all), and the `/resolve` fan-out
only on a `chrome.storage.session` cache miss for a localhost tab. No released code is
modified; the cache is the only new persisted surface (session-scoped, MV3-safe).

This story delivers the three **steady states** on tab activation/update + per-tab
isolation + restart re-derivation. The **live** count increment on capture and the
transient-flash reconcile are **STORY-fe-003** (held pending a team-lead ruling).

## What it should look like

New top-level section in `background.js` (below released code, below fe-001's section):

```js
// --- tab-driven icon derivation (w1-dynamic-icon-badge) ----------------------
const RESOLVE_TTL_MS = 30000;  // green/gray resolution cache TTL (self-heals deck up/down)

// Two-tier resolution with a chrome.storage.session cache keyed by browser port.
async function resolvePortCached(port) {
  const key = `resolve:${port}`;
  const hit = (await chrome.storage.session.get(key))[key];
  if (hit && (Date.now() - hit.ts) < RESOLVE_TTL_MS) return hit.resolved;  // cache hit → NO probe
  const ctrlPort = await findController(port);          // released seam — the ONLY probe
  const resolved = ctrlPort != null;
  await chrome.storage.session.set({ [key]: { resolved, ts: Date.now() } });
  return resolved;
}

async function invalidateResolveCache(port) {
  if (port == null) return;
  await chrome.storage.session.remove(`resolve:${port}`);
}

// Re-derive + paint the CURRENT active tab. Reuses currentTargetPort() (the released
// single source of truth) — never a second/looser localhost predicate (AC10).
async function refreshActiveTab() {
  const tab = await activeTab();                 // released helper
  if (!tab) return;
  const tabId = tab.id;
  const port = await currentTargetPort();        // released SSOT (non-localhost/deceptive → null)
  if (port == null) { await applyIconState(tabId, { state: "gray" }); return; }   // AC1/AC10 — no probe
  const resolved = await resolvePortCached(port);
  if (!resolved) { await applyIconState(tabId, { state: "gray" }); return; }      // AC3
  const r = await getReport(port);               // released read seam (SSOT for count)
  const count = r.screenshots.length;
  await applyIconState(tabId, count > 0 ? { state: "orange", count } : { state: "green" }); // AC4/AC2
}

// Top-level listeners — registered SYNCHRONOUSLY at module scope (AC8).
// NOTE the double `?.` (`onActivated?.addListener?.`) — see "Defensive registration".
chrome.tabs.onActivated?.addListener?.(() => { void refreshActiveTab(); });
chrome.tabs.onUpdated?.addListener?.((tabId, changeInfo, tab) => {
  if (!tab || !tab.active) return;               // best-effort: only the active tab
  if (changeInfo.status === "loading") { void (async () => {
    await invalidateResolveCache(await currentTargetPort());  // reload re-probes (deck up after the fact)
  })(); }
  if (changeInfo.status === "complete" || changeInfo.url) { void refreshActiveTab(); }
});
```

**Resolution model (the decision tree `refreshActiveTab` implements):**

1. `currentTargetPort()` → `null` (non-localhost OR deceptive `localhost.evil.com`) ⇒
   **gray**, empty badge, **no `/resolve` probe fired** (AC1, AC10).
2. localhost port, `resolvePortCached` cache **hit** within TTL ⇒ use cached result,
   **no new probe** (AC2, AC12); cache **miss/expired** ⇒ one `findController()` fan-out,
   then cache `{resolved, ts}` (AC12).
3. resolved `false` ⇒ **gray** (AC3). resolved `true` + `getReport(port).screenshots.length`:
   `> 0` ⇒ **orange** + count badge (AC4); `=== 0` ⇒ **green** (AC2). Orange takes
   precedence over green by construction (count checked last).

**Cache freshness (per backend-architect's heads-up):** `resolve_owner` keys off a live
controller's `browsable_ports`, so a port's owner can flip across `deck up`/`deck down`.
The 30s TTL + cache-bust on reload (`onUpdated status==='loading'`) bound stale-green to
≤30s or until the next reload — acceptable per scope's best-effort multi-window/freshness
posture. (Document as an accepted risk; flagged for Contrarian 5.5.)

## Existing behavior baseline

- **Currently:** `extension/background.js:59-75` — `activeTab()` / `currentTargetPort()`
  / `portOfUrl()`: the released **single source of truth** for the active tab's target
  port (localhost-gated; deceptive host → `null`). `background.js:88-101` —
  `findController(browserPort)`: the released `/resolve` probe fan-out
  (`CONTROLLER_TRIES` fetches; returns owning controller port or `null`).
  `background.js:40-43` — `getReport(port)`: released read seam (`count` =
  `screenshots.length`). `background.js:104-116` — released top-level
  `runtime.onMessage` + `commands.onCommand` listeners.
- **Dispatch path / call graph:** (NEW) `tabs.onActivated`/`onUpdated` →
  `refreshActiveTab()` → `currentTargetPort()` (active tab) → `resolvePortCached(port)`
  → `findController()` (probe, on cache miss) → `getReport(port)` (count) →
  `applyIconState(tabId, …)` (fe-001).
- **No-regression assertion:** `currentTargetPort()` / `portOfUrl()` /
  `findController()` / `getReport()` / the released listeners / the `GET_STATE` handler
  are **reused unchanged** — NOT edited. No second port-derivation and no looser
  localhost predicate is introduced (AC10). The released global-badge flash is untouched.
- **Explicitly changing:** ADD `chrome.tabs.onActivated`/`onUpdated` listeners,
  `refreshActiveTab()`, `resolvePortCached()` (+ `chrome.storage.session` cache),
  `invalidateResolveCache()`, `RESOLVE_TTL_MS`.
- **Verified:** 2026-06-19 (read `background.js` end-to-end; confirmed contracts with
  backend-architect + database-architect — see Cross-domain contract).

## How we're doing it

- Edit only `extension/background.js` (add the section above) and
  `extension/background.icon-badge.test.mjs` (extend with fe-002 cases). No manifest,
  no permission, no asset change (`storage.session` is covered by the granted `storage`
  permission — confirmed with devops-architect; AC13).
- **One source of truth (AC10):** derive the port ONLY via the released
  `currentTargetPort()`. Do NOT re-implement the localhost regex (`background.js:73`),
  do NOT call `portOfUrl()` on an arbitrary tab URL to classify a target. `refreshActiveTab`
  paints the genuinely-active tab (`activeTab().id`); multi-window non-focused activations
  are best-effort (repaint when their window/tab next becomes active) — acceptable per scope.
- **Count source (AC10, per database-architect):** read the count via `getReport(port)`
  → `screenshots.length` consistently. Do NOT fork a second count read (e.g. don't also
  go through the `GET_STATE` message in one place and `getReport` in another).
- **Defensive registration (load-bearing — do NOT skip the `?.`):** register the new
  top-level listeners as `chrome.tabs.onActivated?.addListener?.(...)` /
  `chrome.tabs.onUpdated?.addListener?.(...)` (double optional-chain). Reason: the
  **released** sibling unit suites (`background.reports.test.mjs`,
  `background.shortcuts.test.mjs`, `background.editormodel.test.mjs`) load this same
  MERGED `background.js` into a `node:vm` against a MINIMAL hand-written `chrome` mock.
  Team-lead-confirmed mock inventory (2026-06-19): it HAS `runtime.onMessage`,
  `commands.onCommand`, `tabs.query`/`captureVisibleTab`/`sendMessage`, and
  `action.setBadgeText`/`setBadgeBackgroundColor`/`setTitle` — but NO `tabs.onActivated`,
  `tabs.onUpdated`, `storage`, or `action.setIcon`. A bare
  `chrome.tabs.onActivated.addListener(...)` would THROW at module load and break those
  released suites — which are off-limits to edit (released-work boundary). The `?.` no-ops
  under the stub and keeps BOSS's cumulative `node --test extension/*.test.mjs` integration
  gate green; in the real MV3 worker the APIs always exist, so registration still happens
  at top level (AC8 holds — synchronous module-scope code, not inside an async callback).
  Note `setIcon`/`storage.session` are only ever called INSIDE functions (never at module
  load), so they don't throw under the stub (the frozen suites never call those functions).
- **Restart (AC7):** because all listeners are top-level, the ephemeral worker rebinds
  them on wake; the active tab is re-derived on the next tab event, reading `count` from
  IndexedDB via `getReport` and resolution from `chrome.storage.session` (or a fresh
  probe). Chrome retains the last per-`tabId` action state across SW death, so there is
  no blank-icon gap. (The explicit SW-cold-start re-derive wake point — a top-level
  feature-detect-GUARDED `if (chrome.storage?.session && chrome.action?.setIcon) void
  refreshActiveTab()` that self-heals on every wake while staying no-op under the frozen
  mock — is added in **fe-003** alongside its lossy-tick reconcile posture; fe-002 itself
  relies on tab events for re-derivation.)
- **Dev-server note:** Chrome extension, no web dev server. Visual checks go through
  the `browser-tester` teammate against the loaded unpacked extension.

## How we validate it was done correctly

- [ ] Non-localhost active tab (`https://example.com`) → `applyIconState(tabId,{state:'gray'})`
      and **zero** `/resolve` fetches issued (AC1).
- [ ] Deceptive host `http://localhost.evil.com/` → gray, **no** `/resolve` fetch (AC10);
      classification uses the released `currentTargetPort()` (not a new predicate).
- [ ] Localhost tab + controller answers `/resolve` `{ok:true}` → green; result cached in
      `chrome.storage.session` keyed by port; a second activation within TTL fires **no**
      new probe (AC2, AC12).
- [ ] Localhost tab, `findController` → null → gray (AC3).
- [ ] Report `count > 0` for the resolved target → orange + badge = count (AC4); `count===0`
      → green (AC2).
- [ ] Per-tab isolation: painting tab B does not alter tab A's previously-set state
      (each call is `{tabId}`-scoped) (AC7 isolation).
- [ ] Reload (`onUpdated status==='loading'`) busts that port's resolution cache so a
      fresh probe runs on the next derive (deck-up-after-the-fact heals to green).
- [ ] All new listeners are top-level (AC8); no listener registered inside an async callback.
- [ ] No second port-derivation / looser localhost predicate (AC10); no new manifest
      permission (AC13).
- [ ] `node --test extension/*.test.mjs` GREEN — the released sibling suites still load
      `background.js` without throwing (defensive `?.` registration verified).
- [ ] browser-tester smoke across two localhost ports (A `:5101` orange, B `:5102` green):
      switching A↔B shows each tab's own state, switch is responsive, second visit fires
      no probe (screenshot both).

## Motion contract

n/a — `action`-API state machine, `frontend_lane: N/A`. State changes are discrete
`chrome.action.*` calls with no DOM, timeline, or reduced-motion surface (feature.md
Motion E2E: n/a).

## Unit tests

All cases extend **`extension/background.icon-badge.test.mjs`** (the fe-001 file). Extend
the `node:vm` harness with: capturing `chrome.tabs.onActivated`/`onUpdated` `addListener`
stubs (store the callback to invoke); a `chrome.storage.session` `{get,set,remove}`
in-memory stub; a `fetch` stub that **counts `/resolve` calls** (so "no probe" is
assertable) and returns `{ok:true}` for an "owning controller" port; and the fe-001
icon/OffscreenCanvas stubs so `applyIconState` runs. Reset all between tests (`beforeEach`).

- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_nonLocalhost_grayNoProbe` —
  active tab `https://example.com` → gray applied, `/resolve` fetch count === 0 (AC1).
- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_deceptiveHost_grayNoProbe` —
  `http://localhost.evil.com/` → gray, fetch count === 0 (AC10).
- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_localhostController_greenCached` —
  localhost:5101 + `/resolve` `{ok:true}` → green; `resolve:5101` written to session; a
  second `refreshActiveTab` fires **no** additional `/resolve` fetch (AC2/AC12).
- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_localhostNoController_gray` —
  no controller answers → gray (AC3).
- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_reportCountPositive_orange` —
  resolved target with `report:5101` of 2 screenshots → orange + badge text `'2'` (AC4).
- `extension/background.icon-badge.test.mjs` — `refreshActiveTab_reportCountZero_green` —
  resolved target, empty report → green, empty badge (AC2/AC6 steady state).
- `extension/background.icon-badge.test.mjs` — `onActivated_registeredTopLevel` — the
  captured `tabs.onActivated` listener is non-null after module load (top-level rebind, AC8).
- `extension/background.icon-badge.test.mjs` — `invalidateOnReload_bustsCacheForPort` —
  after `onUpdated status:'loading'` on the active localhost tab, `resolve:<port>` is
  removed from session so the next derive re-probes.
- `extension/background.icon-badge.test.mjs` — `releasedSiblingSuitesStillLoad` — (smoke
  documented in How-we-validate; the cumulative `node --test extension/*.test.mjs` run is
  the real assertion that defensive `?.` registration didn't break released suites).

## Dependencies

STORY-fe-001 (consumes `applyIconState` / `iconImageDataForState`). Consumes the
released w0 seams `currentTargetPort()`/`portOfUrl()`/`findController()`/`getReport()`
— confirmed unchanged by backend-architect + database-architect (both sentinel this
feature); no in-feature be/db/do producer story to depend on.

## Cross-domain contract

- **backend-architect (confirmed 2026-06-19):** the controller `/resolve` contract is
  UNCHANGED. Success (200) returns `{ ok: true, … }` (truthy `.ok`); non-owner/bad-port
  returns `{ error, status }` with no `ok` key. The released `findController()`
  (`background.js:95`) reading `r.json.ok === true` is correct and stable. STORY-be-001
  is a sentinel.
- **database-architect (confirmed 2026-06-19):** the IndexedDB `report:<port>` record
  (`{ note, screenshots[] }`, `background.js:38`) and the `GET_STATE` payload
  `{ count, note, port }` are UNCHANGED and consumed read-only. STORY-db-001 is a
  sentinel. The `chrome.storage.session` resolution cache is FE-owned, not a DB.

## History

- 2026-06-19 — created by frontend-architect (effort=3, depends on STORY-fe-001)
