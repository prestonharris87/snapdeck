---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
version: 2
written_at: 2026-06-19T16:15:00Z
run_id: run-20260619-150619-36719
sources:
  - decision-memo-v1.md
  - feature.md
  - clarifications.md (C1)
  - stories/STORY-fe-003.md
  - conversations/0028-frontend-architect-to-team-lead-msg.md
  - conversations/0029-contrarian-architect-to-team-lead-msg.md
  - conversations/0031-product-owner-to-team-lead-msg.md
  - conversations/0033-frontend-architect-to-team-lead-msg.md
---

# Decision memo — Per-target in-progress reports (v2: STORY-fe-003 add-story)

## Summary

**Baseline:** `decision-memo-v1.md` covers the planning and arbitration of the
released feature (STORY-fe-001 / fe-002 / be-001 / db-001 / do-001). Those
decisions are not re-synthesized here; v1 is the authoritative record of the
per-port re-key, ownership handoff, and BOSS `node --test` hybrid ruling.

**This memo (v2)** records one post-release addition — STORY-fe-003 — added via
`/mat_add_story` after the feature was merged at PR #1. The story adds a single
DRY helper `emitReportCountChanged(port, count)` called at exactly three
count-mutating sites in `extension/background.js`, writing a
`chrome.storage.session` tick `{ reportCountChanged: { port, count, ts } }` that
the sibling feature `w1-dynamic-icon-badge` will consume to drive its toolbar
badge. The non-obvious aspects: (1) the transport mechanism pivoted from
`chrome.runtime.sendMessage` (originally BOSS-ratified) to `chrome.storage.session`
after the w1-dynamic-icon-badge FE-architect found that `sendMessage` breaks the
frozen released test harness in two ways that cannot be patched without editing
the frozen files; (2) the contrarian identified a test-coverage gap on `saveReport`'s
non-emit branches — three of the four must-not-emit paths lacked a case — which
the PO promoted to acceptance criteria; (3) the tick stream is explicitly
best-effort/lossy by design (fire-and-forget, un-awaited), and BOSS elevated the
consumer reconciliation requirement to a hard design constraint now documented in
STORY-fe-003's `## Consumer note`.

## Stories added in v2

**STORY-fe-003 — Emit `storage.session` report-count tick at 3 sites**
(frontend-engineer · effort 2 · `approved` · `depends_on: [STORY-fe-001]`)

- **What it adds:** a top-level `emitReportCountChanged(port, count)` helper
  (optional-chained write, null-port guard) called at `addScreenshot` (after
  `setReport`), the `saveReport` success-POST branch (after `clearReport`), and
  the `CLEAR_REPORT` handler (after `clearReport`).
- **New file:** `extension/background.emit.test.mjs` (12+ zero-dep `node --test`
  cases; mirrors the frozen vm harness pattern; the two frozen test files are
  untouched).
- **Cross-feature contract (BOSS-ratified, channel-locked):**
  `chrome.storage.session` key `reportCountChanged` = `{ port:<int>, count:<int>,
  ts:<Date.now()> }`. Consumer: `w1-dynamic-icon-badge` STORY-fe-003 (separate
  feature/team, `storage.session.onChanged` key-filtered listener). This emission
  lands and freezes FIRST; the consumer builds on top.
- **Filed via:** clarification C1 (`clarifications.md`); operator (option A),
  relayed by BOSS, 2026-06-19.

**The 4 hard invariants** (per STORY-fe-003 § How we're doing it):
1. Null-port guard in the helper — returns early when `port == null` (load-bearing
   at the `CLEAR_REPORT` site where `currentTargetPort()` can be null).
2. Optional-chaining no-op — `chrome.storage?.session?.set?.(…)` so the module
   loads clean and the emit no-ops under the frozen vm harnesses (no `storage`
   key in `_chromeMock`).
3. Non-breaking — no second `chrome.runtime.onMessage.addListener`; transport is
   `storage.session` ONLY, NOT `runtime.sendMessage` (proposed, found broken,
   superseded).
4. `SET_NOTE` does NOT change count → NO emit there.

## Positions held during planning

### frontend-architect (add-story mode)

- **Authored:** STORY-fe-003 with the 4 hard invariants, 3-site call-site
  analysis, and 12 proposed test cases; verified every `## Existing behavior
  baseline` file:line against `extension/background.js` this run
  (STORY-fe-003 § Existing behavior baseline "Verified").
- **Applied cross-feature contract:** accepted the BOSS-ratified `storage.session`
  transport (NOT `runtime.sendMessage`) and encoded it in the story as a hard
  invariant (STORY-fe-003 § How we're doing it, invariant 3; STORY-fe-003
  § Revisions "storage.session-only").
- **Corrected in conv 0028:** removed erroneous cross-feature story ID from
  `depends_on` (the w1/w0 seam is a channel-locked cross-FEATURE contract, not a
  `depends_on` edge; bare cross-feature IDs collide). Cross-feature linkage
  recorded as prose only (conv 0028).
- **Applied conv 0033:** after PO arbitration, folded in the consumer robustness
  posture for w1-fe-003 — tick as a nudge/not-a-log, cold-start feature-detect-
  guarded re-derive, reconcile-via-`GET_STATE` directive. Reconciled fe-002's
  restart note to avoid contradiction (conv 0033).
- **Persona alignment:** Default-stance additive/defensive; no movement — the
  frozen-test-tolerance constraints were stated upfront and held throughout.

### contrarian-architect

- **Stress-tested:** STORY-fe-003 in single-story add-story mode; the locked
  contract (mechanism + payload) was NOT re-litigated.
- **Findings (0 block / 2 concern / 1 note)** (conv 0029;
  STORY-fe-003 § Contrarian Findings):
  - Finding 1 (concern): the `saveReport` no-emit is tested on only 1 of its 4
    non-emit branches (failed-POST); the no-controller and empty-report early
    returns are uncovered — the highest-value gap, since a future emit-hoist
    refactor would fire a phantom `{count:0}` tick on a save that didn't clear.
  - Finding 2 (concern): the fire-and-forget `.set()` makes the tick best-effort/
    lossy; the consumer CANNOT treat `onChanged` as a complete log.
  - Finding 3 (note): non-exclusive `storage.session` area; ms-resolution `ts`
    blind spot (same-ms identical payload may not fire `onChanged`).
- **Verified-to-dismiss:** the obvious frozen-break vectors (shortcuts suite
  reaching site 1 — no-ops via optional chain; reports suite never reaching a
  handler-based emit site; `node --test` process-isolation per file) (conv 0029).
- **Persona alignment:** Stayed within the locked design throughout; identified a
  concrete test-coverage gap without re-litigating the contract.

### product-owner

- **Arbitration (conv 0031; STORY-fe-003 § Revisions):** Dispositioned all 3
  findings; promoted `status: pending → approved`. No arbitration block.
  - **Finding 1 → PROMOTE_TO_AC:** added BOTH `saveReport_noController_noEmit`
    AND `saveReport_emptyReport_noEmit` to `## Unit tests` (a) and a matching
    `## How we validate` checklist item. Now covers 3 of 4 non-emit branches.
  - **Finding 2 → ACCEPT_AS_RECOMMENDATION:** recorded in new `## Consumer note`;
    directed team-lead to relay reconcile-via-`GET_STATE` requirement to
    `w1-dynamic-icon-badge` over the channel.
  - **Finding 3 → ACCEPT_AS_RECOMMENDATION:** folded into same `## Consumer note`;
    `ts` not swapped for a monotonic counter (contract is locked).
- **Created** `## Stories added (post-release)` H2 in `feature.md` (placed after
  `## Stories`, before `## Defects`); appended the STORY-fe-003 entry with C1
  reference (conv 0031; feature.md § Stories added (post-release)).
- **No peer `## Revisions` block** needed — no in-feature cross-domain contract
  change; the w1 seam is a channel-locked cross-FEATURE contract, not a
  `depends_on` edge (conv 0031).

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Transport mechanism: `runtime.sendMessage` vs `storage.session` | `runtime.sendMessage` tick (initial BOSS-ratified cross-feature contract) | `storage.session` write (w1-FE-architect found `sendMessage` breaks the frozen test harness two ways: 2nd `onMessage` listener overwrites single-capture mock at `background.reports.test.mjs:88`; `chrome.runtime.sendMessage` undefined in mock, throws synchronously) | `storage.session` adopted; BOSS re-ratified; encoded as hard invariant 3 in STORY-fe-003 | C1 ("NOT `runtime.sendMessage` — superseded"); STORY-fe-003 § How we're doing it (invariant 3); STORY-fe-003 § Revisions |
| `saveReport` no-emit test coverage: 1 of 4 non-emit branches vs. all | Initial story covered only `saveReport_failedPost_noEmit` | Contrarian (conv 0029, Finding 1): 3 uncovered early-return paths above the success `if`; a future emit-hoist refactor would silently fire phantom tick | Added `saveReport_noController_noEmit` + `saveReport_emptyReport_noEmit`; covers 3 of 4 non-emit branches | conv 0029 (Finding 1); conv 0031 (PO PROMOTE_TO_AC); STORY-fe-003 § Contrarian Findings |
| Cross-feature linkage in `depends_on`: story ID vs. prose-only | Initial fe-003 draft included a cross-feature story ID in `depends_on` | Bare cross-feature IDs collide (w0 also has a `STORY-fe-003`); the w1/w0 seam is a feature-level contract, not a story edge | Removed ID; linkage recorded as prose in `## Dependencies` and locked via BOSS channel serialization | conv 0028 |

## Tensions accepted as known risk

- **Best-effort/lossy tick stream:** The helper's `.set()` is fire-and-forget (un-
  awaited by design, so released return timing stays decoupled from the storage
  write). Ticks can be lost on MV3 service-worker teardown mid-write; the entire
  `storage.session` area is wiped on session reset / SW backing store reset.
  Accepted because the consumer (`w1-dynamic-icon-badge`) MUST reconcile against
  the released `GET_STATE { count, port }` on a known wake point (popup-open /
  SW-wake) and MUST NOT treat `storage.session.onChanged` as a complete count log.
  BOSS elevated this to a hard design requirement on the consumer. The constraint
  is documented in STORY-fe-003 `## Consumer note`.
  Risk owner: `w1-dynamic-icon-badge` consumer team (design requirement); no
  code change in this producer story.
  Cite: Contrarian Finding 2 (conv 0029); conv 0031 (PO ACCEPT); STORY-fe-003
  § Consumer note.

- **Non-exclusive `storage.session` area + ms-resolution `ts` blind spot:** The
  `reportCountChanged` key shares the `storage.session` area with w1-fe-002's
  `/resolve` cache (different key — safe today; w0 only WRITES, adds no
  `onChanged` listener). `ts: Date.now()` is ms-resolution; two count-changes
  in the same millisecond produce a byte-identical payload that `onChanged` is
  not guaranteed to fire on. Both are realistically rare and absorbed by the
  reconciliation accepted above. The contract is locked; `ts` was NOT swapped
  for a monotonic counter.
  Risk owner: team-lead (recorded, not actioned).
  Cite: Contrarian Finding 3 (conv 0029); conv 0031 (PO ACCEPT); STORY-fe-003
  § Consumer note.

## Alternatives rejected

- **`chrome.runtime.sendMessage` tick:** A `sendMessage`-based push to the popup
  was the initial BOSS-ratified cross-feature contract. Rejected after the
  w1-dynamic-icon-badge FE-architect identified two frozen-test-harness breaks:
  (a) a second top-level `onMessage.addListener` would overwrite the frozen test's
  single-capture mock at `background.reports.test.mjs:88`, hijacking
  `GET_STATE`/`SET_NOTE`/`CLEAR_REPORT` and hanging those suites; (b)
  `chrome.runtime.sendMessage` is undefined in the frozen mock and throws
  synchronously — uncatchable by `.catch()`. Neither break can be fixed without
  editing the frozen files. BOSS re-ratified `storage.session`.
  Cite: STORY-fe-003 § How we're doing it (invariant 3); STORY-fe-003 § Revisions
  ("NOT `runtime.sendMessage`… proposed, found broken, and superseded"); C1
  (transport "NOT `runtime.sendMessage` — superseded").

- **Second `chrome.runtime.onMessage.addListener`:** Rejected for the same
  frozen-test reason as `sendMessage` (the listener-capture mock at
  `background.reports.test.mjs:88` is a bare assignment — a second
  `addListener` call overwrites it, hijacking all released message handlers).
  The emission is `storage.session` write only.
  Cite: STORY-fe-003 § Existing behavior baseline ("Single message listener");
  STORY-fe-003 § How we're doing it (invariant 3).

## Next actions

*(Mirrored from STORY-fe-003 § How we validate — these are the acceptance
criteria for the add-story; the released feature.md criteria are frozen.)*

- [ ] `emitReportCountChanged(port, count)` exists as a top-level helper whose
  FIRST statement is `if (port == null) return;`.
- [ ] The storage write uses optional chaining exactly:
  `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })` —
  no bare `chrome.storage.session.set(...)`.
- [ ] Exactly THREE call sites (`addScreenshot`, `saveReport` success branch,
  `CLEAR_REPORT` handler); no emit in `SET_NOTE`, `GET_STATE`, or the
  error/empty/no-controller `saveReport` paths.
- [ ] Site 1 emits `(port, r.screenshots.length)` after `setReport` and before
  `return { ok:true, count }`, using the `portOfUrl(tab.url)` local.
- [ ] Site 2 emits `(browserPort, 0)` inside `if (res.json && res.json.ok)`
  after `clearReport(browserPort)` — first arg is `browserPort`, not `port`.
- [ ] `saveReport_failedPost_noEmit`, `saveReport_noController_noEmit`, AND
  `saveReport_emptyReport_noEmit` all assert NO tick captured.
- [ ] Site 3 captures `currentTargetPort()` into a local, passes it to BOTH
  `clearReport` and `emitReportCountChanged`; non-target clear emits nothing.
- [ ] No second `chrome.runtime.onMessage.addListener` was added.
- [ ] `node --test extension/*.test.mjs` passes — all 25 frozen cases
  (`background.reports.test.mjs` + `background.shortcuts.test.mjs`) plus the
  new `background.emit.test.mjs` cases are green.
- [ ] The two frozen test files are unchanged (git diff shows no edits to
  `background.reports.test.mjs` / `background.shortcuts.test.mjs`).

## Frozen-test-tolerance design constraint (reusable lesson)

New `background.js` features added post-release MUST be additive under the
no-`storage` / single-`onMessage`-capture vm mock used by the frozen test
harnesses. Specifically: (a) all new `chrome.*` API writes must be
optional-chained so they no-op when the key is absent from the mock; (b) no new
top-level `chrome.runtime.onMessage.addListener` call may be added (it overwrites
the single-capture mock variable). These constraints apply to any future story
that touches `extension/background.js` while the frozen released suites exist.
Cite: STORY-fe-003 § How we're doing it (invariants 2–3); STORY-fe-003
§ Contrarian Findings "Dismissed after reading the code."

## Open questions deferred to implementation

*(None outstanding at add-story planning close.)*

The transport mechanism and payload contract were locked in C1 before architect
dispatch. The only open item (contrarian Finding 1 test gap) was resolved by the
PO via PROMOTE_TO_AC. No `Status: needs-user-input` entries remain in
`clarifications.md`.
