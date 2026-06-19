---
type: story
id: STORY-fe-001
name: "Re-key in-progress report to per-port + current-target resolution"
domain: frontend
parent_feature: w0-per-target-reports
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
diff_estimate: substantive
files_modified:
  - extension/background.js
files_not_modified:
  - extension/popup/popup.js
  - extension/popup/popup.html
  - extension/popup/popup.css
  - extension/content/capture.js
  - extension/content/editor.js
  - extension/content/bridge.js
  - extension/content/overlay.css
  - extension/manifest.json
reuse_patterns:
  - extension/background.js:34-38   # current getReport/setReport/clearReport (single "report" key) — the seam being re-keyed
  - extension/background.js:41-46   # portOfUrl(url) — the ONE port-derivation helper to reuse
  - extension/background.js:49-52   # activeTab() — active-tab resolution helper
  - extension/background.js:144-150 # saveReport's existing portOfUrl(tab.url) derivation — reorder, don't re-invent
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: Re-key in-progress report to per-port + current-target resolution

## What we're doing

Re-key the extension's in-progress report from a single global IndexedDB record
(`snapdeck`/`kv`, key `"report"`) to a per-browser-port record keyed
`report:<browserPort>` in the same object store — **no IndexedDB version bump**
(the `kv` store is already generic). The storage helpers `getReport`/`setReport`/
`clearReport` become port-scoped, and every report read/write resolves "the
current target" (the active tab's dev-server port, via the existing `portOfUrl`
seam) at handling time. Caller-facing message-API signatures and the zero-arg
`addScreenshot()`/`saveReport()` signatures stay unchanged — port-scoping is
pushed *down* into the storage helpers. This delivers two-port capture
isolation, save isolation, and service-worker-restart persistence. The popup's
observable `GET_STATE` contract is intentionally left unchanged in this story
(still `{ count, note }`, now port-scoped); the additive `port` field +
non-target empty-state is STORY-fe-002.

## What it should look like

No new screen. All changes are internal to `extension/background.js`. Recommended
shape (engineer owns exact tactics):

**Port-scoped storage helpers** (replace lines 34-38):

```js
function reportKey(port) { return `report:${port}`; }
const EMPTY_REPORT = () => ({ note: "", screenshots: [] });

async function getReport(port) {
  if (port == null) return EMPTY_REPORT();                 // non-target → empty, no IDB read
  return (await idbGet(reportKey(port))) || EMPTY_REPORT();
}
async function setReport(port, r) {
  if (port == null) return;                                // never persist a report:null record
  await idbSet(reportKey(port), r);
}
async function clearReport(port) { await setReport(port, EMPTY_REPORT()); }
```

**Current-target resolution seam** (new helper; the single "is there a target +
which port" source of truth, built on the existing `portOfUrl`):

```js
// Resolve the active tab's dev-server port (the current target). Localhost-gated:
// returns the int port for an http://localhost|127.0.0.1 tab, else null.
async function currentTargetPort() {
  const tab = await activeTab();
  const url = (tab && tab.url) || "";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) return null;
  return portOfUrl(url);
}
```

**Message handlers / capture / save** resolve the current target internally:

- `GET_STATE` (88-91): `const port = await currentTargetPort(); const r = await
  getReport(port);` → return the **existing** `{ count: r.screenshots.length,
  note: r.note || "" }` shape (no `port` field yet — that's fe-002).
- `SET_NOTE` (92-97): `const port = await currentTargetPort(); const r = await
  getReport(port); r.note = msg.note || ""; await setReport(port, r);`
- `CLEAR_REPORT` (102-104): `await clearReport(await currentTargetPort());`
- `addScreenshot` (110-142): keep the existing localhost guard and `activeTab()`
  call **untouched**; derive the port once from that same guarded tab —
  `const port = portOfUrl(tab.url);` — and pass it to `getReport(port)` /
  `setReport(port, r)` at lines 128 & 140. The per-screenshot object literal
  (129-139) MUST be preserved field-for-field (see no-regression).
- `saveReport` (144-173): resolve the port **before** loading the report
  (per-port keying needs the key first). Keep the existing derivation line
  `let browserPort = portOfUrl(tab && tab.url);`, then `const r = await
  getReport(browserPort);`, then the empty-check; POST `browser_port: browserPort`
  unchanged; on success `await clearReport(browserPort)`.

## Existing behavior baseline

- **Currently:** `extension/background.js:34-38` — `getReport()`/`setReport(r)`/
  `clearReport()` read/write a SINGLE global IndexedDB record under key
  `"report"`, default `{ note: "", screenshots: [] }`.
- **Currently:** `extension/background.js:9-33` — `idb()`/`idbGet(key)`/
  `idbSet(key,val)` open db `snapdeck` **v1**, object store `kv` (generic
  key→value). These primitives and the v1/`kv` store stay as-is (no version bump).
- **Currently:** `extension/background.js:41-46` — `portOfUrl(url)` is the single
  port-derivation helper (explicit port, else 443/80, else null).
- **Currently:** `extension/background.js:49-52` — `activeTab()` resolves the
  active tab.
- **Currently:** `extension/background.js:86-108` — `handle(msg)` dispatcher:
  `GET_STATE` (88-91) returns `{count, note}`; `SET_NOTE` (92-97); `ADD_SCREENSHOT`
  → `addScreenshot()` (98-99); `SAVE_REPORT` → `saveReport()` (100-101);
  `CLEAR_REPORT` → `clearReport()` (102-104).
- **Currently:** `extension/background.js:110-142` — `addScreenshot()`: localhost
  guard + error string (112-114), `captureVisibleTab`, the editor `ANNOTATE`
  round-trip (123 `chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE", image })`
  and `resp.meta`/`resp.original`/`resp.annotated` handling), pushes a
  per-screenshot object (129-139) via `getReport`→`setReport`.
- **Currently:** `extension/background.js:144-173` — `saveReport()`: loads
  `getReport`, empty-check, derives `browserPort` via `portOfUrl(tab.url)` with a
  fallback to `portOfUrl(screenshots[0].url)` (147-150), `findController`, POSTs
  the payload with field-renaming (159-163), `clearReport()` on success.
- **Dispatch path / call graph:** popup / keyboard command → `chrome.runtime`
  message → `handle()` → handler → `getReport`/`setReport`/`clearReport` →
  `idbGet`/`idbSet` → IndexedDB `snapdeck`/`kv`. `saveReport` additionally →
  `findController` → `GET http://127.0.0.1:<ctrl>/resolve?port=<n>` then
  `POST /report/save` (the Snapdeck controller — **server-side, unchanged**).
- **No-regression assertion (must survive byte-for-byte in effect):**
  1. The `addScreenshot` **localhost guard** (112-114) and its exact error string.
  2. The editor **`ANNOTATE` round-trip** (123 `sendMessage {type:"ANNOTATE",
     image}`, `resp.cancelled` short-circuit, `resp.meta`/`original`/`annotated`/
     `annotations`/`console`/`network` mapping).
  3. The **per-screenshot field set** at 129-139, **including a sibling-added
     `model` key** if present at merge time — only the surrounding `getReport`/
     `setReport` calls gain a port arg; do NOT edit, drop, or reorder the
     screenshot object's fields.
  4. The **`/report/save` payload field-renaming** (159-163:
     `original→original_png_b64`, `annotated→annotated_png_b64`,
     `network→network_failures`) and the `browser_port` value.
  5. The controller `/resolve` + `/report/save` contract and the saved
     `report.json` projection (server-side; this story does not touch it).
  6. The `idb()`/`idbGet`/`idbSet` primitives and the `snapdeck` **v1** / `kv`
     store — **no version bump**, no migration of the legacy `"report"` key.
- **Explicitly changing:** `getReport`/`setReport`/`clearReport` become
  port-scoped (`report:<port>`); a `currentTargetPort()` seam is added;
  `GET_STATE`/`SET_NOTE`/`CLEAR_REPORT`/`addScreenshot`/`saveReport` resolve the
  current target's port internally and operate on `report:<port>`; `saveReport`
  is reordered to resolve the port before loading + clears only that port's
  record. `saveReport`'s `portOfUrl(screenshots[0].url)` fallback (149) is
  **intentionally retired** — per-port keying must derive the report key from the
  active tab's port *before* it can read the record, so a save on a non-target
  tab now returns the existing "could not determine the dev-server port" error
  rather than recovering a port from report contents (scope-aligned; not a silent
  drop).
- **Verified:** 2026-06-19

## How we're doing it

- Edit `extension/background.js` only. Re-key the three storage helpers, add
  `currentTargetPort()`, and thread the resolved port through the five message
  handlers + `addScreenshot`/`saveReport` per the sketch above.
- **One source of truth for the port:** all port values come from the existing
  `portOfUrl(url)` (41-46). `currentTargetPort()` is a thin localhost-gated
  wrapper over it — do NOT introduce a second port-derivation path. The
  "icon is green / capture will save" localhost determination and the report key
  resolve from the same seam.
- **MV3 ephemerality — no module state:** do NOT introduce any module-level
  variable holding report state or the resolved port. Resolution happens at
  handling time from the active tab. **No `chrome.storage.session` port cache is
  introduced by this story** — because resolution is synchronous-from-active-tab
  there is no cross-tab cache to persist; the `chrome.storage.session` rule
  applies only IF a future change adds a cache, which this story does not. The
  per-port reports themselves live in IndexedDB and so survive worker restarts.
- **Caller signatures unchanged:** `addScreenshot()` / `saveReport()` stay
  zero-arg; the message-API payloads (`GET_STATE`/`SET_NOTE`/`ADD_SCREENSHOT`/
  `SAVE_REPORT`/`CLEAR_REPORT`) are unchanged. This means **no call-site change**
  is required of the sibling `w0-keyboard-shortcuts` feature, which dispatches to
  the unchanged `addScreenshot()` seam.
- **No migration:** the legacy `"report"` key is not read forward; it may be
  abandoned on upgrade.
- **Shared-file merge note:** `w0-keyboard-shortcuts` adds a single top-level
  `chrome.commands.onCommand` listener (register-only) to this same file. That
  block is region-isolated from the helpers + handlers you edit here — do not
  touch it; flag both footprints at the push window.
- **Verification (no long-lived server from a backgrounded shell):** you cannot
  drive a browser yourself. After the edit, ask the `browser-tester` teammate to
  load the unpacked extension and drive the message API across two localhost
  ports (see § How we validate). Confirm any dev servers / Snapdeck controllers
  the smoke needs are already running in user-owned terminals — do not background-
  spawn them.

## How we validate it was done correctly

- [ ] In-progress reports persist under `report:<browserPort>` in `snapdeck`/`kv`
      (no `"report"` global key written; no IndexedDB version bump).
- [ ] Capturing on a port-A tab (`:5101`) appends only to `report:5101`;
      capturing on a port-B tab (`:5102`) appends only to `report:5102` — neither
      write touches the other port's record (E2E "Two-port capture isolation").
- [ ] Starting a report on A, switching to B, switching back to A restores A's
      report + count unchanged.
- [ ] `SET_NOTE` writes the note only to the current target's record;
      `CLEAR_REPORT` clears only the current target's record (E2E "Note isolation").
- [ ] `SAVE_REPORT` loads + POSTs the current target's report with
      `browser_port` = the resolved port; on a successful `{ok:true}` it clears
      only that port's record, leaving other ports untouched (E2E "Save isolation").
- [ ] Per-port reports survive a forced service-worker restart (IndexedDB);
      `GET_STATE` after restart still reports the current target's count (E2E
      "Service-worker restart persistence").
- [ ] No module-level report/port state is introduced; no `chrome.storage.session`
      cache is added by this story.
- [ ] `addScreenshot()` and `saveReport()` remain zero-arg; message-API payloads
      unchanged.
- [ ] No-regression: addScreenshot localhost guard + error string, the `ANNOTATE`
      round-trip, the per-screenshot field set (incl. a sibling `model` key), and
      the `/report/save` payload field-renaming are all unchanged.
- [ ] No diff under `extension/popup/*`, `extension/content/*`, or
      `extension/manifest.json`.

## Motion contract

n/a — service-worker / IndexedDB plumbing with no rendered or animated surface.
The popup (`popup.html`/`popup.js`) is unchanged and renders the same count/note
UI it already does; no transitions or visual state changes are introduced.

## Unit tests

**Unit lane (HYBRID ruling 2026-06-19):** `node --test` — Node's built-in
`node:test` + `node:assert/strict`, ESM, **zero new dependencies, no
`package.json`** (same convention as
`.claude/scripts/__tests__/channel-size-warn.test.js`). `unit-tester` Phase 5a now
runs `node --test extension/`; these specs are in play.

**Test file:** `extension/background.reports.test.mjs` — feature-distinct name so it
does NOT collide with sibling `w0-keyboard-shortcuts`'
`extension/background.test.mjs` on the shared `node --test extension/` run.

**Harness (no source/manifest change):** `background.js` is a classic service
worker with no exports, so load its source into a `node:vm` context pre-seeded with
hand-written stubs **before** evaluation — this exposes the top-level declarations
(`getReport`/`setReport`/`clearReport`/`currentTargetPort`/`handle`) as
directly-callable context members AND lets the stubbed
`chrome.runtime.onMessage.addListener` capture the message listener. Stubs:
`chrome.tabs.query` (returns a configurable active-tab `{ url }`),
`chrome.runtime.onMessage.addListener` (captures the callback), a tolerant
`chrome.commands?.onCommand?.addListener` no-op (so a merged sibling listener does
not throw), and an in-memory `indexedDB` backing the `kv` store with a `Map` plus
`get`/`put` call counters (for the no-IDB-read assertions). Requires **no change to
`background.js` or `manifest.json`** (respects `files_not_modified`).

Cases (names `subject_condition_expectation`; the test file is
`extension/background.reports.test.mjs` for all):

- `getReport_emptyStore_returnsEmptyDefault` — `getReport(5101)` on an empty kv
  store returns `{ note: "", screenshots: [] }`.
- `setReport_thenGetReport_roundTripsUnderPortKey` — `setReport(5101, r)` then
  `getReport(5101)` deep-equals `r`; the in-memory kv has key **`report:5101`**
  (proves the `report:<port>` key format).
- `setReport_portIsolation_otherPortUntouched` — after writing `report:5101`,
  `getReport(5102)` deep-equals the empty default and no `report:5102` key exists —
  the core cross-port invariant as a fast unit test (vs two live tabs).
- `clearReport_resetsOnlyThatPort` — with records under 5101 and 5102,
  `clearReport(5101)` leaves `report:5101` = empty default and `report:5102`
  deep-equal untouched.
- `currentTargetPort_localhost_returnsPort` — `chrome.tabs.query` resolves
  `http://localhost:5101`, so `currentTargetPort()` returns `5101`.
- `currentTargetPort_127001_returnsPort` — `http://127.0.0.1:5173` returns `5173`.
- `currentTargetPort_httpsNonLocalhost_returnsNull` — `https://example.com` returns
  `null` (NOT 443 — proves the localhost gate, not a bare `portOfUrl`).
- `currentTargetPort_nonLocalhostScheme_returnsNull` — `about:blank` (and
  `chrome://extensions`) return `null`.
- `getReport_nullPort_returnsEmptyDefault_noIdbRead` — `getReport(null)` returns
  the empty default AND the indexedDB stub records **zero `get` calls**.
- `setReport_nullPort_doesNotWrite` — `setReport(null, { note:"x",
  screenshots:[{}] })` writes nothing: no `report:null` key and **zero `put` calls**.
- `GET_STATE_localhostTab_returnsPortScopedCountNote` — invoke the captured
  `onMessage` listener with `{ type:"GET_STATE" }` while `tabs.query` resolves
  `localhost:5101` and `report:5101` holds 2 screenshots + note "n"; the awaited
  `sendResponse` has `count === 2` and `note === "n"`. **Assert these two fields
  individually (not a strict deep-equal of the whole response)** so the additive
  `port` field STORY-fe-002 adds later does not break this test.
- `SET_NOTE_writesOnlyCurrentTargetRecord` — `{ type:"SET_NOTE", note:"A" }` at
  5101 then `GET_STATE` at 5101 gives `note === "A"`; switch `tabs.query` to 5102
  and `GET_STATE` gives `note === ""` (per-port note isolation through the public
  message API).

**Integration lane:** the `feature.md` § E2E test spec specs ("Two-port capture
isolation", "Note isolation across ports", "Save isolation — save A clears only A",
"Service-worker restart persistence") remain the assertion-grade **integration**
coverage — real cross-tab activation, the full `ADD_SCREENSHOT` capture/`ANNOTATE`
round-trip, the `SAVE_REPORT` controller POST, and a genuine service-worker restart
through the live message API — driven by `browser-tester` at implement time. The
unit lane above covers the keying / resolution / null-handling logic in isolation;
the integration lane proves it end-to-end in a real browser.

(Surfaced to team-lead as an open question: whether to add a JS unit harness for
the extension via a devops story.)

## Dependencies

none. This story is extension-internal (browser IndexedDB + the active-tab seam).
It consumes the Snapdeck controller's `/resolve` + `/report/save` contract, but
that contract is **pre-existing and unchanged** by this feature — there is no
producer story in this feature to depend on (backend-architect confirmed the
controller domain is a no-op; database-architect confirmed no server-side
migration). `depends_on: []` is therefore correct, not an omission.

## Cross-domain contract

Established by peer rounds during decomposition (2026-06-19); recorded durably here:

- **Report-store model ownership = frontend/extension domain (this story set).**
  The team-lead reassigned the IndexedDB report-store re-keying to FE; the
  database-architect's server-side domain is a sentinel (`STORY-db-001`). A
  FOR-REFERENCE map of the model lives at `thoughts/shared/epics/snapdeck-ux-improvements/data-model.md`
  § `w0-per-target-reports` (flagged authored-by-FE) — **these FE stories are
  authoritative**, the data-model copy is a cross-team convenience map.
- **Backend controller = clean no-op (`STORY-be-001` sentinel).** Confirmed
  against `controller/snapdeck_controller/reports.py:108-181` (`save_report`) and
  `:44-60` (`resolve_owner`). The POST `/report/save` payload (`browser_port`,
  `note?`, `screenshots[]` with `original_png_b64`/`annotated_png_b64`/
  `annotations`/`console`/`network_failures`) and the saved `report.json`/
  `report.md` projection are byte-identical. **Load-bearing:** `browser_port` MUST
  stay derived from `portOfUrl(activeTab.url)` exactly as `saveReport()` does today
  — the controller's `resolve_owner` matches that port against a live worktree's
  `browsable_ports`; a changed derivation would break owner resolution.
- **Port-resolution cache:** intentionally **none introduced** by this story
  (resolution is at-handling-time from the active tab). The scope's
  `chrome.storage.session` rule is a constraint that applies *only if* a future
  change adds a cache. The load-bearing requirement enforced here is **no
  module-level report/port state**.
- **Sibling `screenshots[].model` field (`w0-editor-foundation`):** added
  orthogonally to the per-screenshot object literal; the whole `screenshots` array
  is carried as-is through the re-key, so `model` survives transparently. This
  story's no-regression assertion #3 protects it.

## History

- 2026-06-19 — created by frontend-architect (effort=2, substantive, depends on none).
  Domain (extension `background.js`) assigned to FE by team-lead for this feature.
  Controller no-op + DB no-op peer-confirmation requested from backend-architect
  and database-architect.

## Revisions

- 2026-06-19 — **product-owner (arbitrate):** Promoted `pending → approved`.
  **PO-accepted intentional change recorded:** STORY-fe-001 intentionally RETIRES
  `saveReport()`'s legacy fallback `portOfUrl(screenshots[0].url)` (old
  `extension/background.js:149`). Under per-port keying the report key must be
  resolved from the active tab's port *before* the record can be read, so
  deriving the port from already-loaded report contents is logically incompatible
  with the new read-by-key flow. Consequence: a `SAVE_REPORT` on a non-target
  (non-localhost) tab now returns the existing `"could not determine the
  dev-server port"` error instead of recovering a port from `screenshots[0].url`.
  This is **scope-aligned** — the active tab IS the current target, so "save the
  current target's report" has no meaning on a non-target tab — and it is
  **flagged, not silently dropped** (also documented in the "Existing behavior
  baseline → Explicitly changing" bullet). Ratified by team-lead. No cross-domain
  impact: the controller still receives `browser_port` derived from
  `portOfUrl(activeTab.url)`, unchanged (see STORY-be-001). No other story content
  changed.
