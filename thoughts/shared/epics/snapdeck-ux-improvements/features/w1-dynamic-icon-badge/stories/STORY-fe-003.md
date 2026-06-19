---
type: story
id: STORY-fe-003
name: "Live-count freshness trigger + transient-flash reconcile"
domain: frontend
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: pending
depends_on: [STORY-fe-001, STORY-fe-002]
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-150619-36719
frontend_lane: N/A
visual_references: []
defects: []
diff_estimate: substantive
---

# Story: Live-count freshness trigger + transient-flash reconcile

> ⚠️ **SKELETON — the trigger CONTRACT is LOCKED (team-lead, 2026-06-19); finalize
> once w0's emission freezes.** Coordination-point #4 resolved as **Option A**: w0 emits
> a guarded `chrome.storage?.session?.set?.({ reportCountChanged: {port,count,ts} })` tick
> (a separate released-work defect tracked on the defect subchannel); this story consumes
> it via a top-level `chrome.storage.session.onChanged` listener. The **reconcile** half
> below is FINAL. Add the w0-emission defect story id to `depends_on` once it's opened.

## What we're doing

Two coupled behaviors that complete the per-`tabId` icon state machine around a
capture/save:

1. **Live-count freshness (AC5):** when a screenshot is added to the current target —
   via the popup `ADD_SCREENSHOT` path OR the released `w0-keyboard-shortcuts`
   `runCaptureCommand()` path — the active tab's **orange** badge count updates live,
   with no tab switch; and on save/clear the icon returns to **green** (AC6).
2. **Transient-flash reconcile (AC11):** the released `runCaptureCommand()` drives the
   GLOBAL `action` badge with transient `✓`/`!` flashes. The per-`tabId` steady state
   must coexist so there is no stuck `✓`/`!`, no flicker, and the correct steady state
   re-asserts after the flash — using ONLY the per-`tabId` `action` calls this feature
   owns, with **no edit to `runCaptureCommand()`** or any released seam.

Both reduce to: **re-derive + repaint the active tab (fe-002's `refreshActiveTab`)
at the moment a capture/save changes the count.** The only open question is the
*signal* for that moment (the trigger), which is the gated part.

## What it should look like

### Part 2 — Reconcile (FINAL; no ruling needed)

Chrome resolves the badge per tab: **a tab-specific badge value takes precedence over
the global (no-`tabId`) badge** for that tab. fe-003 leans on this:

- **No stuck `✓`/`!`:** this feature NEVER writes a tab-specific `✓`/`!`. The released
  `setTimeout` (`background.js:135-138/145-148/152-155`) clears the GLOBAL flash on its
  own. So nothing of ours can get stuck, and the global flash self-clears. ✔ minimal AC11.
- **Orange tab:** the tab-specific count (`String(count)`, orange bg) supersedes the
  global flash on that tab. The count IS the success signal, so the redundant `✓` being
  masked is intended. After the flash clears globally, the tab still shows its
  orange count (tab-scoped state persists). ✔ steady-state-after-flash.
- **Green / gray tab — refine fe-002's badge-clear so the released flash stays visible
  then settles:** clear the tab badge with `chrome.action.setBadgeText({ tabId, text: null })`
  (removes the tab override → the tab falls back to the GLOBAL badge: empty normally,
  `✓`/`!` during a flash) rather than `text: ""` (a hard per-tab mask). Net on a green
  tab: the released `✓`/`!` flashes through, then the global reset returns it to empty —
  preserving the released kb feedback on not-yet-orange tabs. **Verify this `null`
  fall-through behavior empirically via browser-tester** (Chrome badge-reset semantics
  are subtle); the validation asserts the OBSERVED behavior, not the exact arg.
- **Known limitation (Contrarian 5.5 — accepted risk):** on an ORANGE tab, the released
  global `!` *error* flash (and its global `setTitle`) are masked by the tab-specific
  count/title. Surfacing per-tab capture **errors** would require editing released code
  (the Option-A defect could optionally also emit a failure tick) or a separate
  notification surface (out of scope). Documented, not solved here.

### Part 1 — Live-count trigger

**▶ Option A (LOCKED contract — team-lead 2026-06-19) — observable tick + `storage.session.onChanged`:**

> **Why `storage.session.onChanged`, NOT a 2nd `onMessage` listener:** a SECOND top-level
> `chrome.runtime.onMessage.addListener` would BREAK the released sibling suites — their
> vm `chrome.runtime.onMessage` mock single-captures the *last* listener
> (`background.reports.test.mjs:88`), so released `GET_STATE`/`SET_NOTE` tests would invoke
> OUR listener and hang (no `sendResponse`). Those test files are released and un-editable.
> The `storage.session` tick is equivalently tiny on the released side and harness-safe.

- **Released-work defect (separate story; NOT part of this FE story's diff):** w0 emits a
  guarded, fire-and-forget, **null-port-gated** tick **AFTER the IDB write** — after
  `await setReport(port, r)` in `addScreenshot()` (`background.js:227`),
  `await clearReport(...)` in `saveReport()` (`background.js:258`), and in the
  `CLEAR_REPORT` handler (`background.js:185`):
  `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })`.
  (BOSS-ratified 2026-06-19 — final; no further mechanism churn.)
- **This FE story (consumer):** a NEW top-level listener
  `chrome.storage?.session?.onChanged?.addListener?.((changes) => { … })` (double
  optional-chain for frozen-mock tolerance — the released suites stub no `storage`). The
  body MUST **strictly key-filter**: act ONLY on `changes.reportCountChanged` and ignore
  every other key — critically fe-002's own `resolve:<port>` cache writes, which also land
  in `chrome.storage.session`. Without this filter the listener self-triggers on every
  cache write (BOSS-flagged loop / wrong re-derive). `chrome.storage.session.onChanged` is
  already session-area-scoped, so no areaName check is needed. Read the carried
  `{ port, count } = changes.reportCountChanged.newValue`.
- **Why it satisfies AC5/AC6/AC11:** on a `reportCountChanged` tick, re-derive + repaint
  the ACTIVE tab via `refreshActiveTab()` (fe-002) — it re-reads the count from IndexedDB
  via the `getReport` SSOT and applies orange `N` (count>0) or green (count==0, the
  orange→green transition on save/clear), with no tab switch. Captures/saves always run on
  the active tab's port, so the active-tab re-derive covers the dominant case. The carried
  `newValue.{port,count}` is available for an OPTIONAL best-effort multi-window pass
  (repaint other tabs whose resolved port === `newValue.port`); deferred as best-effort per
  scope (those tabs otherwise repaint on their next `onActivated`). On the kb path the tick
  fires inside `addScreenshot` *before* `runCaptureCommand` sets the global `✓`, so the tab
  settles to its per-tab steady state (masking the redundant `✓`) and persists after the
  global reset → steady-state-after-flash.
- `storage.onChanged` fires in the originating SW context, so the same worker that wrote
  the tick repaints. No new permission (`storage.session` already granted).

**▷ Option B (SUPERSEDED) — released-code-free bounded re-derive.** Was the fallback if the
released edit were declined; the team-lead locked Option A, so this is retained only as
rationale. It needed timers, was fragile on cancelled annotations, and softened AC5 (count
lagging until the next tab event). Do not implement unless Option A is reversed.

## Existing behavior baseline

- **Currently:** `extension/background.js:118-163` — released `runCaptureCommand()`
  drives the GLOBAL `action` badge `✓`/`!` flashes (`#1E8E3E`/`#C0392B`) with
  `setTimeout` reset (`:135-138/145-148/152-155`). `:227` — `addScreenshot()`'s
  `setReport`; `:258` — `saveReport()`'s `clearReport`; `:185` — `CLEAR_REPORT` handler.
  `:104-107` — released `runtime.onMessage` listener (single handler). No observable
  event fires when a report's count changes (IndexedDB writes are unobservable;
  `chrome.storage.onChanged` does not fire for IDB).
- **Dispatch path / call graph:** kb: `commands.onCommand` → `runCaptureCommand` →
  `addScreenshot` → `setReport` (IDB). popup: `onMessage(ADD_SCREENSHOT)` →
  `addScreenshot` → `setReport`. save: `onMessage(SAVE_REPORT)` → `saveReport` →
  `clearReport`. clear: `onMessage(CLEAR_REPORT)` → `clearReport`.
- **No-regression assertion:** fe-003's OWN diff does NOT edit `runCaptureCommand`,
  `addScreenshot`, `saveReport`, the `CLEAR_REPORT` handler, or the released `onMessage`
  listener — all released w0/kb seams stay byte-identical. (Option A's tick write is a
  SEPARATE BOSS-owned released-work defect, tracked outside this FE story's diff.) fe-003
  adds only a new `storage.session.onChanged` consumer and refines fe-002's green/gray
  badge-clear arg. No second `onMessage` listener is added (harness-safety, above).
- **Explicitly changing:** ADD `chrome.storage.session.onChanged` consumer →
  `refreshActiveTab`; refine green/gray clear to `setBadgeText({tabId, text:null})` for
  flash fall-through.
- **Verified:** 2026-06-19 (read `background.js`, `popup/popup.js`, `background.reports.test.mjs`).

## How we're doing it

- Edit only `extension/background.js` (new `onChanged` consumer + green/gray clear
  refinement) and `extension/background.icon-badge.test.mjs` (add fe-003 cases). No
  manifest/permission/asset change.
- **Released-code boundary (AC11):** do NOT modify `runCaptureCommand()` or any released
  seam in THIS story. The Option-A tick is a separate BOSS released-work defect; if BOSS
  declines, fall back to Option B (do not unilaterally edit released code).
- **Defensive registration:** register as
  `chrome.storage?.session?.onChanged?.addListener?.(...)` (double optional-chain) so the
  released sibling suites — whose frozen `chrome` mock stubs NO `storage` at all
  (team-lead-confirmed inventory) — still load `background.js` without throwing at module
  load. Same rationale as fe-002's tab listeners. Do NOT add a 2nd `onMessage` listener
  (breaks the released suites' single-capture mock).
- **Dev-server note:** Chrome extension, no web dev server; visual reconcile checks go
  through the `browser-tester` teammate against the loaded unpacked extension.

## How we validate it was done correctly

- [ ] (AC5) Add a screenshot on a green target via the **popup** path → active tab goes
      orange, badge = new count, with **no** tab switch; a second add → badge increments live.
- [ ] (AC5) Add via the **keyboard-shortcut** path → after the transient `✓`, the active
      tab is orange with the new count, no tab switch, `runCaptureCommand()` unmodified.
- [ ] (AC6) Save (`SAVE_REPORT` success) or clear (`CLEAR_REPORT`) → badge clears, icon
      returns to green, no tab switch.
- [ ] (loop-prevention, BOSS-flagged) the `onChanged` listener does NOT re-derive when a
      fe-002 `resolve:<port>` cache write fires — strict `changes.reportCountChanged`
      key-filter; no self-trigger loop.
- [ ] (AC11) After a kb `✓` flash resets, the badge is NOT stuck on `✓`/`!`; the active
      tab shows its correct per-`tabId` steady state (orange `N` after a successful add,
      green after a cancel), with no flicker.
- [ ] (AC11) On a GREEN tab, the released `✓`/`!` flash is still visible during its window
      then settles to empty (verify the `text:null` fall-through empirically).
- [ ] fe-003's diff does not touch `runCaptureCommand`/`addScreenshot`/`saveReport`/
      `CLEAR_REPORT`/the released `onMessage` listener (AC11 boundary).
- [ ] No 2nd `onMessage` listener added; `node --test extension/*.test.mjs` GREEN
      (released sibling suites still pass).
- [ ] No new manifest permission (AC13).

## Motion contract

n/a — `action`-API state machine, `frontend_lane: N/A`. No DOM/timeline/reduced-motion
surface (feature.md Motion E2E: n/a). The `✓`/`!` flash timing is released
`setTimeout` behavior, not a motion token this story introduces.

## Unit tests

Extend **`extension/background.icon-badge.test.mjs`**. Add a capturing
`chrome.storage.session.onChanged` `addListener` stub and a helper to fire it with a
`{ reportCountChanged: { newValue: {port,count,ts} } }` change.

**🔒 BOSS-locked gate-2 acceptance criteria (encode exactly these two — maps to BOSS's
`node --test extension/*.test.mjs` integration check):**

1. **Module loads clean when `chrome.storage` is absent.** The top-level consumer
   registration no-ops under a chrome mock with NO `storage` key — this is what keeps
   per-target's + the other frozen released suites green when they load our merged
   `background.js`.
   - `extension/background.icon-badge.test.mjs` — `moduleLoadsClean_noStorageInMock` —
     `vm.runInContext(mergedBackgroundJs, …)` under a chrome mock that omits `storage`
     (and omits `tabs.onActivated`/`onUpdated`) does NOT throw at module load
     (`chrome.storage?.session?.onChanged?.addListener?.` short-circuits).
2. **With `storage.session` stubbed, `onChanged(reportCountChanged)` updates the RIGHT
   tab's badge and is key-filtered.**
   - `extension/background.icon-badge.test.mjs` — `reportCountChanged_rightTabOrange_whenCountPositive` —
     active tab = localhost:5101 (resolved green), `report:5101` count 2; firing
     `onChanged({ reportCountChanged: { newValue: {port:5101, count:2, ts} } })` paints
     **that tab** orange with badge `'2'` (AC4/AC5).
   - `extension/background.icon-badge.test.mjs` — `reportCountChanged_rightTabGreen_whenCountZero` —
     same tab, `report:5101` count 0; the same event paints it **green** with empty badge
     (AC6 — the orange→green transition).
   - `extension/background.icon-badge.test.mjs` — `onChanged_keyFiltered_resolveCacheWriteNoRederive` —
     firing `onChanged({ 'resolve:5101': { newValue: {...} } })` (a fe-002 `/resolve` cache
     write) does NOT trigger a badge re-derive (strict `reportCountChanged` key-filter; no
     self-trigger loop).

**Additional supporting cases:**

- `extension/background.icon-badge.test.mjs` — `green_clearUsesNullForFallThrough` —
  `applyIconState(tabId,{state:'green'})` clears the tab badge with `text:null` (not `''`)
  so the global flash can fall through (asserts the refined clear arg).
- `extension/background.icon-badge.test.mjs` — `noSecondOnMessageListener` — module load
  registers exactly ONE `runtime.onMessage` listener (guards the released-suite
  single-capture harness).

## Dependencies

STORY-fe-001, STORY-fe-002. **Plus: the released-work defect** that adds the
`reportCountChanged` tick to w0's `addScreenshot`/`saveReport`/`CLEAR_REPORT` (locked
contract; tracked on the defect subchannel) — add its story/defect id to `depends_on`
once it's opened. The reconcile half (Part 2) depends only on fe-001/fe-002.

## History

- 2026-06-19 — created by frontend-architect as a SKELETON (effort=2, depends on
  STORY-fe-001/002; live-count trigger mechanism pending BOSS ruling on coordination
  point #4)
- 2026-06-19 — frontend-architect: trigger contract LOCKED by team-lead as Option A
  (`reportCountChanged: {port,count,ts}` tick via `storage.session.onChanged`); swapped
  the `captureTick` placeholder, double-`?.`-guarded the consumer, demoted Option B to
  superseded. Reconcile half final; awaiting w0 emission freeze before final lock.
- 2026-06-19 — frontend-architect: contract BOSS-RATIFIED (final). Hardened the consumer
  per BOSS flags — strict `changes.reportCountChanged` key-filter (ignore fe-002
  `resolve:*` cache writes; no self-trigger loop), read `newValue.{port,count}`, w0 emit
  is null-port-gated/fire-and-forget/after-IDB-write. Consumer half HELD until w0
  `FEATURE_READY`; reconcile half finalized.
- 2026-06-19 — frontend-architect: encoded BOSS's two locked `node --test` gate-2 criteria
  into `## Unit tests` — (1) module-loads-clean under a no-`storage` mock, (2) keyed
  `reportCountChanged` updates the right tab orange/green + `/resolve`-cache-write is
  ignored. (runtime.sendMessage path fully dropped per BOSS re-ratification.)
