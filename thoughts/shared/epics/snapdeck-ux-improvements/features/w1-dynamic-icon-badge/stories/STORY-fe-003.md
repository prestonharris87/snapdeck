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
status: approved
depends_on: [STORY-fe-001, STORY-fe-002]
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-150619-36719
frontend_lane: N/A
visual_references: []
defects: []
diff_estimate: substantive
---

# Story: Live-count freshness trigger + transient-flash reconcile

> ✅ **FINAL — trigger contract LOCKED + w0 producer FROZEN (commit `6512a12`).**
> Coordination-point #4 resolved as **Option A**: w0-per-target-reports' `background.js`
> ALREADY emits the guarded tick `chrome.storage?.session?.set?.({ reportCountChanged:
> {port,count,ts} })` (via `emitReportCountChanged(port,count)`, null-guarded; 3 call
> sites — `addScreenshot`→`screenshots.length`, `saveReport` success→`0`, `CLEAR_REPORT`→
> `0`). This story consumes it via a top-level `chrome.storage.session.onChanged` listener.
> Per BOSS serialization the producer is MERGED AHEAD of us, so the consumer code (written
> in `/mat_implement_feature`) lands on top of an existing emit. The w0 linkage stays at the
> FEATURE level (feature.md `depends_on: [w0-per-target-reports]`) — NOT in this story's
> `depends_on` (story ids are bare/non-qualified; w0 also has a `STORY-fe-003`). Keep
> `depends_on: [STORY-fe-001, STORY-fe-002]`.

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
at the moment a capture/save changes the count.** The *signal* for that moment is the
locked `reportCountChanged` tick — the w0 producer is already merged/frozen (commit
`6512a12`), so this consumer is final and lands on top of an existing emit.

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

**▶ Option A (LOCKED + w0 producer FROZEN, commit `6512a12`) — observable tick + `storage.session.onChanged`:**

> **Why `storage.session.onChanged`, NOT a 2nd `onMessage` listener:** a SECOND top-level
> `chrome.runtime.onMessage.addListener` would BREAK the released sibling suites — their
> vm `chrome.runtime.onMessage` mock single-captures the *last* listener
> (`background.reports.test.mjs:88`), so released `GET_STATE`/`SET_NOTE` tests would invoke
> OUR listener and hang (no `sendResponse`). Those test files are released and un-editable.
> The `storage.session` tick is equivalently tiny on the released side and harness-safe.

- **Producer — already MERGED/FROZEN in w0-per-target-reports (commit `6512a12`; NOT part
  of this FE story's diff):** `emitReportCountChanged(port, count)` (null-guarded) emits a
  guarded, fire-and-forget tick **after the IDB write** at 3 call sites — `addScreenshot()`
  → `r.screenshots.length`, `saveReport()` success → `0`, and the `CLEAR_REPORT` handler →
  `0`: `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })`.
  (BOSS-ratified + verified on disk 2026-06-19 — final; no further mechanism churn.)
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
- **🔒 DESIGN REQUIREMENT (BOSS-elevated) — the tick is a repaint nudge, NEVER source of
  truth.** The badge's **authoritative count source is the released `GET_STATE {count,
  port}`** seam (= `currentTargetPort()` + `getReport(port).screenshots.length`),
  reconciled on **every wake** (SW cold-start + `onActivated` + `onUpdated`). The
  `reportCountChanged` tick is BEST-EFFORT / lossy by design — `storage.session.set` is
  fire-and-forget/un-awaited (can drop on SW teardown mid-write), `storage.session` wipes
  on session reset, and ms-resolution `ts` means two same-millisecond count changes can
  yield a byte-identical payload that doesn't fire `onChanged`. So the tick ONLY triggers a
  repaint *between* reconciliations; it is never read as the count. **Reuse fe-002's
  EXISTING green/gray wake path** — the tick consumer calls fe-002's `refreshActiveTab`
  (which reads the count via the `GET_STATE`/`getReport` SSOT), the SAME function
  `onActivated`/`onUpdated`/cold-start already use. Do NOT add a parallel count path or
  trust `newValue.count` as authoritative (it's available only for the optional best-effort
  multi-window repaint of NON-active tabs). Same-ms collisions are negligible at human
  capture pace, and any dropped tick self-heals at the next wake.
- **SW cold-start wake point (self-heals a tick dropped during teardown):** add a top-level
  GUARDED re-derive so the active tab repaints on every SW wake, not only on tab events:
  `if (chrome.storage?.session && chrome.action?.setIcon) void refreshActiveTab();`. MV3
  re-evaluates the SW top level on each wake, so this runs on every cold-start; the
  feature-detect guard keeps module load clean under the frozen no-`storage`/no-`setIcon`
  mock (condition false → no call → no unhandled rejection; gate-2 criterion #1 holds).
  This strengthens fe-002's AC7 restart handling — a tick lost mid-teardown self-heals on
  the next wake instead of waiting for a tab switch.

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
  `addScreenshot`, `saveReport`, the `CLEAR_REPORT` handler, `emitReportCountChanged`, or
  the released `onMessage` listener — all released w0/kb seams stay byte-identical. (The
  `reportCountChanged` emit is the already-merged w0 producer at commit `6512a12`, outside
  this FE story's diff.) fe-003 adds only a new `storage.session.onChanged` consumer and
  refines fe-002's green/gray badge-clear arg. No second `onMessage` listener is added
  (harness-safety, above).
- **Explicitly changing:** ADD `chrome.storage.session.onChanged` consumer →
  `refreshActiveTab`; refine green/gray clear to `setBadgeText({tabId, text:null})` for
  flash fall-through.
- **Verified:** 2026-06-19 (read `background.js`, `popup/popup.js`, `background.reports.test.mjs`).

## How we're doing it

- Edit only `extension/background.js` (new `onChanged` consumer + green/gray clear
  refinement) and `extension/background.icon-badge.test.mjs` (add fe-003 cases). No
  manifest/permission/asset change.
- **Released-code boundary (AC11):** do NOT modify `runCaptureCommand()`,
  `emitReportCountChanged`, or any released seam in THIS story. The `reportCountChanged`
  tick is the already-merged w0 producer (commit `6512a12`) — consume it; never edit
  released code.
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
- [ ] (robustness — lossy tick) SW cold-start re-derives the active tab on wake when
      `storage`/`action.setIcon` exist, and is SKIPPED (no throw / no unhandled rejection)
      under the frozen no-`storage` mock so gate-2 criterion #1 stays green; the count is
      always reconciled from the `getReport`/`GET_STATE` SSOT at wake points, never trusted
      solely from a (lossy) tick.
- [ ] **(BOSS-required E2E) badge-correct-after-a-dropped-tick** — with the report at a
      known count, simulate a MISSED/dropped `reportCountChanged` tick (no `onChanged`
      fires), then fire a wake event (`onActivated`/`onUpdated` or SW cold-start) and assert
      the badge reconciles to the correct count from `GET_STATE` — proving the badge never
      drifts when the lossy tick stream drops an event. (Browser-tester E2E; PO to add the
      matching spec to feature.md — flagged to team-lead.)
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
- `extension/background.icon-badge.test.mjs` — `coldStart_rederivesActiveTab_whenApisPresent` —
  with `storage.session` + `action.setIcon` + `tabs.query` fully stubbed (active tab =
  resolved localhost:5101, `report:5101` count 2), loading the merged module triggers the
  top-level guarded re-derive → the active tab is painted orange `'2'` (self-heal-on-wake).
  Pairs with `moduleLoadsClean_noStorageInMock` (guard false → no call, clean load).
- `extension/background.icon-badge.test.mjs` — `droppedTick_wakeReconcilesFromGetState` —
  (BOSS-required) badge shows count 1 (orange); set `report:5101` to count 3 WITHOUT firing
  `onChanged` (simulating a dropped tick); fire a wake event (`onActivated`) and assert the
  badge reconciles to `'3'` from the `GET_STATE`/`getReport` SSOT — the badge never drifts
  when a tick is lost.

## Dependencies

`depends_on: [STORY-fe-001, STORY-fe-002]` — **within-feature only**. The trigger/consumer
half ALSO consumes the `reportCountChanged` tick that **w0-per-target-reports** already
emits in `background.js` (MERGED/FROZEN at commit `6512a12`, `emitReportCountChanged`) —
but this cross-feature linkage is expressed as PROSE here, **NOT** as a `depends_on` entry:
story ids in this framework are bare/non-feature-qualified (w0-per-target-reports ALSO has
a `STORY-fe-003`), so a cross-feature id in `depends_on` would collide / resolve as unknown
(`validate-depends-on.py`). The cross-feature dependency is captured correctly by
feature.md's `depends_on: [w0-per-target-reports]` + BOSS's (already-satisfied) w0-lands-
first serialization. The reconcile half (Part 2) depends only on fe-001/fe-002.

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
- 2026-06-19 — frontend-architect: per team-lead, kept `depends_on:
  [STORY-fe-001, STORY-fe-002]` (within-feature only) — the w0-emission linkage is PROSE
  in `## Dependencies` (story ids are bare/non-qualified; cross-feature id would collide),
  captured at feature level by feature.md `depends_on: [w0-per-target-reports]`.
- 2026-06-19 — frontend-architect: folded w0's contrarian "lossy-by-design tick" posture —
  treat `onChanged` as a nudge, reconcile count from the `getReport`/`GET_STATE` SSOT at
  wake points; added an explicit GUARDED SW-cold-start re-derive wake point (self-heals a
  dropped tick; no-op under the frozen mock) + validation + `coldStart_*` unit case. Also
  reconciled fe-002's restart note to point here.
- 2026-06-19 — frontend-architect: BOSS elevated lossy-tick to a DESIGN REQUIREMENT
  (`GET_STATE` authoritative, tick = nudge-only, reuse fe-002's existing wake path — no
  parallel count path) + a required `droppedTick`-correctness E2E. Added the design-req
  block, the `droppedTick_wakeReconcilesFromGetState` unit case, and the
  badge-correct-after-dropped-tick validation item (PO to add the matching feature.md E2E
  spec — flagged to team-lead).
- 2026-06-19 — frontend-architect: **FINALIZED** — w0 producer verified frozen on disk
  (commit `6512a12`, `emitReportCountChanged`, key `reportCountChanged`, shape
  `{port,count,ts}` — exact match to lock). Dropped the SKELETON/HELD markers; the
  consumer half is now final (consume the existing emit). Ready for Contrarian 5.5 + PO
  arbitration.

## Contrarian Findings

> Phase 5.5 stress-test. Verified against live `extension/background.js` (commit `6512a12`):
> `emitReportCountChanged` at `:53-56` (un-awaited fire-and-forget, null-port-guarded),
> emit sites at `:239` (addScreenshot), `:271` (saveReport success), `:195` (CLEAR_REPORT);
> the released global `✓`/`!` flash at `:132-163`. Key-filter + harness-tolerance confirmed
> against the frozen `background.reports.test.mjs` mock (no `storage`, no `action.setIcon`).

### Finding 1 — "Self-heals at the next wake" overstates coverage: a dropped tick on a dormant SW with an idle user has no wake to heal it

**Severity:** concern
**Mechanism:** The design's robustness rests on "any dropped tick self-heals at the next
wake" + the `droppedTick_wakeReconcilesFromGetState` unit/E2E case. But that case only proves
heal-*on*-wake. Trace the realistic drop cause: `emitReportCountChanged` does an **un-awaited**
`chrome.storage.session.set` (`background.js:55`) *after* the awaited IDB write — so a tick is
realistically lost only when the SW tears down before the fire-and-forget `set` flushes (a
live SW always flushes the microtask). That drop is therefore SW-teardown-coupled — and the
top-level cold-start re-derive only re-runs when the SW **next wakes**. An MV3 SW wakes only
on an event. So the sequence: user captures (count N→N+1) → SW tears down mid-flush, tick
dropped → user then *stares at the toolbar* without switching tabs, reloading, or opening the
popup → **no event wakes the SW**, the cold-start re-derive never runs, and Chrome's retained
per-tab badge shows the stale **N** until the next interaction. Bounded and low-consequence
(the user just captured, so they know they did; any interaction heals; the count is always
reconciled from the `getReport`/`GET_STATE` SSOT) and squarely within scope's best-effort/
lossy posture — but the design language and the `droppedTick` test subtly claim more coverage
than exists.
**Recommendation:** acknowledge — add an `## Acknowledged Risk` block stating "a dropped tick
self-heals at the next *wake event*; an idle dormant SW shows a stale count until the next
user interaction (tab switch / reload / popup open) — accepted under the best-effort tick
posture." (No code change; this is a truth-in-labeling fix so PO accepts the idle blind spot
consciously rather than believing the heal is unconditional.)

### Finding 2 — On an orange tab, the released global `!` ERROR flash is masked by the tab-specific count badge → silent capture failures on tabs with unsaved screenshots

**Severity:** concern
**Mechanism:** Already noted in this story's Part 2 as a "Known limitation (accepted risk)";
this pass confirms it is real and recommends formalizing it. `runCaptureCommand()` drives the
`!` error flash on the **GLOBAL** (no-`tabId`) action badge (`background.js:140-156`), and
Chrome's documented action-badge precedence makes a tab-specific value shadow the global value
for that tab. So on an ORANGE tab (a tab-specific count badge is set), a failed keyboard-
shortcut capture's red `!` and its global error `setTitle` are **masked** — the user sees the
unchanged orange count and gets no error signal that the capture failed. The only implicit cue
is "the count didn't increment." This is a visible degradation of the released `w0-keyboard-
shortcuts` error feedback specifically on tabs that already have screenshots. The remedies
(emit a failure tick from released code, or a separate notification surface) are out of scope /
require a BOSS-escalated released-code defect.
**Recommendation:** acknowledge with PO sign-off — promote the prose aside to a formal
`## Acknowledged Risk` block, because it is a behavior-visible regression of released feedback
(not merely an internal trade-off). If PO judges silent capture-errors-on-orange unacceptable,
the path is a BOSS-escalated defect against the released kb code, **not** an in-feature edit.

## Acknowledged Risk

### 2026-06-19 — product-owner arbitration (Contrarian dispositions)

**Risk 1 (Contrarian Finding 1) — "self-heals at the next wake" overstates coverage; idle
dormant-SW blind spot. ACKNOWLEDGED (truth-in-labeling; no code change).**
The robustness claim "any dropped tick self-heals at the next wake" is **qualified here**: the
only realistic tick drop is SW-teardown-coupled (the un-awaited `chrome.storage.session.set` in
the w0 `emitReportCountChanged`), and the cold-start re-derive that heals it runs only when the
SW **next wakes** — and an MV3 SW wakes only on an event. Precise coverage: **a dropped tick
self-heals at the next wake *event* (tab switch / reload / popup open / any tab event); a user
who captures and then idles on the toolbar with no event sees Chrome's retained per-`tabId`
badge hold the stale (under-)count until their next interaction.** Bounded and low-consequence
(the user just captured, so they know they did; the count is always reconciled from the
`getReport`/`GET_STATE` SSOT at the next wake; never an over-count), squarely within scope's
best-effort / lossy-tick posture. This block **supersedes the unqualified "next wake" language**
in the Part-1 design-requirement block and clarifies that
`droppedTick_wakeReconcilesFromGetState` proves heal-*on*-wake (not heal-while-idle), so the
blind spot is accepted consciously rather than believed away. **PO-accepted.**

Status: pending → approved.

## Deferred Decision — BOSS decides at STORIES_LOCKED (route as kb released-code defect vs accept)

### 2026-06-19 — product-owner (Contrarian Finding 2; team-lead/BOSS-directed)

**Orange-tab capture errors are silent — the per-`tabId` count badge shadows kb's released
GLOBAL `!` error flash. This is NOT resolved and NOT accepted here — it is DEFERRED to BOSS at
STORIES_LOCKED.**

**Full interaction (the hidden coupling):**
- The released `runCaptureCommand()` (grep the symbol in `extension/background.js`; the `!`/`✓`
  flash block is ~`:140-156` at commit `6512a12` — line cites have drifted, grep by symbol)
  sets a **GLOBAL** (no-`tabId`) `chrome.action` badge: red `!` (`#C0392B`) + an error
  `setTitle` on failure, green `✓` (`#1E8E3E`) on success, each on a `setTimeout` reset.
- Chrome resolves the action badge **per tab**: a tab-specific badge value takes precedence over
  the global value for that tab. This feature sets a tab-specific orange **count** badge on a
  report-in-progress (orange) tab.
- **Consequence:** on an orange tab, the released global `!` error flash (and its global error
  `setTitle`) are **shadowed** by this feature's tab-specific count badge. A capture **failure**
  on that tab therefore shows **no `!` signal** — the user's only cue is the count not
  incrementing. This is a behavior-visible degradation of released `w0-keyboard-shortcuts` error
  feedback, scoped to tabs already holding ≥1 unsaved screenshot. (The success `✓` being shadowed
  is benign — the count IS the success signal — only the error case loses its signal.)

**Why it cannot be fixed inside this feature:** fe-003 has no signal that a capture *failed*
(the w0 `reportCountChanged` tick fires only on a count change, never on failure), and per scope
directive #4 / AC11 `runCaptureCommand()` is RELEASED `w0-keyboard-shortcuts` code this feature
must not edit. The only real fixes live OUTSIDE this feature's boundary → a BOSS call.

**Proposed released-code fix (for BOSS to route — NOT an in-feature edit):** have kb's
`runCaptureCommand()` set its `!`/`✓` flash on the **active tab's `{tabId}`** (and clear it
per-tab on the `setTimeout` reset) instead of the global no-`tabId` badge. The kb flash then
becomes itself a tab-specific value and is no longer shadowed by — nor fighting — this feature's
per-`tabId` count badge. Small kb-side edit, routed as a **released-work defect against
`w0-keyboard-shortcuts`** if BOSS chooses to fix rather than accept. (Sequencing nuance for the
implementer: on an orange tab the kb `!` and the orange count would then both be tab-specific —
the fix should define which wins during the brief flash window, e.g. let the `!` show then
re-assert the count on reset, the same steady-state-after-flash discipline this feature already
owns in AC11.)

**BOSS decision needed at STORIES_LOCKED — pick one:**
- **(a) Accept** the silent-orange-tab-error as a bounded best-effort gap — rare trigger (a
  failure on a tab that *just* captured successfully: content script already loaded, target
  already resolved) plus the soft count-not-moving cue. If accepted, the revisit triggers still
  apply: re-open if `w2-screenshot-gallery` revisits orange-tab error feedback, if
  capture-failure-on-orange becomes common, or if a user reports a silently-failed capture.
- **(b) Route the kb released-code defect** above (tab-scope the flash).

NOT closed here. Surfaced into the decision-memo (Phase 6.5 reads this story) so the BOSS
decision is on the record. fe-003's own diff is unaffected by either outcome (it never edits kb
code); only the optional kb-side defect is deferred — so the story stays `approved` while this
decision remains open.
