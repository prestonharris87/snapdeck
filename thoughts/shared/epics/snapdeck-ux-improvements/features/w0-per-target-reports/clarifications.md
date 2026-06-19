# Clarifications — w0-per-target-reports

## C1 — Add STORY-fe-003: emit `reportCountChanged` storage.session tick

- **Filed:** 2026-06-19T15:55:03Z
- **From:** operator (option A) relayed by BOSS, defect re-engagement `#snapdeck-ux-improvements/defect-screenshot-added-ping`
- **Status:** story-added
- **Target:** new story `STORY-fe-003` (fe domain); `depends_on: [STORY-fe-001]`
- **Story request:**

**Problem the new story solves:** The released per-target report store (fe-001) mutates the in-progress screenshot count silently — there is no push signal when the count changes. The sibling feature `w1-dynamic-icon-badge` needs a live signal to drive its orange "report-in-progress(N)" toolbar badge (its AC5). fe-002 explicitly notes the badge feature is downstream; this story adds the missing **producer** half.

**Acceptance criteria (testable):**
1. A DRY helper `emitReportCountChanged(port, count)` emits `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })`, called at EXACTLY three sites in `extension/background.js`:
   - `addScreenshot()` — after `setReport(port, r)` resolves; `count = r.screenshots.length`; `port` = the `portOfUrl(tab.url)` local (post-localhost-gate, guaranteed non-null).
   - `saveReport()` — after `clearReport(browserPort)` on the **successful** POST→save path only; `count = 0`; first arg = `browserPort` (not `port`).
   - the `CLEAR_REPORT` message handler — after `clearReport(port)`; `count = 0`.
2. **Null-port guard** — the helper returns early when `port == null`. Load-bearing for the CLEAR_REPORT site, where `currentTargetPort()` can be `null` on a non-target tab (no phantom emit on a no-op clear).
3. **Optional-chaining guard** — `chrome.storage?.session?.set?.(…)` no-ops when `chrome.storage` is absent, so the FROZEN released tests (`background.reports.test.mjs`, `background.shortcuts.test.mjs`) stay byte-for-byte green and the module loads clean under the no-`storage` mock.
4. **Non-breaking** — `addScreenshot`/`saveReport` return values and the IndexedDB report write are byte-identical to released behavior; NO new `chrome.runtime.onMessage` listener is added (would hijack the single-capture mock); no edits to released stories fe-001/fe-002 or their frozen tests.
5. **New unit tests in a NEW test file** (e.g. `extension/background.emit.test.mjs`, since the 25 existing cases are frozen) prove: (a) the tick fires `{port,count,ts}` at all 3 sites when `storage.session.set` is stubbed; (b) report write + return values are unaffected when `chrome.storage` is absent.

**Domain:** fe.

**Suspected files / surfaces touched:** `extension/background.js` (the `emitReportCountChanged` helper + the 3 call sites); a NEW `extension/background.emit.test.mjs`. No other files.

**Out of scope:** the consumer (`w1-dynamic-icon-badge` fe-003 `onChanged` listener — separate feature); any change to the `{port,count}` data already exposed via `GET_STATE`; any persisted-storage change (`storage.session` is transient, `TRUSTED_CONTEXTS` by default); editing fe-001/fe-002 or their frozen tests; the `SET_NOTE` path (no count change → no emit).

**Touches security surface:** NO. `chrome.storage.session` is transient and extension-context-local (default `TRUSTED_CONTEXTS` — not readable by web-page content scripts). `port`/`count` are already exposed via `GET_STATE`. The emit inherits fe-001's localhost gating via the same gated `port` values. No auth, PII, endpoint, role, or persisted-data surface added.

**Cross-feature contract (BOSS-ratified, channel-locked):** tick shape `{ reportCountChanged: { port:number, count:number, ts:number } }`; transport `chrome.storage.session` (NOT `runtime.sendMessage` — superseded). Consumer = `w1-dynamic-icon-badge` fe-003, a key-filtered (`changes.reportCountChanged`) `storage.session.onChanged` listener. Serialization: this emission lands + freezes FIRST; dynamic-icon's fe-003 consumes on top.

**Phase 3 verify-first (codebase-analyzer) — VERDICT: CONFIRMED.** Evidence (file:line) and caveats carried to the architect:
- The 3 sites exist as described (`background.js:227-228`, `:257-259`, `:185`).
- Port non-null at sites 1 (`:197`→`:200` localhost gate→`portOfUrl`) and 2 (`:236-237` guard); the null-port guard is independently required at site 3 (`currentTargetPort()` `:70-75` can return null; existing `setReport` null-guard at `:45` does NOT cover the new emit call).
- Frozen mock `_chromeMock` (`background.reports.test.mjs:85-117`) has NO `storage` key → optional-chaining essential; onMessage single-capture confirmed (`:83`,`:87-89` bare `_onMessageListener = cb`).
- fe-001 + fe-002 introduce no emission/notification/`storage.session` write — genuinely additive, not a duplicate.
- New tests go in a NEW file (the existing 25 are frozen); site 1 uses the `port` local (not `currentTargetPort`); site 2's first arg is `browserPort`.

- **Decided by:** operator (option A), relayed by BOSS, 2026-06-19
- **Resolution:** in-progress (architect dispatch in flight; see `stories/STORY-fe-003.md` + `decision-memo-v2.md`)
