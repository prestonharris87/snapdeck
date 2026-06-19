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
2. **Transient-flash reconcile (AC11) — kb-side fix, no fe-003 seam (option (c)):** the
   `defect-badge-flash-shadow` resolution (BOSS-ruled SOLVE, option **(c)**, kb-owned) makes
   `runCaptureCommand()` flash `✓`/`!` per-`tabId` (not global) and drop the destructive
   global pre-clear, so the flash is no longer shadowed by this feature's per-tab count badge.
   fe-003 keeps its EXISTING reconcile (the `reportCountChanged` `onChanged` branch + the wake
   re-derive) and adds NO seam/handback. No edit to released kb code. ⚠️ See `## Cross-team
   item` for a flagged AC5-keyboard residual in kb's shipped self-clear.

Both reduce to: **re-derive + repaint the active tab (fe-002's `refreshActiveTab`)
at the moment a capture/save changes the count.** The *signal* for that moment is the
locked `reportCountChanged` tick — the w0 producer is already merged/frozen (commit
`6512a12`), so this consumer is final and lands on top of an existing emit.

## What it should look like

### Part 2 — Reconcile (steady-state via the existing wake path — no seam, option (c))

The badge-flash shadow is **SOLVED kb-side** by the `defect-badge-flash-shadow` resolution
(BOSS-ruled SOLVE, option **(c)**, lands the same Wave-1 PR): `runCaptureCommand()` flashes
`✓`/`!` on the **active tab's `{tabId}`** (no longer the GLOBAL badge) and **drops the
destructive global pre-clear**, so the flash is no longer shadowed by this feature's per-tab
count badge. fe-003 keeps its EXISTING reconcile — the `reportCountChanged` `onChanged` branch
(Part 1) + the wake re-derive (`onActivated`/`onUpdated`/cold-start) — and adds **NO seam /
handback** (no `globalThis` fn, no `flashCleared` branch).

- **No stuck `✓`/`!` (AC11):** kb's flash is per-`tabId` and self-clears on its own
  `setTimeout`; this feature never writes a tab-specific `✓`/`!`, so nothing of ours sticks.
- **Flash visible on orange tabs (shadow gone):** kb's per-`tabId` flash + dropped global
  pre-clear means the `✓`/`!` shows on the active tab even when it carries an orange count —
  no longer masked.
- **Green / gray steady state is painted EXPLICITLY per-`tabId`** — `applyIconState` (fe-001)
  sets `setBadgeText({ tabId, text: "" })` for green/gray and `{ tabId, text: String(count) }`
  for orange; every steady state writes its OWN tab-scoped badge and does NOT rely on kb's
  (now-dropped) global badge. (The `text:null` global-fall-through idea is obsolete and removed.)
- **Residual after kb's flash self-clears:** kb's teardown clears its flash to empty on
  `{tabId}`; dynamic-icon re-asserts the steady state on its next wake-reconcile. **⚠️ Scope
  caveat (flagged to team-lead — see `## Cross-team item`):** kb's shipped `clearFlash`
  (`background.js:131-139`, via `scheduleFlashClear` :166-174) is UNCONDITIONAL
  (`setBadgeText({tabId, text:""})`), so on the keyboard **success** path it blanks the
  `reportCountChanged`-painted count at teardown too — not just the error path — leaving the
  badge empty until the next wake. That conflicts with AC5 + the "live increment on the
  keyboard-shortcut path" / "steady-state-after-flash" E2Es; the clean fix is a **guarded**
  kb self-clear (clear only if the badge still shows kb's own `✓`/`!`), a kb-side tweak.

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
  optional-chain for frozen-mock tolerance — the released suites stub no `storage`). The body
  MUST **strictly key-filter**: act ONLY on `changes.reportCountChanged` and ignore every
  other key — critically fe-002's own `resolve:<port>` cache writes (also in
  `chrome.storage.session`), else it self-triggers on every cache write (BOSS-flagged loop).
  `chrome.storage.session.onChanged` is already session-area-scoped, so no areaName check. On
  `changes.reportCountChanged` → `void refreshActiveTab()` (re-derives the active tab from the
  SSOT). Carried `{ port, count } = changes.reportCountChanged.newValue` is a signal only.
  **Option (c): NO `flashCleared` branch** — kb writes no `flashCleared` under (c), so such a
  branch would be dead code.
- **Why it satisfies AC5/AC6/AC11:** on a `reportCountChanged` tick, re-derive + repaint
  the ACTIVE tab via `refreshActiveTab()` (fe-002) — it re-reads the count from IndexedDB
  via the `getReport` SSOT and applies orange `N` (count>0) or green (count==0, the
  orange→green transition on save/clear), with no tab switch. Captures/saves always run on
  the active tab's port, so the active-tab re-derive covers the dominant case. The carried
  `newValue.{port,count}` is available for an OPTIONAL best-effort multi-window pass
  (repaint other tabs whose resolved port === `newValue.port`); deferred as best-effort per
  scope (those tabs otherwise repaint on their next `onActivated`). On the kb path the
  `reportCountChanged` tick lands orange `N+1`; after kb's per-`tabId` flash self-clears the
  steady state re-asserts on the next wake-reconcile (Part 2 + `## Cross-team item` — note the
  flagged AC5-keyboard residual where kb's UNCONDITIONAL self-clear blanks the count).
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
  `reportCountChanged` emit is the already-merged w0 producer at commit `6512a12`; the kb
  per-`tabId` flash + global-pre-clear drop are the kb-owned `defect-badge-flash-shadow`
  change, option (c) — both outside this FE story's diff.) fe-003 adds only the
  `storage.session.onChanged` consumer (single `reportCountChanged` branch) and the guarded
  cold-start re-derive. No `flashCleared` branch, no second `onMessage` listener, no
  `globalThis` function, no new top-level `chrome.*` (harness-safety).
- **Explicitly changing:** ADD the `chrome.storage.session.onChanged` consumer (single
  key-filtered `reportCountChanged` branch → `refreshActiveTab`) plus the guarded SW
  cold-start re-derive. Green/gray steady state remains a clean tab-specific empty badge
  painted explicitly by `applyIconState` (NO `text:null` fall-through — kb no longer uses the
  global badge under the `defect-badge-flash-shadow` (c) resolution).
- **Verified:** 2026-06-19 (read `background.js`, `popup/popup.js`, `background.reports.test.mjs`).

## How we're doing it

- Edit only `extension/background.js` (the `onChanged` consumer with the single
  `reportCountChanged` branch + guarded cold-start re-derive) and
  `extension/background.icon-badge.test.mjs` (add fe-003 cases). No manifest/permission/asset
  change.
- **Released-code boundary (AC11):** do NOT modify `runCaptureCommand()`,
  `emitReportCountChanged`, or any released seam in THIS story. The `reportCountChanged` tick
  (w0, commit `6512a12`) and the kb per-`tabId` flash (`defect-badge-flash-shadow`, option
  (c)) are owned elsewhere — CONSUME the tick; never edit released code.
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
- [ ] (AC11) kb's per-`tabId` `✓`/`!` flash is not stuck (kb self-clears its own flash); this
      feature writes no tab-specific `✓`/`!`; the per-`tabId` steady state re-asserts on the
      next wake-reconcile.
- [ ] (shadow SOLVED) On an ORANGE tab, a kb capture's `✓`/`!` IS visible (kb's flash is
      per-`tabId`, global pre-clear dropped) — no longer masked by the count badge.
- [ ] (⚠️ AC5-keyboard residual — FLAGGED, kb-side) after a keyboard-shortcut capture, kb's
      UNCONDITIONAL self-clear (`clearFlash`, bg.js:131-139) blanks the active tab's badge at
      teardown — on **success** too, not just error — so the count re-appears only on the next
      wake-reconcile. Conflicts with AC5 + the keyboard-path live-count / steady-state-after-
      flash E2Es; needs a GUARDED kb self-clear (kb-side). Escalated to team-lead.
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

- (Option (c): NO `flashCleared`/seam unit case — kb writes no `flashCleared`; the post-flash
  re-assert is covered by the existing `reportCountChanged` + wake-reconcile / `droppedTick`
  cases above. The flagged AC5-keyboard residual is a kb-side self-clear fix, not an fe-003
  unit case.)
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
- 2026-06-19 — frontend-architect: badge-flash-shadow contract LOCKED (team-lead relay, seam
  option a, BOSS+kb). Exposed the chrome-free top-level `__snapdeckReassertActionBadge(tabId)`
  re-assert seam (error-case complement to the tick; AC10-safe via the active-tab SSOT path)
  + `reassertSeam_repaintsTabFromGetState` unit case. Rewrote Part 2 to the seam-based
  reconcile, **resolved the badge-flash shadow as SOLVED** (Cross-team item; supersedes the
  placeholder + "Known limitation"), removed the now-obsolete `text:null` green/gray
  fall-through (kb no longer uses the global badge). `moduleLoadsClean` preserved (seam
  assignment is chrome-free).
- 2026-06-19 — frontend-architect: badge-flash defect SETTLED as **seam (b)** (team-lead
  relay, anchored to kb's shipping `flashCleared` write — ends the seam oscillation). Removed
  the withdrawn seam-(a) `globalThis.__snapdeckReassertActionBadge` + its unit case; ADDED the
  idempotent `flashCleared` branch on the existing `storage.session.onChanged` listener
  (re-assert the carried `tabId` from the SSOT; active-tab/AC10-clean) +
  `flashCleared_reassertsTabFromGetState` unit case; #3 = SOLVED / gap-CLOSED. Kept the
  `reportCountChanged` branch + wake-reconcile + cold-start. Verified green/gray paint explicit
  per-`tabId` empty (fe-001 `text:""`), no reliance on kb's dropped global badge.
  `moduleLoadsClean` preserved (no new top-level `chrome.*`).
- 2026-06-19 — frontend-architect: badge-flash defect re-SETTLED as **option (c) — NO seam**
  (team-lead relay, kb SHIPPED (c)). Reverted BOTH seams: removed the `globalThis` fn AND the
  `flashCleared` `onChanged` branch + their unit cases; fe-003 is back to its pre-saga design
  (wake-reconcile + single `reportCountChanged` branch). #3 = SOLVED kb-side. **Flagged an
  AC5-keyboard residual:** kb's shipped `clearFlash` (bg.js:131-139) is UNCONDITIONAL, so it
  blanks the keyboard-**success** count after the `✓` teardown (not error-only) → conflicts
  with the keyboard-path live-count + steady-state-after-flash E2Es; recommended a GUARDED kb
  self-clear (kb-side). Escalated to team-lead; pending reconciliation before STORIES_LOCKED.

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

## Cross-team item — badge-flash shadow (SOLVED kb-side, option (c)) + ⚠️ AC5-keyboard residual FLAGGED

### 2026-06-19 — team-lead relay (BOSS-ruled SOLVE, option (c) — NO seam)

**SOLVED kb-side (option (c) — no cross-feature seam).** kb makes its `!`/`✓` capture flash
per-`tabId` + drops the destructive global pre-clear (`defect-badge-flash-shadow`, BOSS-ruled
SOLVE, lands the same Wave-1 PR) → the flash is no longer shadowed by this feature's orange
count badge. fe-003 keeps ONLY its existing wake-reconcile + `reportCountChanged` branch (NO
seam, NO `flashCleared` branch, NO `globalThis` fn). No w2 forward-flag. (Supersedes the prior
placeholder, the Part-2 "Known limitation", and the withdrawn seam-(a)/seam-(b) approaches.)

**⚠️ AC5-keyboard residual — FLAGGED to team-lead (kb-side fix needed before STORIES_LOCKED).**
Verified against kb's shipped (c) code: `clearFlash(tabId)` (`background.js:131-139`) is
UNCONDITIONAL — `setBadgeText({tabId, text:""})` — and `scheduleFlashClear` (`:166-174`) runs
it on BOTH the success (2 s) and error (4 s) timeouts. On the keyboard-shortcut **success**
path the `reportCountChanged` tick paints orange `N+1` at ~capture time, kb's `✓` overwrites
it, and kb's +2 s `clearFlash` then blanks the tab to empty — so the orange count is GONE until
the next wake-reconcile, **not just on the error path**. This conflicts with **AC5** ("live
count … no tab switch") and the **"Live increment on the keyboard-shortcut path"** +
**"steady-state-after-flash"** E2Es (which assert the badge shows the count after the `✓`
resets, no tab switch). fe-003 cannot fix this alone (no post-flash signal under (c) — that is
what the seam provided). **Recommended fix (kb-side, keeps fe-003 no-seam):** make kb's
`clearFlash` GUARDED — clear only if the tab's badge still shows kb's own `✓`/`!`
(`getBadgeText({tabId})` check) — so a tick-painted count is preserved and only a genuine error
flash clears to empty (making the "error-only cosmetic residual" framing actually true).
Alternatively re-adopt seam-(b). **Pending team-lead/BOSS reconciliation.**
