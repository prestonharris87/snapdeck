---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
version: 1
written_at: 2026-06-19T03:30:00Z
run_id: run-20260619-021434-24507
sources:
  - feature.md
  - stories/STORY-fe-001.md
  - stories/STORY-fe-002.md
  - stories/STORY-be-001.md
  - stories/STORY-db-001.md
  - stories/STORY-do-001.md
  - conversations/0001-product-owner-to-main-msg.md
  - conversations/0002-devops-architect-to-team-lead-msg.md
  - conversations/0003-backend-architect-to-team-lead-msg.md
  - conversations/0004-frontend-architect-to-backend-architect-msg.md
  - conversations/0005-frontend-architect-to-database-architect-msg.md
  - conversations/0001-database-architect-to-frontend-architect-msg.md
  - conversations/0006-backend-architect-to-frontend-architect-msg.md
  - conversations/0007-backend-architect-to-team-lead-msg.md
  - conversations/0008-database-architect-to-backend-architect-msg.md
  - conversations/0009-database-architect-to-team-lead-msg.md
  - conversations/0010-frontend-architect-to-team-lead-msg.md
  - conversations/0011-frontend-architect-to-database-architect-msg.md
  - conversations/0012-frontend-architect-to-team-lead-msg.md
  - conversations/0013-frontend-architect-to-team-lead-msg.md
  - conversations/0014-product-owner-to-team-lead-msg.md
  - conversations/0015-frontend-architect-to-main-msg.md
  - conversations/0016-frontend-architect-to-team-lead-msg.md
  - data-model.md (§ w0-per-target-reports)
---

# Decision memo — Per-target in-progress reports

## Summary

This feature re-keys the extension's in-progress report from a single global
IndexedDB record (`snapdeck`/`kv`, key `"report"`) to per-browser-port records
(`report:<browserPort>`) in the same store — no DB version bump, no server-side
change. The non-obvious aspects of how the team got here: (1) a prior wave's
`data-model.md` pointer incorrectly named the database-architect as IndexedDB
report-store owner; the team-lead authoritatively reassigned ownership to the
frontend domain before decompose ran, requiring an explicit handoff conversation
and a `data-model.md` correction. (2) The devops-architect's initial story
claimed a `chrome.storage.session` port-resolution cache would be added; the
frontend-architect's authoritative FE story (STORY-fe-001) decided no such cache
was needed (at-handling-time resolution suffices), leaving a doc-vs-impl
contradiction that the PO caught and reconciled at arbitration. (3) The original
unit-test question — "E2E-only or add a JS harness?" — was initially closed by
the team-lead as E2E-only, then superseded mid-run by a BOSS `node --test`
hybrid ruling; the FE-architect applied it additively without re-arbitration.
(4) The retirement of `saveReport()`'s URL-fallback port derivation was a
logically-forced consequence of per-port keying; the PO accepted and documented
it as a flagged-not-silent intentional change.

## Positions held during planning

### frontend-architect

- **Advocated for:** At-handling-time resolution over a `chrome.storage.session`
  port-resolution cache — simpler, avoids module-level state, sufficient for the
  active-tab seam (STORY-fe-001 § How we're doing it; conv 0010; conv 0011).
- **Advocated for:** Splitting into two stories — STORY-fe-001 (the re-key atom)
  + STORY-fe-002 (additive `GET_STATE.port` field) — so that downstream features
  `w1-dynamic-icon-badge` and `w2-screenshot-gallery` could target the
  cross-feature contract story explicitly (conv 0010).
- **Flagged (not silently dropped):** retirement of `saveReport()`'s
  `portOfUrl(screenshots[0].url)` fallback as an intentional, scope-aligned
  change; chose a clear error over a silently-incorrect port derivation
  (STORY-fe-001 § Existing behavior baseline "Explicitly changing"; conv 0010).
- **Applied BOSS ruling post-arbitration:** `node --test` hybrid unit lane added
  additively (test file `extension/background.reports.test.mjs`, `node:vm`
  harness) without re-arbitration; stories remained `status: approved`
  (conv 0015, conv 0016).
- **Persona alignment:** Default-stance defensive (no module state, no extra
  port-derivation path, region-isolated footprint in shared file); final position
  stayed there throughout — no movement.

### backend-architect

- **Advocated for:** Grounded sentinel — confirmed the controller is a clean
  no-op against actual code (`reports.py:44-60` `/resolve`; `reports.py:108-181`
  `/report/save`), not just scope.md claims (conv 0003, conv 0006).
- **Reinforced:** `browser_port` must stay derived from `portOfUrl(activeTab.url)`
  in `saveReport()` — the controller's `resolve_owner` matches that port against
  a live worktree's `browsable_ports`; any other derivation path would break
  owner resolution (conv 0006).
- **Confirmed:** No double-authoring on `extension/background.js`; the FE owns
  the entire file for this feature (conv 0006, conv 0007).
- **Persona alignment:** Code-verified sentinel; no movement or tension with FE.

### database-architect

- **Advocated for:** Grounded sentinel + explicit ownership handoff — identified
  that the prior `data-model.md` pointer misassigned the IndexedDB report-store
  to the server-side DB domain; proactively handed off to FE and recorded a
  FOR-REFERENCE map in `data-model.md` rather than leaving a gap
  (conv 0001-database-architect-to-frontend-architect-msg.md; STORY-db-001
  § Cross-domain contract).
- **Confirmed:** `screenshots[].model` (from sibling `w0-editor-foundation`) is
  orthogonal to the per-port re-key and survives transparently via structured-
  clone carry-through (conv 0008, conv 0009).
- **Persona alignment:** Proactive boundary clarification; no tension with FE —
  handoff was cooperative and fast.

### devops-architect

- **Advocated for:** Sentinel — verified `manifest.json` line 6 already grants
  `storage` + `unlimitedStorage`; no host permission or build/CI surface touched
  (conv 0002, STORY-do-001 § Rationale).
- **Stated (incorrectly in initial draft):** the feature "adds a cross-tab
  port-resolution cache in `chrome.storage.session`" — this was a doc-vs-impl
  inconsistency vs. the authoritative FE story, reconciled by the PO at
  arbitration (STORY-do-001 § Revisions).
- **Persona alignment:** The no-devops-work verdict was correct regardless of the
  cache point; the error was scoping detail, not the sentinel conclusion.

### product-owner

- **Arbitration decisions:** Promoted all 5 stories `pending → approved` with
  no deadlock (conv 0014). Actions taken:
  - Recorded the `saveReport()` fallback retirement as a PO-accepted, team-lead-
    ratified intentional change in STORY-fe-001 § Revisions.
  - Reconciled DO-001's doc-vs-impl mismatch (session cache claim vs. FE's
    no-cache decision) in STORY-do-001 § Revisions; approved verdict unchanged.
  - Added required `- [ ]` validate-checklist items to each of the 3 sentinels
    (STORY-be-001 had no validate section at all) (conv 0014).
  - Updated `feature.md` § Stories to list all 5 approved stories.
- **Flagged pre-decompose:** the `saveReport()` load-order tension
  (`portOfUrl(screenshots[0].url)` must resolve a port before the record can be
  read) as a judgment call left to the architects; correctly did not pre-decide it
  (conv 0001).

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| IndexedDB report-store ownership: DB domain vs FE domain | Prior `data-model.md` pointer named database-architect as owner | FE-architect holds all extension JS, including IndexedDB helpers | Team-lead authoritatively reassigned to FE domain; DB-architect wrote sentinel + FOR-REFERENCE map and handed off | data-model.md § ownership-correction; conv 0001-database-architect-to-frontend-architect-msg.md; STORY-db-001 § Cross-domain contract |
| `saveReport()` fallback retirement: explicit error vs legacy recovery | Legacy `portOfUrl(screenshots[0].url)` fallback allowed save from non-target tab (old `background.js:149`) | Per-port keying requires the key before the record is read — logically incompatible with URL-fallback derivation | FE-architect intentionally retired the fallback; non-target `SAVE_REPORT` now returns existing "could not determine" error; scope-aligned | STORY-fe-001 § Existing behavior baseline "Explicitly changing"; STORY-fe-001 § Revisions (PO-accepted); conv 0010; conv 0014 |
| `chrome.storage.session` cache: DO-001 claim vs FE-001 design | DO-001 rationale claimed a session cache would be added (covering `storage` permission) | FE-architect decided at-handling-time resolution from active tab — no cross-tab cache needed, so nothing to persist | FE-001 is authoritative; DO-001 Revisions block reconciled; no-devops verdict unchanged | STORY-do-001 § Revisions; STORY-fe-001 § How we're doing it; conv 0014 |
| Unit-test coverage: E2E-only vs JS unit harness | FE-architect asked for team-lead decision (open question, conv 0010, 0012) | Team-lead initially closed as "E2E-only for this wave; no devops story" (conv 0013) — then superseded | BOSS hybrid ruling issued post-arbitration: `node --test` unit lane added additively; stories kept `approved` status | conv 0013 (initial close); conv 0015/0016 (BOSS ruling applied); STORY-fe-001/fe-002 § Unit tests |

## Tensions accepted as known risk

- **Legacy `"report"` key abandoned without migration:** The pre-epic global
  `"report"` IndexedDB key is not read forward; it may be discarded on upgrade.
  A single-worktree user upgrading mid-session will lose any in-progress report
  data under the legacy key. The team accepted this explicitly as out of scope.
  Risk owner: product-owner / frontend-architect.
  Cite: feature.md § Out of scope; STORY-fe-001 § How we're doing it
  "No migration."

- **Shared-file merge hazard (`background.js`) with sibling wave-0 features:**
  Both this feature (helpers + handlers) and `w0-keyboard-shortcuts`
  (`chrome.commands.onCommand` listener) write to `extension/background.js`.
  The footprints are region-isolated but must be flagged at the push window.
  No resolution mechanism defined beyond the flag itself.
  Risk owner: frontend-architect / team-lead.
  Cite: STORY-fe-001 § How we're doing it "Shared-file merge note"; conv 0010.

## Alternatives rejected

- **`chrome.storage.session` port-resolution cache:** A cross-tab cache for the
  resolved port (floated in DO-001's initial rationale and implicit in the
  `chrome.storage.session` scope.md clause) was rejected by the FE-architect
  in favor of at-handling-time resolution from the active tab. Reason: the
  at-handling-time approach is simpler, avoids module-level state, and the
  active-tab seam is always available when a message arrives — no cross-tab state
  is needed. The `chrome.storage.session` rule remains in the scope as a
  constraint that fires only if a future change does introduce a cache.
  Cite: STORY-fe-001 § How we're doing it; conv 0011.

- **Single story for the full re-key + `GET_STATE.port` field:** Combining
  STORY-fe-001 and STORY-fe-002 into one was rejected by the FE-architect.
  Reason: splitting isolates the additive cross-feature contract (`GET_STATE`
  → `{count, note, port}`) as a distinct dependency target for `w1-dynamic-icon-
  badge`, and makes the per-port keying atom (fe-001) independently validatable.
  Cite: conv 0010 "Split rationale."

- **`await import()` unit harness** (vs `node:vm` context load): Rejected for
  the HYBRID unit lane because `import()` cannot reach the unexported helpers
  (`getReport(null)`, `currentTargetPort()`) without adding `export` statements,
  which would force a `manifest.json` `type: module` change — a
  `files_not_modified` violation. The `node:vm`-load approach pre-seeds stubs
  before evaluating `background.js` and exposes the top-level declarations
  without modifying the source.
  Cite: conv 0016 (harness rationale); STORY-fe-001 § Unit tests.

- **Devops story to stand up a JS unit harness:** Rejected by the team-lead
  for this wave (conv 0013: "E2E-only coverage accepted, no devops story;
  epic-shared test-infra call for BOSS, not this feature"). Superseded by the
  BOSS `node --test` hybrid ruling, which achieved the same end without a
  devops story (zero-dep, no `package.json`, same convention as existing
  framework scripts).
  Cite: conv 0013; conv 0015.

## Next actions

*(Mirrored from feature.md § Acceptance criteria)*

- [ ] The in-progress report is persisted under a per-port IndexedDB key
  `report:<browserPort>` in the existing `snapdeck`/`kv` object store — not the
  single global `"report"` key. No IndexedDB version bump.
- [ ] `<browserPort>` is derived from the active tab's URL via the existing
  `portOfUrl(url)` helper. No second port-derivation path is introduced.
- [ ] `getReport(port)` / `setReport(port, r)` / `clearReport(port)` are
  port-scoped; the empty-record default stays `{ note: "", screenshots: [] }`.
- [ ] Capturing a screenshot on a tab at port A appends only to `report:A`;
  capturing on port B appends only to `report:B`.
- [ ] `SET_NOTE` writes the note only to the current target's report;
  `CLEAR_REPORT` clears only the current target's record.
- [ ] `SAVE_REPORT` loads and POSTs the current target's report; on a successful
  save clears only that port's record; the payload's `browser_port` equals the
  resolved current-target port.
- [ ] `GET_STATE` returns `{ count, note, port }` for the current target; on a
  non-localhost tab returns `{ count: 0, note: "", port: null }`.
- [ ] Caller-facing signatures are unchanged: `addScreenshot()` and `saveReport()`
  remain zero-arg; message-API payloads are unchanged.
- [ ] Per-port reports persist in IndexedDB and survive a service-worker restart;
  no module-level report state.
- [ ] No migration of pre-epic global report data — the legacy `"report"` key is
  not read forward.
- [ ] The existing localhost/controller guards, the controller `/resolve` +
  `/report/save` contract, and the saved `report.json` projection are unchanged.

## Open questions deferred to implementation

*(None outstanding at planning close.)*

The unit-harness question (open during decompose, conv 0010) was fully resolved
by the BOSS `node --test` hybrid ruling and applied to stories before the phase
boundary (conv 0015/0016). No open questions with `Status: needs-user-input`
remain at this writing.
