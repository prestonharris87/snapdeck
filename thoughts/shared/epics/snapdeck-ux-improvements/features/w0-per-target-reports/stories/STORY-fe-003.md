---
type: story
id: STORY-fe-003
name: "Emit storage.session report-count tick at 3 sites"
domain: frontend
parent_feature: w0-per-target-reports
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: released
depends_on: [STORY-fe-001]
diff_estimate: substantive
files_modified:
  - extension/background.js
  - extension/background.emit.test.mjs
files_not_modified:
  - extension/background.reports.test.mjs   # FROZEN released suite (12 fe-001 + 1 LOW-1 + 4 fe-002 = 17 cases) — must stay byte-for-byte green
  - extension/background.shortcuts.test.mjs  # FROZEN released suite (8 cases) — must stay byte-for-byte green
  - extension/popup/popup.js
  - extension/popup/popup.html
  - extension/popup/popup.css
  - extension/content/capture.js
  - extension/content/editor.js
  - extension/content/bridge.js
  - extension/content/overlay.css
  - extension/manifest.json
reuse_patterns:
  - extension/background.js:192-229     # addScreenshot — site 1: the setReport(port,r)+return{ok,count} path
  - extension/background.js:231-262     # saveReport — site 2: the success-POST → clearReport(browserPort) path
  - extension/background.reports.test.mjs:42-145  # node:vm harness + chrome/in-memory-indexedDB stub pattern to MIRROR (do not import) in the new test file
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-add-story
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: Emit storage.session report-count tick at 3 sites

## What we're doing

Add ONE additive, side-channel emission to the MV3 service worker
`extension/background.js`: after each per-port in-progress-report **count
change**, write a `chrome.storage.session` tick describing the new count for
that port. This lets the SEPARATE sibling feature `w1-dynamic-icon-badge`
(different feature/team) drive a live toolbar badge count by listening to
`chrome.storage.session.onChanged` for the `reportCountChanged` key. The
emission is realised through a single DRY helper called at exactly three count-
mutating sites (`addScreenshot`, the successful `saveReport` POST→clear path,
and the `CLEAR_REPORT` message handler). The change is purely additive: every
existing return value and IndexedDB write stays byte-identical, the 25 frozen
released unit cases stay green, and the helper no-ops cleanly when
`chrome.storage` is absent (the unit harnesses' chrome mock has no `storage`
key).

## What it should look like

No screen. The deliverable is internal to `extension/background.js` plus a new
unit-test file. Recommended shape (engineer owns exact tactics):

**The DRY helper** (new top-level `function`, sits with the other helpers):

```js
function emitReportCountChanged(port, count) {
  if (port == null) return;                         // null-port guard (load-bearing — see site 3)
  chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } });
}
```

**The emitted payload** (what `w1-dynamic-icon-badge` will read):

```js
chrome.storage.session.get('reportCountChanged')
// → { reportCountChanged: { port: <int>, count: <int>, ts: <number> } }
```

- `port` — the dev-server port whose report count changed (never `null` on a
  real emit; the helper guard drops `null` before any write).
- `count` — the new `screenshots.length` for that port (`0` on save/clear).
- `ts` — `Date.now()` at emit time, so an identical `{port,count}` re-emit still
  flips the stored value and fires `onChanged` for the consumer.

## Existing behavior baseline

- **Currently — site 1 (`addScreenshot`):** `extension/background.js:192-229` —
  on a successful capture+annotate it derives `port = portOfUrl(tab.url)` at
  `:200` (post-localhost-gate at `:197`, guaranteed non-null here), pushes the
  screenshot, `await setReport(port, r)` at `:227`, then `return { ok: true,
  count: r.screenshots.length }` at `:228`.
- **Currently — site 2 (`saveReport`):** `extension/background.js:231-262` —
  resolves `const browserPort = await currentTargetPort()` at `:236`, POSTs the
  payload, and ONLY inside the success branch `if (res.json && res.json.ok)`
  (`:257`) does `await clearReport(browserPort)` (`:258`) then `return res.json`
  (`:259`). The error/empty/no-controller paths (`:237`, `:239`, `:242-244`,
  `:261`) do NOT clear and must NOT emit.
- **Currently — site 3 (`CLEAR_REPORT` handler):** `extension/background.js:184-186`
  — `await clearReport(await currentTargetPort()); return { ok: true };`.
  `currentTargetPort()` CAN be `null` on a non-target tab, in which case
  `clearReport(null)` is a no-op (the `setReport` null-guard at `:45`) — so a
  clear on a non-target tab must NOT emit a phantom tick.
- **Helpers (released, reused not changed):** `getReport` `:40-43`, `setReport`
  `:44-47` (its own null-guard at `:45` — does NOT cover the new emit call, so
  the helper needs its OWN guard), `clearReport` `:48`, `currentTargetPort`
  `:70-75`, `portOfUrl` `:51-57`.
- **Single message listener:** `chrome.runtime.onMessage.addListener` at
  `:104-107` — the ONLY `onMessage` registration. The frozen reports suite's
  chrome mock captures just the last-registered listener
  (`background.reports.test.mjs:88`), so a SECOND `onMessage.addListener` would
  hijack released `GET_STATE`/`SET_NOTE`/`CLEAR_REPORT` and hang those suites.
- **`SET_NOTE` handler:** `:173-179` — mutates the note only; `screenshots`
  length is unchanged, so it must NOT emit.
- **Dispatch path / call graph:** capture / save / clear → `setReport` /
  `clearReport` (IndexedDB `kv` write) → **[NEW]** `emitReportCountChanged(port,
  count)` → `chrome.storage.session.set({ reportCountChanged })` →
  *(cross-feature, w1-dynamic-icon-badge)* a `chrome.storage.session.onChanged`
  listener keyed on `reportCountChanged` repaints the toolbar badge.
- **No-regression assertion:** `addScreenshot` / `saveReport` return values and
  the IndexedDB report write are **byte-identical** to released behavior; the
  single `onMessage` listener is preserved; the 25 frozen cases in
  `background.reports.test.mjs` (17) and `background.shortcuts.test.mjs` (8) stay
  byte-for-byte green; `SET_NOTE` emits nothing.
- **Explicitly changing:** add the `emitReportCountChanged` helper + 3 call
  sites that fire a `chrome.storage.session` tick on report-count change.
- **Verified:** 2026-06-19 — architect opened `extension/background.js` and both
  frozen test files this run.

## How we're doing it (implementation notes)

Touch only `extension/background.js` (plus the new test file). Single UI
convention → `frontend_lane: N/A`; this is the MV3 service worker, not a popup
render. No emojis / no symbol-icon characters / no inline SVG are in play (no UI
surface). Do NOT add a manifest change — `chrome.storage.session` needs no new
permission for a service worker.

**1. Add the DRY helper** alongside the other top-level helpers (e.g. near
`clearReport`). It MUST:
- guard `if (port == null) return;` as its FIRST statement (load-bearing for
  site 3 — drops the non-target clear with no phantom emit), AND
- write through optional chaining exactly:
  `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })`.

**2. Call site 1 — `addScreenshot` (`:227-228`):** AFTER `await setReport(port,
r)` resolves and BEFORE `return { ok: true, count }`, call
`emitReportCountChanged(port, r.screenshots.length)`. `port` is the local from
`portOfUrl(tab.url)` (`:200`), already past the localhost gate (non-null).

**3. Call site 2 — `saveReport` (`:258-259`):** INSIDE the existing `if
(res.json && res.json.ok)` block ONLY, AFTER `await clearReport(browserPort)`
and before `return res.json`, call `emitReportCountChanged(browserPort, 0)`.
First arg is `browserPort` (the local var name here — NOT `port`); count is `0`.
Do NOT emit on the error / empty-report / no-controller paths.

**4. Call site 3 — `CLEAR_REPORT` handler (`:184-186`):** capture the port in a
local first, then clear and emit:
```js
const port = await currentTargetPort();
await clearReport(port);
emitReportCountChanged(port, 0);
return { ok: true };
```
Rely on the helper's null-guard so a clear on a non-target tab (where
`currentTargetPort()` is `null`) does NOT emit.

**The 4 hard invariants (these ARE the acceptance criteria):**
1. **Null-port guard in the helper** — returns early when `port == null`
   (load-bearing at site 3; no phantom emit on a no-op clear).
2. **Optional-chaining no-op** — `chrome.storage?.session?.set?.(…)` must
   silently no-op when `chrome.storage` is absent, so the module still LOADS and
   the emit does nothing under the frozen vm harnesses (whose chrome mock has no
   `storage` key). Keeps all 25 frozen cases byte-for-byte green.
3. **Non-breaking** — `addScreenshot` / `saveReport` return values and the IDB
   report write are byte-identical to released behavior. Do NOT add a second
   `chrome.runtime.onMessage.addListener` (it would overwrite the frozen test's
   single-capture mock at `background.reports.test.mjs:88` and hijack released
   `GET_STATE`/`SET_NOTE`/`CLEAR_REPORT`). The emission is `storage.session`
   ONLY — NOT `runtime.sendMessage` (that mechanism was proposed, found broken,
   and superseded).
4. **`SET_NOTE` does NOT change count → NO emit there.**

## How we validate it was done correctly

- [ ] `emitReportCountChanged(port, count)` exists as a top-level helper whose
      FIRST statement is `if (port == null) return;`.
- [ ] The storage write uses optional chaining exactly:
      `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })`
      — no bare `chrome.storage.session.set(...)`.
- [ ] Exactly THREE call sites (`addScreenshot`, `saveReport` success branch,
      `CLEAR_REPORT` handler); no emit in `SET_NOTE`, `GET_STATE`, or the
      error/empty/no-controller `saveReport` paths.
- [ ] Site 1 emits `(port, r.screenshots.length)` after `setReport` and before
      `return { ok:true, count }`, using the `portOfUrl(tab.url)` local.
- [ ] Site 2 emits `(browserPort, 0)` inside `if (res.json && res.json.ok)`
      after `clearReport(browserPort)` — first arg is `browserPort`, not `port`.
- [ ] None of `saveReport`'s early-return branches emit — `saveReport_failedPost_noEmit`,
      `saveReport_noController_noEmit`, AND `saveReport_emptyReport_noEmit` all
      assert NO tick captured (Contrarian Finding 1, PO PROMOTE_TO_AC: hardens
      "only the success branch emits").
- [ ] Site 3 captures `currentTargetPort()` into a local, passes it to BOTH
      `clearReport` and `emitReportCountChanged`, and relies on the helper guard
      (a non-target clear emits nothing).
- [ ] No second `chrome.runtime.onMessage.addListener` was added.
- [ ] `node --test extension/*.test.mjs` passes — all 25 frozen cases
      (`background.reports.test.mjs` + `background.shortcuts.test.mjs`) plus the
      new `background.emit.test.mjs` cases are green.
- [ ] The two frozen test files are unchanged (git diff shows no edits to
      `background.reports.test.mjs` / `background.shortcuts.test.mjs`).

## Motion contract

n/a — service-worker `chrome.storage.session` emission; no UI render, no
animation. (The consuming toolbar-badge motion, if any, is owned by the separate
`w1-dynamic-icon-badge` feature.)

## Unit tests

New file `extension/background.emit.test.mjs` (zero-dep `node --test`,
`node:test` + `node:assert/strict`, ESM). MIRROR — do NOT import — the node:vm +
hand-written chrome / in-memory `indexedDB` stub harness from
`background.reports.test.mjs:42-145`. Run via `node --test extension/*.test.mjs`
(cumulative) — the distinct filename avoids the dir-level collision.

**Two harness variants are required.** Build TWO vm contexts (or reset between
groups): group (a)'s chrome mock includes `storage.session.set` that CAPTURES
its argument; group (b)'s chrome mock OMITS `storage` entirely (exactly like the
frozen mocks) to prove the optional-chain no-op. For group (a) site-1/site-2
paths, the new mock must additionally stub `chrome.tabs.captureVisibleTab` and
`chrome.tabs.sendMessage` to RESOLVE (the frozen reports mock rejects them), and
stub `fetch` so `findController`'s `/resolve?port=` probe and the `/report/save`
POST both resolve `{ ok: true, ... }`.

**(a) The tick fires `{ port, count, ts }` at all 3 sites:**

- `extension/background.emit.test.mjs` — `addScreenshot_success_emitsTick` —
  drive a successful capture+annotate on `localhost:5101` (captureVisibleTab +
  sendMessage resolve a fake `resp` with `meta`/`original`/`annotated`); assert
  the captured tick is `{ reportCountChanged: { port: 5101, count: 1, ts } }` —
  `port===5101`, `count===1`, `typeof ts === 'number'`.
- `extension/background.emit.test.mjs` — `saveReport_successfulPost_emitsZeroTick`
  — seed `report:5101` with one screenshot, stub `fetch` so `/resolve` finds a
  controller and `/report/save` returns `{ ok: true }`; assert the captured tick
  is `{ port: 5101, count: 0, ts:<number> }`.
- `extension/background.emit.test.mjs` — `clearReport_handler_emitsZeroTick` —
  send `{ type: 'CLEAR_REPORT' }` on `localhost:5101`; assert the captured tick
  is `{ port: 5101, count: 0, ts:<number> }`.
- `extension/background.emit.test.mjs` — `clearReport_handler_nonTargetTab_noEmit`
  — send `CLEAR_REPORT` on `about:blank` (→ `currentTargetPort()` null); assert
  NO tick was captured (proves the site-3 null-guard; no phantom emit).
- `extension/background.emit.test.mjs` — `setNote_doesNotEmit` — send
  `{ type: 'SET_NOTE', note: 'x' }`; assert NO tick captured (invariant 4).
- `extension/background.emit.test.mjs` — `addScreenshot_cancelled_noEmit` —
  sendMessage resolves `{ cancelled: true }`; `addScreenshot` returns
  `{ cancelled: true }` before `setReport`; assert NO tick captured.
- `extension/background.emit.test.mjs` — `saveReport_failedPost_noEmit` — stub
  `fetch` so `/report/save` returns a non-ok json; `saveReport` returns an
  error and does NOT clear; assert NO tick captured (only the success branch
  emits).
- `extension/background.emit.test.mjs` — `saveReport_noController_noEmit`
  (Contrarian Finding 1, PO PROMOTE_TO_AC) — seed `report:5101` with one
  screenshot, stub `fetch` so EVERY `/resolve?port=` probe fails (rejects /
  non-ok) → `findController` returns null → early return at `background.js:243`;
  assert `saveReport` returns the no-controller error, `kv['report:5101']` still
  holds its 1 screenshot (NOT cleared), and NO tick was captured.
- `extension/background.emit.test.mjs` — `saveReport_emptyReport_noEmit`
  (Contrarian Finding 1, PO PROMOTE_TO_AC) — with `report:5101` empty
  (`{ note:'', screenshots:[] }`) and `currentTargetPort()` resolving `5101`,
  `saveReport` returns the empty-report error at `background.js:239` BEFORE any
  controller probe; assert NO tick was captured (the early-return branches above
  the success `if` never emit).

**(b) `chrome.storage` ABSENT → return values + IDB write unaffected (no throw,
byte-identical):**

- `extension/background.emit.test.mjs` — `moduleLoads_withoutStorageKey` — load
  `background.js` into a vm context whose chrome mock omits `storage`; assert the
  `onMessage` listener was still registered (module loaded; invariant 2 at load
  time).
- `extension/background.emit.test.mjs` —
  `storageAbsent_addScreenshot_returnsOkCount_noThrow` — with no `chrome.storage`,
  a successful `addScreenshot` resolves `{ ok: true, count: 1 }` and `kv['report:5101']`
  has 1 screenshot; no throw.
- `extension/background.emit.test.mjs` —
  `storageAbsent_saveReport_clearsAndReturnsJson_noThrow` — with no
  `chrome.storage`, the success POST path returns the server json AND clears the
  record (`kv['report:5101']` reset to `{ note:'', screenshots:[] }`); no throw.
- `extension/background.emit.test.mjs` —
  `storageAbsent_clearReport_returnsOk_noThrow` — with no `chrome.storage`,
  `CLEAR_REPORT` returns `{ ok: true }` and the record is cleared; no throw.

## Dependencies

- `STORY-fe-001` — establishes the per-port report store (`getReport` /
  `setReport` / `clearReport` keyed `report:<port>`) and the localhost-gated
  `currentTargetPort()` / `portOfUrl()` resolution this emission reads. (fe-002's
  additive `GET_STATE.port` field is NOT a dependency of the emission.)

## Revisions

This story IS the post-release additive revision to the already-released
`w0-per-target-reports` feature (fe-001 + fe-002 merged to master). It is:

- **Purely additive** — no released return value, IDB write, or message contract
  changes; the helper + 3 one-line call sites only ADD a side-channel write.
- **`storage.session`-only** — NOT `runtime.sendMessage` and NOT a second
  `onMessage` listener (both superseded/rejected: a 2nd `onMessage` listener
  hangs the frozen reports suite per `background.reports.test.mjs:88`).
- **Frozen-test-tolerant** — the optional-chained write no-ops under the frozen
  vm harnesses (their chrome mock has no `storage` key), so all 25 frozen cases
  stay byte-for-byte green. New cases live in a NEW file
  (`extension/background.emit.test.mjs`); the two frozen test files are never
  touched.
- **Cross-feature contract (BOSS-ratified, channel-locked):** the emitted tick
  shape is `chrome.storage.session` key `reportCountChanged` =
  `{ port: <int>, count: <int>, ts: <number(Date.now())> }`, written on every
  report-count change at the 3 sites above. Do NOT renegotiate this shape — it is
  locked verbatim.
- **Serialization with `w1-dynamic-icon-badge`:** this emission lands and freezes
  FIRST (here, under `w0-per-target-reports`); the consumer
  (`w1-dynamic-icon-badge` STORY-fe-003) then builds on top via a key-filtered
  `chrome.storage.session.onChanged` listener (`?.`-guarded). That consumer is a
  separate feature/team and is out of scope for this story.

**PO arbitration (2026-06-19, add-story arbitrate mode).** Dispositioned the
`## Contrarian Findings` (0 block / 2 concern / 1 note):
- **Finding 1 → PROMOTE_TO_AC** — added `saveReport_noController_noEmit` +
  `saveReport_emptyReport_noEmit` to `## Unit tests` (a) and a matching
  `## How we validate` checklist line, hardening invariant "only the success
  branch emits" across 3 of the 4 non-emit `saveReport` branches.
- **Findings 2 & 3 → ACCEPT_AS_RECOMMENDATION** — recorded in the new
  `## Consumer note` (best-effort/lossy stream → consumer reconciles via released
  `GET_STATE`; non-exclusive `storage.session` area + ms-resolution `ts` blind
  spot). No code/contract change.
Baseline `## Existing behavior baseline` file:line citations re-verified against
`extension/background.js` this run — all accurate, no spot-fix. The locked
`storage.session` mechanism + `{ port, count, ts }` payload were NOT
re-litigated. `depends_on: [STORY-fe-001]` confirmed against the released
per-port store + localhost-gated resolution; no peer `## Revisions` block needed
(no in-feature cross-domain contract change). status: pending → approved.

## Consumer note

The `chrome.storage.session` `reportCountChanged` tick is **best-effort, not a
lossless log** (Contrarian Findings 2 & 3, PO ACCEPT_AS_RECOMMENDATION):

- **Lossy on suspension / session reset.** The helper's `.set()` is
  fire-and-forget (un-awaited by design, so released return timing stays
  decoupled from the storage write). A tick can be dropped if the MV3 service
  worker is torn down between the synchronous `.set()` and the async write
  landing, and the entire `storage.session` area is wiped when the browser
  session ends / the SW backing store resets. The consumer
  (`w1-dynamic-icon-badge`) MUST reconcile against the released `GET_STATE → {
  count, port }` on a known wake point (popup-open / SW-wake) and MUST NOT treat
  `storage.session.onChanged` as a complete count log, or the badge silently
  drifts.
- **Non-exclusive area + ms-resolution `ts`.** The `reportCountChanged` key
  shares the `storage.session` area with w1-fe-002's `/resolve` cache (different
  key; safe today — w0 only WRITES this one tiny key, never adds an `onChanged`
  listener — but the area is not exclusive). `ts: Date.now()` is millisecond
  resolution, so two count-changes inside one millisecond could produce a
  byte-identical payload that `onChanged` is not guaranteed to fire on —
  realistically rare (capture needs the annotation UI; save/clear are distinct
  user actions) and absorbed by the reconciliation above. The contract is locked;
  this is recorded, not a request to swap `ts` for a monotonic counter.

## History

- 2026-06-19 — created by frontend-architect (add-story mode; effort=2, depends
  on STORY-fe-001). Purely additive `chrome.storage.session` report-count
  emission at 3 sites; status left `pending` for team-lead PO arbitrate pass.
- 2026-06-19 — implemented (commit: 6512a12). Gate: `node --test extension/background*.test.mjs` — 43/43 pass (frozen: reports=17 + shortcuts=8 + editormodel=5; new emit=13). Manual verification deferred — pure service-worker storage.session side-channel with no UI surface; no browser smoke required (no popup/DOM change; zero UI-touching code modified).
2026-06-19T22:20:33Z — BOSS: status: 'validated' -> 'released' (Emission shipped in Wave-1 PR #2 (8c340a6))

## Engineer Notes

- Added `emitReportCountChanged(port, count)` helper immediately after `clearReport` (lines 50-56 in the updated file). The optional-chain `chrome.storage?.session?.set?.(...)` is the key invariant: the 4 frozen vm harnesses have no `storage` key on their chrome mock, so the helper silently no-ops and all 25+ frozen cases stay green.
- Site 3 (`CLEAR_REPORT` handler) was the trickiest: changed the one-liner `await clearReport(await currentTargetPort())` to capture port into a local first, so we can pass it to both `clearReport` and `emitReportCountChanged`. The helper's null-port guard then absorbs non-target-tab clears without emitting a phantom tick — verified by `clearReport_handler_nonTargetTab_noEmit`.
- The test file required `toPlain()` (JSON round-trip) before `deepStrictEqual` on any value returned through the vm boundary — the frozen harnesses document this pattern at line 151. I initially missed this on 5 assertions and caught it on first test run (iteration 1 → fixed → clean).
- `background*.test.mjs` globbed 4 files, not 3 (there is also a `background.editormodel.test.mjs` with 5 cases that the story didn't call out). All pass.
- No second `chrome.runtime.onMessage.addListener` was added. No frozen files were touched.

## Contrarian Findings

_Single-story (add-story mode) stress-test, 2026-06-19. The locked contract
(`storage.session` mechanism + `{port,count,ts}` payload) was NOT re-litigated;
these probe only risks that survive WITHIN the locked design into
implement/runtime. **0 block, 2 concern, 1 note.**_

**Dismissed after reading the code (verified-to-dismiss):**
- *2nd-listener / missing-storage-key frozen breaks* — already enumerated by the
  story and confirmed: the shortcuts suite (`background.shortcuts.test.mjs`) sets
  `globalThis.chrome` with NO `storage` key, so `chrome.storage?.session?.set?.()`
  short-circuits to a no-op; its full-success `addScreenshot` cases
  (`:235`, `:299`) reach site 1 but the optional chain no-ops cleanly. ✓
- *Reports suite reaching an emit site* — `background.reports.test.mjs` drives
  `addScreenshot` only on the deceptive-host case (returns BEFORE `setReport`, no
  emit), exercises `clearReport` via the **helper directly** (not the CLEAR_REPORT
  handler where site 3 lives), and never sends `SAVE_REPORT`/`CLEAR_REPORT` via the
  handler. No emit site is reached; even if it were, its vm mock has no `storage`. ✓
- *Cumulative `node --test extension/*.test.mjs` cross-file contamination* — node's
  test runner isolates each file in its own process; the new file MIRRORS the vm
  harness (own sandbox, own `fetch`/`tabs` stubs) so it can't collide with the
  shortcuts file's `globalThis` pollution or the reports file's rejecting `fetch`. ✓

### Finding 1 — `saveReport` no-emit is tested on only 1 of its 4 non-emit branches

**Severity:** concern
**Mechanism:** The site-2 emit lives INSIDE the nested `if (res.json && res.json.ok)`
block (`background.js:257-259`), and the story correctly forbids emitting on the
no-port (`:237`), empty-report (`:239`), no-controller (`:242-244`), and failed-POST
(`:261`) paths. But the proposed `## Unit tests` set covers only
`saveReport_failedPost_noEmit`. The no-controller and empty-report paths are
distinct EARLY returns above the `if` block — exactly where a future refactor that
hoists the emit (e.g. "emit right after we know the port") would land. Such a
regression fires a phantom `{count:0}` tick on a save that did NOT clear the
report, so the w1 badge would read 0 while the report still holds N screenshots —
silent, and uncaught by the current test list. This is the highest-value gap (test
coverage that no test actually owns is the recurring add-story catch).
**Recommendation:** mitigate-via-one-extra-test — add `saveReport_noController_noEmit`
(stub `fetch` so every `/resolve?port=` probe fails → `findController` returns null
→ early return at `:243`; assert NO tick captured). Optionally also
`saveReport_emptyReport_noEmit`. No design change; one (maybe two) test cases.
**PO disposition:** PROMOTE_TO_AC. Cheap, real regression guard for invariant "only the success branch emits" — added BOTH `saveReport_noController_noEmit` and `saveReport_emptyReport_noEmit` to `## Unit tests` (a) plus a matching `## How we validate` checklist line; covers 3 of the 4 non-emit branches (failed-POST already had a case).

### Finding 2 — the tick stream is best-effort/lossy; the consumer must reconcile, not trust it as a complete count log

**Severity:** concern
**Mechanism:** The helper's `.set()` is intentionally fire-and-forget (un-awaited —
correct, since awaiting would couple released return timing to a storage write).
But that means (a) if the MV3 service worker is torn down after the synchronous
`.set()` is issued but before the async write lands, the tick is lost, and (b)
`chrome.storage.session` is wiped entirely when the browser session ends / the SW's
backing store resets — so on a cold SW wake the last tick is simply gone. The w1
badge consumer therefore CANNOT treat the `onChanged` stream as a lossless log of
every count change; it needs an independent reconciliation read (the released
`GET_STATE` already returns `{count, port}` — popup-open / SW-wake reconciliation)
or the badge silently drifts. This assumption is invisible in the current story and
would otherwise only surface when the consumer team debugs a stale badge.
**Recommendation:** acknowledge — add a one-line story note (and it carries into the
serialized `w1-dynamic-icon-badge` consumer) stating the tick stream is
**best-effort**: ticks may be dropped on SW suspension / session reset, so the
consumer must reconcile via `GET_STATE` on a known wake point. No code change in
this story.
**PO disposition:** ACCEPT_AS_RECOMMENDATION. Real consumer-side assumption, no code change in this (producer) story — recorded in the new `## Consumer note`; team-lead relays the reconcile-via-`GET_STATE` directive to the `w1-dynamic-icon-badge` consumer over the channel.

### Finding 3 — shared `storage.session` area is non-exclusive, and `ts:Date.now()` has a same-millisecond identical-payload blind spot

**Severity:** note
**Mechanism:** Two small forward-looking couplings worth recording, neither
blocking: **(a)** this `reportCountChanged` key shares the `storage.session` area
with w1-fe-002's `/resolve` cache (different key). Today that's safe (single tiny
overwritten key, well under quota; w0 only WRITES, never adds an `onChanged`
listener, so no self-trigger). But it means the area is NOT exclusive — any future
`chrome.storage.session.setAccessLevel(...)` to expose it to content scripts, or a
w0-side `onChanged` listener, would also see the cache's cross-key traffic. **(b)**
The story's stated purpose for `ts` is "force `onChanged` on an identical
`{port,count}` re-emit" — but `Date.now()` is millisecond-resolution, so two
count-changes inside the same millisecond produce a byte-identical payload, and
`storage.onChanged` is not guaranteed to fire when the new value deep-equals the
old. Realistically rare (capture requires the annotation UI; save→clear are
distinct user actions) and absorbed by Finding 2's reconciliation, so no action —
but the `ts` mitigation is imperfect, not airtight. The contract is locked, so this
is recorded, not a request to swap `ts` for a monotonic counter.
**Recommendation:** acknowledge — fold both into the same story note as Finding 2.
No code or contract change.
**PO disposition:** ACCEPT_AS_RECOMMENDATION. Forward-looking couplings only, absorbed by Finding 2's reconciliation; folded into the same `## Consumer note`. Contract is locked — `ts` is not swapped for a monotonic counter; recorded, not actioned.

## Validation

- 2026-06-19 — orchestrator (team-lead) — STORY-fe-003 **validated** (status: in-progress → validated). Two isolated background checkers, both green:
  - **frontend-validator → validated** — all 10 ACs pass: helper + null-guard (`background.js:53-56`), exact optional-chain write (`:55`), 3 sites (`:239`/`:271`/`:195`), SET_NOTE + saveReport error paths no-emit, single `onMessage` (`:112`), frozen files unchanged. findings: none.
  - **honesty-check-validator → passed** — frozen suites (`reports`/`shortcuts`/`editormodel`) untouched (0 bytes in diff), no `.skip`/`.todo`/vacuous assertions; group-(a) stubs a real `storage.session.set` capture (emit genuinely exercised), group-(b) proves the optional-chain no-op via `deepStrictEqual` backward-compat checks.
  - **Gate:** `node --test extension/background*.test.mjs` → **43/43 pass, 0 skipped** (reports 17 + shortcuts 8 + editormodel 5 + new emit 13). Independently re-run by the team-lead.
  - **Commit:** `6512a12`. Verdict JSONs under `.claude/state/checker-verdicts/feat-w0-per-target-reports/`.
  - **BOSS-mode freeze:** feature stays `in-progress`/frozen; BOSS's wave-PR merge flips STORY-fe-003 + feature.md → `released` (team-lead does not self-stamp released).
