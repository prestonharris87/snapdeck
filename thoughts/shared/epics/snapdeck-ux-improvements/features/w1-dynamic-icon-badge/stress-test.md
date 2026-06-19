---
type: stress-test
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
written_at: 2026-06-19T20:30:00Z
contrarian_run_id: run-20260619-150619-36719
findings_count:
  info: 2
  concern: 3
  block: 0
---

# Phase 5.5 stress-test — Dynamic per-tab toolbar icon + badge

**Verdict: no `block`.** This is a well-negotiated feature: three substantive FE stories
with verified seams, three clean peer-confirmed sentinels (be/db/do), and a BOSS-coordinated
frozen-contract boundary that the stories respect. Findings are 3 `concern` (each an
acknowledge-or-cheap-mitigate) + 2 `info`. Method: every "existing X does Y" claim that
informed a finding was checked against live `extension/background.js` (commit `6512a12`) and
the three frozen `extension/background*.test.mjs` harnesses on disk.

## Top three cross-cutting challenges

1. **Re-entrant `refreshActiveTab` with no single-flight → redundant `/resolve` probe storms.**
   [concern] `refreshActiveTab()` is async and driven from four overlapping sources
   (`onActivated`, `onUpdated` loading+complete, the fe-003 tick consumer, and the fe-003
   cold-start re-derive that runs on *every* SW wake). On a fresh localhost navigation the
   cache-bust + concurrent derives both miss the `chrome.storage.session` cache and both call
   `findController()` (up to `CONTROLLER_TRIES = 40` fetches each, `background.js:97-109`) →
   up to ~80 `/resolve` fetches for an unowned localhost port, and the "exactly one probe"
   E2E is a single-event-harness artifact that won't hold in the real browser. Touches:
   **STORY-fe-002** (Finding 1), amplified by **STORY-fe-003** (cold-start re-derive on every
   wake). Acknowledge as bounded, or add a per-port single-flight promise map.

2. **Lossy-tick "self-heals at the next wake" has an idle-dormant-SW blind spot.** [concern]
   The only realistic tick drop is SW-teardown-coupled (un-awaited `storage.session.set` at
   `background.js:55`); the cold-start re-derive that heals it only runs on the next SW wake,
   and an MV3 SW wakes only on an event. A user who captures and then idles on the toolbar
   (no tab switch / reload / popup) gets no wake → the badge under-counts until the next
   interaction. Bounded, low-consequence, and within scope's best-effort posture, but the
   design language + the `droppedTick_wakeReconcilesFromGetState` test claim more coverage
   than exists. Touches: **STORY-fe-003** (Finding 1). Truth-in-labeling fix → `## Acknowledged Risk`.

3. **Orange-tab capture errors are silent — the released global `!` flash is masked by the
   tab-specific count badge.** [concern] Chrome's tab-specific badge shadows the global badge,
   so on an orange tab the released `runCaptureCommand()` `!` error flash (`background.js:140-156`)
   never shows; the user gets no failure signal beyond "count didn't increment." Visible
   degradation of released kb error feedback on tabs with unsaved screenshots. Already noted
   in-story as a known limitation; this pass recommends elevating it to a formal
   `## Acknowledged Risk` with PO sign-off (the only real fix is a BOSS-escalated released-code
   defect, not an in-feature edit). Touches: **STORY-fe-003** (Finding 2).

## Detailed findings (per-story `## Contrarian Findings` blocks)

- **STORY-fe-002** — Finding 1 [concern]: no single-flight on `resolvePortCached` →
  redundant concurrent `/resolve` fan-outs + false-confidence "exactly one probe" E2E.
  Finding 2 [info]: defensive-registration guard depth asymmetric — `chrome.tabs.onActivated?.`
  assumes `chrome.tabs` exists (clean today; deepen to `chrome.tabs?.` for parity with fe-003).
  Finding 3 [info]: multi-window `{currentWindow:true}` + no `windows.onFocusChanged` →
  non-focused windows go stale (verified self-consistent; explicitly in scope's out-of-scope clause).
- **STORY-fe-003** — Finding 1 [concern]: "self-heals at the next wake" overstates coverage
  (idle dormant SW has no wake to heal a dropped tick). Finding 2 [concern]: orange-tab
  capture errors silent (released `!` flash masked by tab-specific badge).
- **STORY-fe-001** — no finding. The `OffscreenCanvas` + `source-in` tint render primitive
  is a known-good MV3-service-worker pattern; `setIcon`/`setBadgeText` dispatch is per-`tabId`
  and never touches the global namespace (asserted by `applyIconState_neverSetsGlobalBadge`);
  the SSOT-re-read in fe-002 makes out-of-order async paints self-correcting. No real concern.
- **STORY-be-001 / STORY-db-001 / STORY-do-001** — no findings. Clean sentinels, each
  peer-confirmed with the frontend-architect. AC13 (no new permission) independently verified
  against the live `extension/manifest.json` (`storage.session` is covered by the granted
  `storage`; `OffscreenCanvas` needs no `offscreen` permission; `runtime.getURL` on packaged
  assets is same-origin → no `web_accessible_resources`).

## Verified-and-dismissed (recorded so PO can trust the pass — not findings)

- **Frozen-harness tolerance (the team-lead's #1 hypothesis): CONFIRMED SAFE.** The merged
  `background.js` loads clean under all three frozen mocks. The mocks lack `tabs.onActivated`/
  `onUpdated`/`storage`/`action.setIcon` (verified in `background.reports.test.mjs:85-117`,
  and `chrome.tabs` present in all three at reports:97 / shortcuts:112 / editormodel:89), and
  the double-`?.` guards short-circuit: fe-002 listeners no-op (`chrome.tabs` exists,
  `.onActivated` undefined), fe-003's `chrome.storage?.session?.onChanged?.` and the cold-start
  `if (chrome.storage?.session && chrome.action?.setIcon)` short-circuit on the absent `storage`.
  The w0 producer's `chrome.storage?.session?.set?.` (`:55`) likewise no-ops. (Residual guard-
  depth nit captured as fe-002 Finding 2.)
- **Deceptive-host parity: CONFIRMED.** `currentTargetPort()` regex-gates
  (`/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/`, `background.js:81`) *before* `portOfUrl`, so
  `http://localhost.evil.com/` → `null` → gray, no probe — matching the released w0 write/read
  gate and `addScreenshot`'s identical guard (`:208`). One source of truth (AC10) holds.
- **`storage.session` key collision / self-trigger loop: CONFIRMED HANDLED.** fe-003's
  `onChanged` listener strictly key-filters `changes.reportCountChanged` and ignores fe-002's
  `resolve:<port>` cache writes (distinct keys, same area; unit case
  `onChanged_keyFiltered_resolveCacheWriteNoRederive`). No loop.
- **Released-code boundary: CONFIRMED.** No story edits `runCaptureCommand()`, `addScreenshot`,
  `saveReport`, `CLEAR_REPORT`, `emitReportCountChanged`, the released `onMessage`/`onCommand`
  listeners, the controller, or IndexedDB record shape. The consumer lands on top of the frozen
  emit (3 sites verified: `:239`, `:271`, `:195`).
- **Same-ms `ts` collision: BENIGN.** A byte-identical `{port,count,ts}` payload (no `onChanged`
  fire) requires the same count at the same ms, which implies the same target state — so a
  missed repaint is to an already-correct state. Not a drift source. (Distinct from the
  teardown-drop case, which is Finding 1 above.)

## Security note (out of my domain → security-architect Phase 7)

No new security surface introduced; the feature is read-only over released seams and adds no
manifest permission. The deceptive-host parity above is the one place a looser predicate would
have mattered, and it is held by reusing the released gate. Nothing to escalate.

## Story line-citation freshness (feature-level info, not a per-story block)

Several story line-number citations have drifted ~10–50 lines from live `background.js`
(commit `6512a12` inserted `emitReportCountChanged` + comments). E.g. `currentTargetPort()`
cited `:70`/`:73` (actual `:78-83`); `findController()` cited `:89`/`:95` (actual `:97-109`,
`r.json.ok` read at `:103`); `GET_STATE` cited `:167` (actual `:175-180`); `runCaptureCommand()`
cited `:118-163` (actual `:126-171`). Every SEAM exists and behaves exactly as the stories
describe — this is citation freshness, not a design flaw. Engineers should grep by symbol, not
line number, at implement time.
