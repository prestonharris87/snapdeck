---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
version: 1
written_at: 2026-06-19T00:00:00Z
run_id: run-20260619-150619-36719
sources:
  - features/w1-dynamic-icon-badge/feature.md
  - features/w1-dynamic-icon-badge/scope.md
  - features/w1-dynamic-icon-badge/stories/STORY-fe-001.md
  - features/w1-dynamic-icon-badge/stories/STORY-fe-002.md
  - features/w1-dynamic-icon-badge/stories/STORY-fe-003.md
  - features/w1-dynamic-icon-badge/stories/STORY-be-001.md
  - features/w1-dynamic-icon-badge/stories/STORY-db-001.md
  - features/w1-dynamic-icon-badge/stories/STORY-do-001.md
  - features/w1-dynamic-icon-badge/stress-test.md
  - features/w1-dynamic-icon-badge/conversations/0004-devops-architect-to-frontend-architect-msg.md
  - features/w1-dynamic-icon-badge/conversations/0010-contrarian-architect-to-team-lead-msg.md
  - features/w1-dynamic-icon-badge/conversations/0011-contrarian-architect-to-team-lead-msg.md
---

# Decision memo — Dynamic per-tab toolbar icon + badge

## Summary

This feature turns Snapdeck's static toolbar `action` icon into a per-`tabId` state machine
with three steady states (gray / green / orange+count), consuming the released
`w0-per-target-reports` and `w0-keyboard-shortcuts` contracts read-only. What was non-obvious:
the feature landed on top of two frozen cross-team contracts that required BOSS-coordinated
negotiation rather than in-feature authorship — (1) an additive `reportCountChanged`
`chrome.storage.session` tick emitted by w0-per-target-reports (commit `6512a12`) for
live-count signal, and (2) resolution of a `defect-badge-flash-shadow` (DEF-001) in kb's
`runCaptureCommand()` that shadowed the orange count badge. Planning navigated five
option-oscillations on the flash-reconcile approach (options a→b→c, with an AC5 residual
discovered after option (c) landed) before BOSS's guarded-`clearFlash` ruling (commit
`e87d247`) closed the episode cleanly. The contrarian's probe-storm finding was the one
structural gap in the architects' initial design, promoted by PO to a hard requirement.

## Positions held during planning

### frontend-architect

- **Three-story decomposition:** split render primitives (fe-001), state machine/cache
  (fe-002), live-count trigger + flash reconcile (fe-003) — a "view layer / controller
  layer / event layer" separation that let the contrarian verify seams cleanly.
  (STORY-fe-001/002/003 structure)
- **Programmatic icon generation (Option B):** `OffscreenCanvas` source-in tint of the
  existing logo PNGs, applied via `setIcon({ tabId, imageData })`, in preference to
  pre-rendered PNG variants — independently proposed Option B and converged with
  devops-architect. (conv 0004, STORY-fe-001 § How we're doing it)
- **`storage.session.onChanged` over a second `onMessage` listener** for the live-count
  trigger: a second `onMessage` listener would break the released frozen test mocks'
  single-capture pattern (`background.reports.test.mjs:88`). The `storage.session` tick is
  equivalently small on the producer side and harness-safe. (STORY-fe-003 § How we're
  doing it, § History)
- **No-seam reconcile (option c):** after kb's DEF-001 fix landed per-`tabId` + dropped
  the global pre-clear, reverted both previously-proposed seams (`globalThis` fn and
  `flashCleared` branch), keeping fe-003's design at the pre-saga wake-reconcile +
  `reportCountChanged` branch. (STORY-fe-003 § History — last two entries)
- **AC5 residual flag:** after option (c) shipped, traced kb's unconditional `clearFlash`
  (`background.js:131-139`) and found it blanked the keyboard-success count badge —
  escalated to team-lead with a recommended kb-side guard. (STORY-fe-003 § History,
  § Cross-team item)
- **Persona alignment:** the architect held the released-code boundary strictly across
  every flash-reconcile oscillation and escalated rather than editing released lines,
  consistent with its `DEFAULT_STANCE`.

### devops-architect

- **Recommended Option B** (programmatic icon generation) over Option A (PNG variants)
  for lower blast radius: colors anchored to tokens in a reviewable text diff vs. 9 opaque
  binary PNGs; zero file churn on the epic branch. (conv 0004, STORY-do-001)
- **Confirmed AC13 no-new-permission** against live `extension/manifest.json`: `action`/
  `tabs`/`storage` (covering `storage.session`) already granted; `OffscreenCanvas` needs
  no `offscreen` permission; `runtime.getURL` on packaged assets is same-origin → no
  `web_accessible_resources`. (conv 0004, STORY-do-001 § Why this is a sentinel)
- **Sentineled cleanly** with `depends_on: []` and explicit observability N/A justification.
  (STORY-do-001)

### backend-architect

- **Confirmed `/resolve` contract stability:** `GET /resolve` returns `{ ok: true }` for
  owner found, no `ok` key otherwise; the released `findController()` reads only `r.json.ok`
  and is correct and stable. (STORY-be-001 § Confirmed contract)
- **Sentineled** with peer-confirmation of `/resolve` stability with frontend-architect.
  (STORY-be-001 § History)

### database-architect

- **Confirmed IndexedDB read-only boundary:** the badge reads the released `report:<port>`
  IndexedDB record via `GET_STATE` path only — no new store, key, record-shape change, or
  version bump. (STORY-db-001 § Why this is a sentinel)
- **Ruled `chrome.storage.session` is FE-owned**, not a DB artifact (mirrors the
  data-model.md ruling for sibling w1 features). (STORY-db-001 § Ownership boundary)
- **Sentineled** after cross-domain confirmation with frontend-architect. (STORY-db-001
  § Cross-domain contract)

### contrarian-architect

- **0 block / 3 concern / 2 info** — no blocking issue, but three structural concerns each
  requiring acknowledge-or-cheap-mitigate. (conv 0011, stress-test.md)
- **Concern 1 (promoted):** no single-flight on `resolvePortCached` → up to ~80 `/resolve`
  fetches for an unowned port on a fresh navigation; the "exactly one probe" E2E is a
  single-event-harness artifact. (STORY-fe-002 § Contrarian Findings Finding 1)
- **Concern 2 (acknowledged):** "self-heals at the next wake" overstates coverage — the
  cold-start re-derive only runs on the next SW event; an idle user gets no wake.
  (STORY-fe-003 § Contrarian Findings Finding 1)
- **Concern 3 (acknowledged):** orange-tab capture errors are silent — Chrome's tab-specific
  badge shadows the global `!` error flash from `runCaptureCommand()`. (STORY-fe-003
  § Contrarian Findings Finding 2)
- **Info 1 (folded in):** `chrome.tabs.onActivated?.` guard depth asymmetric vs. fe-003's
  root-guarded `chrome.storage?.session?.` — one-character fix. (STORY-fe-002 § Contrarian
  Findings Finding 2)
- **Info 2 (accepted):** multi-window `{currentWindow:true}` + no `windows.onFocusChanged`
  — non-focused windows go stale; verified self-consistent and already in scope's out-of-scope
  clause. (STORY-fe-002 § Contrarian Findings Finding 3)
- **Verified-and-dismissed** (not findings): frozen-harness tolerance confirmed safe;
  deceptive-host parity holds; key-filter prevents self-trigger loop; released-code boundary
  clean; same-ms `ts` collision benign. (stress-test.md § Verified-and-dismissed)

### product-owner

- **Promoted Contrarian Finding 1 to a fe-002 hard requirement**: added per-port
  single-flight map (`_resolveInFlight`, keyed by port, cleared in `finally`) as
  non-optional, with a new validation item and unit test; framed AC9 compliance explicitly.
  (STORY-fe-002 § Revisions)
- **Folded in Contrarian Info 1** (guard-depth asymmetry): deepen to `chrome.tabs?.` for
  guard-depth parity — one-character change. (STORY-fe-002 § Revisions)
- **Accepted Contrarian Info 2** (multi-window best-effort) as the existing scope boundary;
  recorded consciously. (STORY-fe-002 § Revisions)
- **Acknowledged Contrarian fe-003 Finding 1** (idle dormant-SW blind spot) as
  truth-in-labeling: qualified the "self-heals at next wake" claim to "at the next wake
  *event*." (STORY-fe-003 § Acknowledged Risk #1)
- **Acknowledged Contrarian fe-003 Finding 2** (orange-tab error silent) with PO sign-off:
  elevated from in-story aside to formal `## Acknowledged Risk`. (STORY-fe-003
  § Acknowledged Risk, implied from Contrarian fe-003 Finding 2 disposition)
- All 6 stories stamped `pending → approved`. (STORY-fe-002/003 § Revisions / Acknowledged
  Risk status lines)

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Icon-asset generation approach | Option A: pre-rendered PNG variants (gray/green/orange × 3 sizes), devops-owned | Option B: programmatic `OffscreenCanvas`/`ImageData` tint, FE-owned | Option B chosen unanimously — lower diff blast-radius, no binary-file churn, no manifest change | conv 0004; STORY-do-001 § Cross-domain contract |
| Live-count trigger mechanism | Second `chrome.runtime.onMessage` listener | `chrome.storage.session.onChanged` (key-filtered `reportCountChanged`) | `onChanged` chosen: a 2nd `onMessage` listener would break released frozen test-mock single-capture pattern (`background.reports.test.mjs:88`) | STORY-fe-003 § How we're doing it; STORY-fe-003 § History |
| Flash-reconcile approach | (a) expose `globalThis.__snapdeckReassertActionBadge` seam; (b) `flashCleared` branch on `onChanged` | (c) no seam — kb fixes the flash kb-side (per-`tabId` flash + drop global pre-clear) | BOSS ruled option (c); kb shipped DEF-001 (per-`tabId` + dropped pre-clear) | STORY-fe-003 § History (last 3 entries); STORY-fe-003 § Cross-team item |
| AC5 keyboard-success count blank (kb's unconditional `clearFlash`) | kb's `clearFlash` runs unconditionally → blanks the orange count after `✓` teardown | GUARDED `clearFlash`: `getBadgeText({tabId})`, clear only if tab still shows kb's own `✓`/`!` | kb shipped guarded `clearFlash` (commit `e87d247`); kb regression test green; cohort `node --test` 100/100 | STORY-fe-003 § Cross-team item; STORY-fe-003 § History (last entry) |
| `_resolveInFlight` map vs. AC9 (no module-level state) | Within-wake transient promise map = module-level state, violates AC9 | Transient promise cleared on settle, lost on SW teardown = within-wake coordination only, same category as fe-001 pure ImageData memo | AC9 NOT violated: map is transient, cleared in `finally`, durable cache stays `storage.session`; PO ratified this framing | STORY-fe-002 § Revisions; STORY-fe-002 § How we're doing it |
| Tick as authoritative count vs. repaint-nudge | `reportCountChanged.newValue.count` is the badge's count value | Tick is lossy best-effort; `getReport().screenshots.length` via `GET_STATE` is the authoritative count, reconciled on every wake | BOSS elevated to DESIGN REQUIREMENT: tick = repaint nudge only; SSOT = released `GET_STATE`/`getReport`; reuse fe-002's `refreshActiveTab` at every wake | STORY-fe-003 § How we're doing it (BOSS-locked block); STORY-fe-003 § History |

## Tensions accepted as known risk

- **Idle dormant-SW blind spot:** a tick dropped during SW teardown (un-awaited
  `chrome.storage.session.set`) self-heals only when the SW next wakes on an event. A user
  who captures and then idles on the toolbar (no tab switch / reload / popup) sees a stale
  under-count until the next interaction. Low-consequence (bounded, user just captured, never
  an over-count); accepted under the best-effort/lossy-tick posture. Risk owner: product-owner.
  Cite: (STORY-fe-003 § Acknowledged Risk #1; Contrarian fe-003 Finding 1)

- **Orange-tab capture-error signal masked:** Chrome's tab-specific badge shadows the global
  `!` error flash from the released `runCaptureCommand()` on any orange tab. The user gets no
  visible failure signal beyond "count didn't increment." The only real fix is a BOSS-escalated
  released-code defect against kb; it is not an in-feature edit. Risk owner: product-owner
  (PO sign-off on the formal `## Acknowledged Risk` block). Cite: (STORY-fe-003
  § Acknowledged Risk; Contrarian fe-003 Finding 2)

- **Multi-window best-effort:** `activeTab()` uses `{currentWindow:true}`; there is no
  `windows.onFocusChanged` listener. Switching window focus fires no repaint; non-focused
  windows go stale until their next `onActivated`. Self-consistent (no corruption; every paint
  reads its own tab's port). Explicitly in scope.md out-of-scope clause. Risk owner: accepted
  by product-owner. Cite: (STORY-fe-002 § Contrarian Findings Finding 3; STORY-fe-002
  § Revisions)

- **Story line-citation drift:** line numbers cited in stories drifted ~10–50 lines after
  commit `6512a12` inserted `emitReportCountChanged`; all seams exist and behave exactly as
  described. Engineers are directed to grep by symbol, not line number, at implement time.
  Risk owner: frontend-architect. Cite: (stress-test.md § Story line-citation freshness)

## Alternatives rejected

- **Option A (pre-rendered PNG variants):** 9 new `icon-{gray,green,orange}-{16,48,128}.png`
  files in the diff + a `manifest.json` `action.default_icon` edit. Rejected in favor of
  programmatic Option B (no binary churn, colors reviewable in text diff). Cite: (conv 0004;
  STORY-do-001 § Why this is a sentinel)

- **Second `chrome.runtime.onMessage` listener** for live-count trigger: released frozen
  harnesses single-capture the LAST registered listener (`background.reports.test.mjs:88`),
  so released `GET_STATE`/`SET_NOTE` tests would invoke the new listener and hang. Rejected
  as harness-breaking. Cite: (STORY-fe-003 § How we're doing it — "Why `storage.session.onChanged`")

- **Option B live-count trigger (timer-based bounded re-derive):** fragile on cancelled
  annotations; softens AC5 (count lags until the next tab event). Retained only as rationale
  for why Option A was chosen; marked superseded. Cite: (STORY-fe-003 § How we're doing it,
  Option B block)

- **Flash-reconcile option (a) — `globalThis.__snapdeckReassertActionBadge` seam:** proposed
  and briefly authored; withdrawn when BOSS+kb settled on option (c). Cite: (STORY-fe-003
  § History — "badge-flash defect SETTLED as seam (b)..." and subsequent reversal)

- **Flash-reconcile option (b) — `flashCleared` `storage.session.onChanged` branch:**
  anchored to kb's shipping a `flashCleared` write; briefly implemented (with a
  `flashCleared_reassertsTabFromGetState` unit case); withdrawn after kb shipped option (c)
  instead. Cite: (STORY-fe-003 § History — penultimate entry)

- **Editing `runCaptureCommand()` in-feature:** explicitly prohibited by scope.md Critical
  Directive #4 and AC11. If the reconcile were genuinely impossible on this feature's side,
  the path is a BOSS-escalated released-code defect — never a unilateral edit. Cite:
  (scope.md § Critical directives #4; feature.md AC11)

## Next actions

Mirror of feature.md acceptance criteria (AC1–AC13):

- [ ] **AC1** — Gray is instant for non-localhost, no probe. On `tabs.onActivated`/`onUpdated` for a non-localhost tab, icon set **gray** immediately; **no** `/resolve` probe fired.
- [ ] **AC2** — Green = localhost target owned by a live controller, via a cached probe. Resolution cached in `chrome.storage.session` keyed by port; re-activation within TTL fires no new probe.
- [ ] **AC3** — Localhost with no live controller → gray (`findController()` → null).
- [ ] **AC4** — Orange + numeric badge while a report is in progress (`count > 0` via released `GET_STATE`). Orange takes precedence over green.
- [ ] **AC5** — Live count increment without a tab switch. Popup `ADD_SCREENSHOT` and released keyboard-shortcut path both update the active tab's orange badge count live; no tab switch required.
- [ ] **AC6** — Back to green on save/clear. Badge clears (empty text) and icon returns to **green** after `SAVE_REPORT` success or `CLEAR_REPORT`.
- [ ] **AC7** — Per-`tabId` state survives service-worker restart. All `action` calls pass `{ tabId }`; active tab re-derived on wake from IndexedDB + `chrome.storage.session`.
- [ ] **AC8** — All listeners registered at top level (synchronously at module scope). No listener registration inside an async callback.
- [ ] **AC9** — No module-level mutable state; resolution cache in `chrome.storage.session`. (`_resolveInFlight` within-wake transient promise is AC9-compatible per PO ruling.)
- [ ] **AC10** — One source of truth for the port. Port derived only via released `currentTargetPort()`/`portOfUrl()`. Deceptive `localhost.evil.com` → gray, no probe.
- [ ] **AC11** — Released-code boundary; steady-state-after-flash. `runCaptureCommand()` and all released w0/kb seams unmodified. After kb's `✓`/`!` flash self-clears, correct per-`tabId` steady state re-asserts.
- [ ] **AC12** — Two-tier responsiveness. Instant gray for non-localhost (no probe). `/resolve` fan-out only on cache miss. Tab switching never blocked on a synchronous network probe.
- [ ] **AC13** — No new manifest permission. `action`, `tabs`, `storage` (covers `chrome.storage.session`) already granted. Icon generation via `OffscreenCanvas` (programmatic, Option B) — no new asset files, no manifest edit.

## Open questions deferred to implementation

None. All coordination-point questions were resolved before `STORIES_LOCKED`:
- Trigger mechanism (Option A `storage.session.onChanged`) locked and w0 producer frozen (commit `6512a12`).
- Flash-reconcile approach (option c, no seam) locked and kb's DEF-001 fix verified (commits `dbdd660`, `e87d247`).
- AC5 keyboard-success residual closed (kb guarded `clearFlash`; cohort test suite 100/100).
