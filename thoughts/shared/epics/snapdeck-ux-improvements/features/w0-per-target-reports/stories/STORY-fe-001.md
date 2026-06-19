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
- [ ] The write path (`addScreenshot`/`saveReport`) resolves its port through the
      SAME localhost-gated helper as the read path (`currentTargetPort()`), not a
      second looser predicate: a capture on `http://localhost.evil.com` writes no
      `report:*` record and is rejected (E2E "Deceptive-host write/read gate
      parity"; fe-001 LOW-1 PROMOTE).
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
runs `node --test extension/*.test.mjs`; these specs are in play.

**Test file:** `extension/background.reports.test.mjs` — feature-distinct name so it
does NOT collide with sibling `w0-keyboard-shortcuts`'
`extension/background.test.mjs` on the shared `node --test extension/*.test.mjs` run.

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

## Security Review

STRIDE pass by security-architect (2026-06-18). No HIGH/CRITICAL findings — the
threat surface is well-contained by the extension's existing structure (verified
against `extension/manifest.json` + `extension/background.js`): **no
`externally_connectable`** (web pages cannot drive the `chrome.runtime` message
API), `content_scripts`/`host_permissions` limited to **exact** `localhost`/
`127.0.0.1`, and `tab.url` is browser-authoritative (page JS cannot cross-origin
it via `pushState`; Chrome strips embedded userinfo so the
`http://localhost@evil.com` trick lands as `http://evil.com` and is rejected).
Two LOW (defense-in-depth) findings and two affirming INFO notes follow; none
gate delivery.

### LOW — Divergent localhost gate: report write-key vs read-key derive from two predicates

- **Threat (Spoofing / cross-target confusion, EoP-adjacent).** This story adds
  `currentTargetPort()` with a *tightened* localhost regex
  `/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/` (sketch lines 83-88) used by the
  read/note/clear path, but **deliberately leaves `addScreenshot`'s existing
  loose guard** `/^http:\/\/(localhost|127\.0\.0\.1)/` untouched (line 99-103 of
  this story; `background.js:112`) and has `addScreenshot`/`saveReport` derive
  their port from a bare `portOfUrl(tab.url)` rather than from
  `currentTargetPort()`. The result is **two different "is this a target / which
  port" semantics in one file**. They agree for genuine loopback tabs, but for a
  deceptive hostname (`http://localhost.evil.com/`, `http://127.0.0.1.evil.com/`)
  the loose guard matches and `portOfUrl` yields `80`, while `currentTargetPort()`
  correctly returns `null`. So the *write* path would happily key a record the
  *read* path will never surface for that tab — but **will** surface for the
  genuine `:80` localhost target → a latent cross-target-poisoning shape. This
  also contradicts the scope's own critical directive ("keep 'icon is green /
  capture will save' and 'report key' derived from **one source of truth**").
- **Why it is only LOW today (not exploitable as shipped):** persistence to
  `report:<port>` happens *only after* a successful `ANNOTATE` round-trip
  (`background.js:127-140`), which requires the content script, which is injected
  only on exact `localhost`/`127.0.0.1` (manifest `content_scripts.matches`). On
  `localhost.evil.com` the `sendMessage(ANNOTATE)` rejects and nothing is
  written. The report store's integrity therefore currently rides on an
  **unrelated subsystem** (content-script injection), not on its own gate.
- **Recommendation (fits inside this story's "How we're doing it"):** make
  `addScreenshot` and `saveReport` resolve their port through the **same**
  localhost-gated helper as the read path — i.e. derive the write-key port from
  `currentTargetPort()` (or factor the gate+`portOfUrl` into one predicate all
  three call sites share) so write-key ≡ read-key by construction. This satisfies
  the scope's "one source of truth" directive, tightens `addScreenshot`'s loose
  guard as a free defense-in-depth win, and removes the reliance on the ANNOTATE
  backstop for report-store integrity. Note: `addScreenshot` must still capture
  on the tab it guards — keep the guard's `{error}` return, just unify the port
  derivation feeding `getReport`/`setReport`. (Tighter gate also aligns with the
  security-architect lesson: reuse one guard rather than reimplement a second.)
**PO disposition:** PROMOTE_TO_AC. Aligns with scope.md's "one source of truth
  for the port" critical directive and is free defense-in-depth, so I am hardening
  it into the contract rather than leaving it to implementation discretion. Wired
  the PO surfaces: added a `feature.md` `## Acceptance criteria` bullet (write path
  derives its port via the same localhost-gated resolution as the read path;
  `http://localhost.evil.com` → no-target, not `:80`), a matching `feature.md` E2E
  scenario ("Deceptive-host write/read gate parity (security)"), and a
  `## How we validate it was done correctly` checklist item on this story. The
  frozen `## Unit tests` section is intentionally untouched (BOSS hybrid ruling) —
  the warranted implementation-time assertion is
  `addScreenshot_deceptiveHost_writesNoRecord` (stub `tabs.query` →
  `http://localhost.evil.com`, assert zero `put` calls), which the engineer adds
  alongside the existing `currentTargetPort_*` cases. **No cross-feature contract
  change:** the `report:<port>` key format and the `GET_STATE` shape are unchanged.

### LOW — Unbounded `report:<port>` key accumulation under `unlimitedStorage` (no eviction)

- **Threat (Denial of Service / resource exhaustion).** Re-keying from one global
  `"report"` record to per-port `report:<port>` removes the old design's implicit
  single-record bound. Every distinct dev-server port the user ever captures on
  mints a `report:<port>` key, and **nothing ever deletes one**: `clearReport`
  resets to the empty default *but leaves the key present* (sketch line 74,
  `setReport(port, EMPTY_REPORT())`), and `saveReport` success calls the same
  `clearReport`. Empty residue keys are tiny, but an **abandoned non-empty**
  report (capture N base64-PNG screenshots on an ephemeral port — Vite/webpack
  rotate ports — then never save) is retained indefinitely, and
  `unlimitedStorage` (manifest line 6) removes the quota backstop that would
  otherwise cap growth. Monotonic, single-user, local — but unbounded.
- **Severity rationale:** LOW — local single-user dev tool, self-inflicted, and
  empty residue is negligible. The only real cost is orphaned non-empty reports
  on dead ports with no GC.
- **Recommendation (PO to disposition in Phase 7.5 — does NOT gate this story):**
  pick one: **(a)** add an `## Acceptance criteria` note to `feature.md`
  explicitly *accepting* the no-eviction behavior as known/acceptable for a local
  tool; or **(b)** spin a small optional follow-up (e.g. under
  `w2-screenshot-gallery`, which already reads `report:<port>`) to delete the key
  on `clearReport`/`saveReport`-success instead of writing an empty record, and/or
  evict `report:<port>` keys for ports with no live controller. I am **not**
  authoring a defensive `STORY-sec` for this — a LOW local-single-user cleanup
  does not warrant a standalone story; it fits as an AC note or a sibling
  follow-up.
**PO disposition:** ACCEPT_AS_RECOMMENDATION (not gating). LOW is right: local
  single-user tool, self-inflicted, empty residue negligible, and `clearReport`
  already resets content — the only real cost is orphaned non-empty reports on dead
  ephemeral ports. Not promoting to AC and not filing a defect. A per-port GC is the
  natural responsibility of `w2-screenshot-gallery`, which already reads/manages
  `report:<port>` records and owns the delete/manage flow; recording it here as that
  feature's home for any key-deletion (delete the `report:<port>` key on
  `clearReport`/`saveReport`-success instead of writing an empty record, and/or
  evict keys for ports with no live controller). **Standing guardrail for w2:** any
  such deletion must stay resolve-from-active-tab / no caller-supplied port, to
  preserve the IDOR-free shape (see the IDOR INFO disposition below).

### INFO — Retiring the `portOfUrl(screenshots[0].url)` save fallback is a net security positive

- The intentional retirement of `saveReport`'s legacy fallback (old
  `background.js:149`; this story's "Explicitly changing" bullet + PO revision
  note) removes a path where a **page-controlled** value (`screenshots[0].url`
  originates from the content script's `ANNOTATE` `resp.meta.url`) could influence
  which `browser_port`/controller a save routed to when the active-tab derivation
  failed. Post-change, the only port source for save is the browser-authoritative
  `portOfUrl(tab.url)`. This **tightens** Tampering resistance (removes a
  page-content-influenced routing input). Affirmed — no action needed; called out
  so it is not mistaken for a dropped guard.
**PO disposition:** ACCEPT_AS_RECOMMENDATION (affirm). Agreed — the fallback
  retirement (already recorded as a PO-accepted intentional change in this story's
  `## Revisions`) removes a page-controlled (`resp.meta.url`) routing input, so
  `browser_port` now derives solely from the browser-authoritative
  `portOfUrl(tab.url)`. No new AC: the existing no-regression validates item that
  pins the `browser_port` derivation already locks the post-change behavior.
  **Standing guardrail:** do not reintroduce a page-content-derived port fallback
  into the save path.

### INFO — API design eliminates the IDOR / port-enumeration vector (affirm)

- The AC "callers never pass a port; port-scoping is pushed *down* into the
  storage helpers" is a **positive** security property: because `GET_STATE`/
  `SET_NOTE`/`CLEAR_REPORT` resolve the port from the *active tab* and accept no
  caller-supplied port, there is no way for any message sender to read or clear an
  *arbitrary* `report:<otherPort>` record (no IDOR / cross-port enumeration via
  the message API). Combined with the absence of `externally_connectable`, the
  only reader of a port's report is that port's own active tab. **Note for
  downstream features:** per-port keying is a **UX isolation boundary, not a
  security boundary** — all `report:*` records share one extension-origin
  IndexedDB; `w1`/`w2` must preserve the "resolve-from-active-tab, no
  caller-supplied port" shape and must not add a handler that takes a port
  argument from an untrusted caller.
**PO disposition:** ACCEPT_AS_RECOMMENDATION (affirm). Agreed and load-bearing
  for downstream. The "callers never pass a port; port-scoping pushed *down* into
  the storage helpers" property is what makes cross-port enumeration impossible via
  the message API, and it is already enforced by this story's
  "`addScreenshot()`/`saveReport()` remain zero-arg; message-API payloads unchanged"
  validates item — so no new AC. Promoting the security-architect's forward-looking
  note to a **standing guardrail for `w1`/`w2`:** per-port keying is a **UX
  isolation boundary, not a security boundary** (all `report:*` records share one
  extension-origin IndexedDB) — neither downstream feature may add a handler that
  accepts a port argument from an untrusted caller. (Same guardrail referenced by
  the LOW-2 w2-GC disposition above.)
