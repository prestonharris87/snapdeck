---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
version: 1
written_at: 2026-06-20T00:00:00Z
run_id: run-20260620-161818-88519
sources:
  - feature.md
  - scope.md
  - stories/STORY-fe-001.md
  - stories/STORY-fe-002.md
  - stories/STORY-fe-003.md
  - stories/STORY-be-001.md
  - stories/STORY-db-001.md
  - stories/STORY-do-001.md
  - stress-test.md
  - conversations/0001-backend-architect-to-frontend-architect-msg.md
  - conversations/0002-database-architect-to-frontend-architect-msg.md
  - conversations/0004-devops-architect-to-frontend-architect-msg.md
  - conversations/0007-backend-architect-to-frontend-architect-msg.md
  - conversations/0009-backend-architect-to-team-lead-msg.md
  - conversations/0015-contrarian-architect-to-team-lead-msg.md
  - conversations/0017-product-owner-arbitration-decisions.md
  - conversations/0018-product-owner-to-team-lead-msg.md
---

# Decision memo — Screenshot gallery (review, re-open / edit, delete)

## Summary

`w2-screenshot-gallery` turns a write-only capture surface (the popup previously
showed only a count) into a reviewable, correctable report: the developer can see
thumbnails, re-open a shot in the released in-page editor for lossless re-edit,
replace it via `✓ Done`, or delete it behind a confirmation step. What was
non-obvious in planning was that the feature decomposes into two independent safety
contracts that are easy to conflate: (1) the **field-preserve corruption lock** —
re-save must take only `model`/`annotated`/`annotations` from the editor response and
preserve `original`/`console`/`network`/`meta` from the stored record (because the
editor's Done payload emits fresh/live tab values, not capture-time values); and
(2) the **stable-identity corruption lock** — all three handlers must address records
by a synthesized stable identity (`sid`), not by array index, because the popup is
re-openable while a re-edit overlay is still active, meaning a sibling delete can
splice the array under a long-lived in-flight re-save. The field-preserve contract was
correctly specified by the frontend-architect from the start; the stable-identity
requirement was a contrarian block that the PO resolved by revision (no
acknowledged-risk path, because the fix was cheap, already in scope, and required no
released-code change). Three BE/DB/DO sentinels complete the story set; all were
peer-confirmed by the frontend-architect before finalization.

## Positions held during planning

### frontend-architect

- **Advocated for:** three zero-port-arg message handlers in `background.js` (fetch,
  re-open+re-save, delete) plus a presentational popup grid; the preserve-from-record
  contract (overwrite only `model`/`annotated`/`annotations`; preserve `original`,
  `console`, `network`, `meta` by construction); a new `deleteReport(port)` /
  `idbDelete(key)` helper for true key-removal on delete-to-empty (rather than
  repointing `clearReport`); pre-flight PING for no-host detection; inherited render
  guards verbatim. (STORY-fe-001 § "What it should look like", STORY-fe-002 §
  "Why the preserve contract is load-bearing")
- **Initially used array-index addressing** across `GET_REPORT_SCREENSHOTS`,
  `DELETE_SCREENSHOT`, and `REOPEN_SCREENSHOT`; the index-stability claim ("while
  the overlay is open the popup is closed") was verified false by the contrarian and
  corrected in revision. (STORY-fe-002 § Revisions)
- **Peer-confirmed to BE/DB/DO:** `background.js` is FE/extension-owned; controller
  is untouched; no new content-script file, no `importScripts`, no new permission,
  data-URL thumbnail CSP OK under default MV3 `extension_pages` policy.
  (conv 0007, conv 0009)
- **Persona alignment:** largely consistent with DEFAULT_STANCE; the index-addressing
  claim was an incorrect premise (not a different preference), corrected cleanly in
  revision without resistance.

### backend-architect

- **Advocated for:** controller-only sentinel; explicitly named the ownership boundary
  — `background.js` + `popup/*` + IndexedDB are FE-owned; controller Python code
  (`/resolve`, `/report/save`, `report.json` projection at `reports.py:139-172`) is
  byte-frozen. (conv 0001, conv 0009; STORY-be-001 § "Why this is a sentinel")
- **Peer coordination:** sent first (proactive Phase-5 floor message before writing
  the sentinel), received FE confirmation that the gallery edits local IndexedDB only
  and the controller is untouched. (conv 0001, conv 0007)
- **Persona alignment:** consistent; sentinel disposition was clean and never changed.

### database-architect

- **Advocated for:** sentinel; no new IndexedDB store, index, or version bump; the
  gallery's mutations are value-level ops on the existing `snapdeck`/`kv` store (`{
  note, screenshots[] }` shape unchanged); the `deleteReport(port)` / `idbDelete(key)`
  GC-on-empty is additive value/key-level, not a schema change; IDB ownership is
  FE/extension-domain per the `data-model.md` ownership correction.
  (conv 0002; STORY-db-001 § "Cross-domain confirmation")
- **Persona alignment:** consistent; noted the `data-model.md` ownership correction
  to keep scope clear.

### devops-architect

- **Advocated for:** sentinel; audited `manifest.json` at HEAD; every seam the gallery
  consumes (runtime messaging, `chrome.tabs.sendMessage(ANNOTATE)`, `chrome.storage`,
  popup, editor content-script stack, data-URL `img-src`) is already registered and
  permissioned; four manifest-adjacent items (new CS file, new SW module, new
  permission, CSP) all confirmed clean by FE. (conv 0004; STORY-do-001 § "Peer-message
  confirmation")
- **Persona alignment:** consistent; sentinel locked after FE peer reply.

### security-architect

- **Did not run during Phase 5.5** (security-architect is a Phase-7 role for this run).
  The contrarian explicitly flagged the bounded-model question (fe-002 Finding 2) for
  Phase-7 STRIDE re-confirm. The standing guardrail — do NOT weaken
  `RENDER_ITEM_CAP=500` / `RENDER_TEXT_CAP=10000` — is recorded in the PO arbitration
  doc and the feature.md AC. (conv 0017 § "Info findings"; stress-test.md §
  "Security pointer")

### contrarian-architect

- **Raised 1 block, 1 concern, 4 info findings** across the FE story set.
- **Block (fe-002 F1):** stale-index re-save silently corrupts a bystander record when
  a mid-edit sibling delete splices the array; verified the index-stability premise
  false against released code (`editor.js:13-16,33-40`; `background.js:284-295`).
  Recommended revision to stable-identity addressing (fix site: fe-001 projection;
  already in scope per "by index/**id**"). (conv 0015; stress-test.md §1)
- **Concern (fe-001 F1):** index-addressing is the root cause across all three handlers
  — recommend revise in lockstep with fe-002. (STORY-fe-001 § "Contrarian Findings",
  Finding 1)
- **Info items:** GC only removes the key on delete-to-empty (Save/Clear still keep
  empty keys — scope the claim precisely); DELETE joins the pre-existing unlocked
  read-modify-write set; re-open target can diverge from grid in multi-window/tab-switch;
  unbounded full-res thumbnail payload; fe-002 F2 (`resp.model` verbatim persistence →
  bounded-at-render ≠ bounded-envelope → Phase-7 question).
- **Persona alignment:** consistent adversarial role; the block was the only item that
  required a disposition gate; concern and info items were handled by the PO at arbitrate.

### product-owner

- **Arbitration decisions:** (conv 0017, conv 0018)
  - **fe-002 F1 (block) → RESOLVED BY REVISION** (not Acknowledged Risk): verified
    against released code that `captured_at` + `original` are stored and preserved by
    `resaveScreenshot` → stable `sid` synthesizable with zero released-code change;
    acknowledging silent corruption when a free in-scope fix exists would be the wrong
    call. Revised all three FE stories in lockstep; promoted to feature.md ACs and a
    Konva-lane E2E so the guard is validator-enforceable.
  - **fe-001 F2 (GC over-claim) → ACCEPTED; scoped precisely:** Delete bounds PNG/payload
    bloat and removes the key on delete-to-empty; does NOT GC the empty-record keyspace
    left by Save/Clear (that touches the released keying contract — out of scope).
    Decision-memo must carry that qualifier.
  - **fe-002 F2 (verbatim `resp.model`) → DEFERRED to security-architect Phase 7:**
    bounded-at-render ≠ bounded-envelope; same-origin extension IDB → defense-in-depth,
    not externally-reachable DoS. Standing guardrail: caps not weakened.
  - **fe-002 F3 (active-tab/multi-window divergence) → ACCEPTED; hardened for free**
    by the block fix (foreign `sid` → fail-safe no-op vs silent wrong-target re-open).
  - **fe-003 F2 (full-res thumbnail payload) → ACCEPTED for v1** with named re-trigger:
    if large-report popup latency observed → `OffscreenCanvas` downscale in fe-001's
    projection (fe-001-local, no fe-003 contract impact).
  - Performed gate checks: baseline sections present on substantive stories; db-001
    validate items converted prose → `- [ ]`; `depends_on` valid and consistent.
    (conv 0017 § "Gate checks")

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Mutation handle: array index vs. stable identity | FE-architect: index is sufficient ("popup is closed while overlay is open") | Contrarian: premise false; popup re-openable mid-edit; array splice → silent bystander-record write | Revision to stable `sid` = `screenshotId(captured_at + original fingerprint)`; no-match → fail-safe no-op | conv 0017 § "The BLOCK"; STORY-fe-001 § Revisions; STORY-fe-002 § Revisions |
| GC mechanism: key-removal vs. empty-record write | scope.md said "clear the record" (ambiguous); FE-architect interpreted as true key-removal via new `deleteReport()`/`idbDelete()` | Contrarian: the dominant Save/Clear paths still keep empty keys via `clearReport`→`setReport(EMPTY_REPORT())` | New `deleteReport`/`idbDelete` adopted for delete-to-empty only; `clearReport` and its two call sites left untouched; GC claim scoped to PNG/payload bloat | STORY-fe-001 § "GC helper lock"; conv 0017 § "fe-001 F2 (GC over-claim)" |
| "Lossless" definition: model-byte vs. pixel identity | Could interpret "re-opens exactly" as pixel/screenshot diff guarantee | scope.md Critical directive §3 explicitly scoped to `deepEquals(model.items)` only | Model-byte (not pixel): cross-env canvas wrap can differ; feature.md ACs all cite `deepEquals` / `model-byte identical` | scope.md §3 "Critical directives"; feature.md § "Acceptance criteria" |
| Re-save field-source: editor response vs. stored record | A naive `addScreenshot`-style rebuild (takes `resp.meta`/`resp.console`/`resp.network`) would corrupt capture-time data | FE-architect: take ONLY `model`/`annotated`/`annotations` from editor; preserve the rest from the stored record by construction | Preserve-from-record contract: only three fields overwritten; six preserved fields never touched by re-save | STORY-fe-002 § "Why the preserve contract is load-bearing" (verified against editor.js:489-501) |
| DB-001 validate items format | Story had prose bullets | PO gate check: required `- [ ]` items | Prose converted to `- [ ]` (no content change) | conv 0017 § "Gate checks" |

## Tensions accepted as known risk

- **Unlocked read-modify-write on the IDB record:** `DELETE_SCREENSHOT` joins the
  released `getReport → mutate → setReport` set already shared by `addScreenshot` /
  `SET_NOTE` / `saveReport`. Two handlers interleaving at their `await` points → last-
  writer-wins (one mutation silently dropped). Pre-existing architectural property; a
  store-wide IDB lock is out of scope. The stable-identity fix narrows the
  *user-visible* corruption window (a dropped delete is a re-fetchable count blip, not
  a Frankenstein record). · risk owner: frontend-architect.
  Cite: STORY-fe-001 § "Contrarian Findings" F3; conv 0017 § "fe-001 F3 (pre-existing
  conscious awareness)".

- **Active-tab/multi-window divergence:** if the active target changes between gallery
  render and tile click, `reopenScreenshot` re-resolves `currentTargetPort()` fresh and
  will likely find no `sid` match in the now-current target → fail-safe `{error}` no-op.
  Residual risk (two different targets holding a shot with identical `captured_at` +
  `original`) is effectively impossible across distinct captures. Chrome's focus-close of
  the popup already mitigates the trigger. · risk owner: frontend-architect.
  Cite: STORY-fe-002 § "Contrarian Findings" F3; conv 0017 § "fe-002 F3".

- **bounded-at-render ≠ bounded-envelope (deferred, not accepted):** `resaveScreenshot`
  persists `resp.model` verbatim; a model bounded at render by the inherited caps
  (`RENDER_ITEM_CAP=500`, `RENDER_TEXT_CAP=10000`) is nonetheless stored in full and
  re-deserialized on the next re-open. Envelope growth across re-edits is unbounded by
  construction. Deferred (not accepted as permanent risk) to security-architect Phase-7
  STRIDE for "bounded end-to-end" re-confirm. Standing guardrail: caps must NOT be
  weakened. · risk owner: security-architect (Phase 7).
  Cite: STORY-fe-002 § "Contrarian Findings" F2; conv 0017 § "fe-002 F2 (DEFERRED)".

- **Full-res thumbnail payload, no count cap:** `GET_REPORT_SCREENSHOTS` ships the
  stored `annotated || original` PNG per shot (full resolution, CSS-scaled); fine for
  typical small reports. Named re-trigger: if large-report popup open latency is
  observed, the mitigation is `OffscreenCanvas` downscale in fe-001's projection (no
  fe-003 contract impact). · risk owner: frontend-architect.
  Cite: STORY-fe-003 § "Contrarian Findings" F2; conv 0017 § "fe-003 F2".

## Alternatives rejected

- **Index addressing with Acknowledged Risk:** the contrarian proposed this as an option
  if the team elected not to fix the block. Rejected by PO because the fix is cheap,
  already in scope (scope.md specifies the API "by index/**id**"), and requires no
  released-code change — acknowledging silent data corruption under those conditions
  would be the wrong call. Cite: conv 0017 § "The BLOCK".

- **In-flight re-edit lock (SW tracks `{port, index}`, DELETE refuses while pending):**
  contrarian mentioned this as an alternative to identity-addressing. Rejected in favor
  of `sid` addressing (cleaner, hardens the delete handler too, no new SW-internal state
  to manage). Cite: STORY-fe-002 § "Contrarian Findings" F1 ("Alternatively the SW
  tracks an in-flight-reedit lock…").

- **SW-side thumbnail resize (OffscreenCanvas downscale in fetch handler):** would
  return small thumbnail data-URLs while keeping full-res `original`/`annotated` in the
  store for re-open. Not adopted for v1 to keep the arbitration round focused on the
  load-bearing stable-identity block; preserved as the named re-trigger if large-report
  latency is observed. Cite: STORY-fe-003 § Revisions F2; conv 0017 § "fe-003 F2".

- **Presentational fix for the re-openable popup (hide gallery mid-edit):** explicitly
  rejected; the popup has no signal that an overlay is open on the page. Not the fix
  site; fix lands in fe-001/fe-002 via identity-addressing. Cite: STORY-fe-003 §
  "Contrarian Findings" F1; conv 0017 § "fe-003 F1".

- **Repointing `clearReport` call sites (Save/Clear) to `deleteReport`:** would bound
  the empty-record keyspace too, but touches the released keying contract
  (`getReport`/`setReport`/`clearReport` consumed as released — explicitly out of
  scope). Rejected; `deleteReport` is called ONLY from the new `DELETE_SCREENSHOT`
  handler. Cite: STORY-fe-001 § "GC helper lock".

## Next actions

Mirror of feature.md acceptance criteria (authoritative source):

- [ ] **Gallery render.** Popup renders one thumbnail per screenshot in the current
  target's `report:<browserPort>` report, in capture order, via a new zero-port-arg
  background message returning `{ index, sid, thumbnail-source, light meta }`.
- [ ] **Empty state.** Non-target tab (`currentTargetPort()` → `null`) or an empty
  report renders an empty state with zero thumbnails; fetch returns `screenshots: []`.
- [ ] **Click → lossless re-open (model-byte).** Clicking a thumbnail re-opens via the
  released seam `ANNOTATE { image: shot.original, model: shot.model }` →
  `openEditor(image, model)` → `deserializeModel` (opaque pass-through) → guarded
  `render()`; deserialized `model.items` `deepEquals` stored `shot.model.items`.
- [ ] **Overlay reuse, inherited guards, page-independent.** Re-open reuses the existing
  overlay at screenshot-native sizing on the current target tab; the original page need
  not be live. Re-open **inherits** `RENDER_ITEM_CAP=500` / `RENDER_TEXT_CAP=10000`
  and text-box clamp verbatim — no guard bypass, fork, or re-implementation.
- [ ] **Graceful no-host / busy.** No content-script host → existing reload-the-page
  error (mirrors `background.js:280`); overlay already open → no-op
  (`{cancelled:true, busy:true}`), not a double-mount.
- [ ] **Done re-saves / replaces (model-byte).** `✓ Done` replaces the record: `model`
  model-byte identical to emitted `{version:1, items}`; `annotated` + `annotations`
  re-rendered; `original` **unchanged** (same stored PNG); `console` / `network` /
  `url` / `title` / `captured_at` / `viewport` **preserved from the pre-edit record**
  (NOT overwritten by re-edit host-tab live buffers/meta). All other screenshots
  untouched.
- [ ] **Delete behind a confirm.** Destructive per-thumbnail control gated behind a
  confirmation step; confirming removes exactly that screenshot; cancelling changes nothing.
- [ ] **Count + badge update on delete.** Confirmed delete decrements count and emits
  `REPORT_COUNT_CHANGED` (the `chrome.storage.session` tick from `w0-per-target-reports`
  STORY-fe-003); re-save does NOT change the count.
- [ ] **GC — Delete owns cleanup.** A delete that empties the report removes the
  `report:<port>` IDB key via `deleteReport(port)` / `idbDelete(key)`; `getReport(port)`
  reads as empty (`screenshots.length === 0`, count `0`). NOTE: this only bounds the
  PNG/payload bloat — the empty-record keyspace left by Save/Clear is not GC'd (out of
  scope, keying contract unchanged).
- [ ] **Bounded arbitrary-model re-open (security).** Re-opening a hostile/oversized
  stored `model` renders bounded — no throw, no hang, no `console.error` — via inherited
  guards. Caps not weakened.
- [ ] **No mid-edit wrong-record corruption (stable-identity).** All three handlers
  address records by `sid` = `screenshotId(captured_at + original fingerprint)`, never
  by array index; a mid-edit sibling delete never corrupts a bystander record;
  re-save for a `sid` that no longer resolves is a fail-safe no-op.
- [ ] **Zero-port-arg, stable-identity API / two-port isolation.** Handlers resolve port
  internally via `currentTargetPort()`; callers pass `sid` only; an identity-scoped
  mutation in target A never touches target B's `report:<port>` record.
- [ ] **Out-of-scope untouched.** `editor.js` draw/render/shape logic, model envelope /
  `deserializeModel` / render-boundary guards, and the per-port report-store keying
  contract are consumed as released — not modified.

## Open questions deferred to implementation

- **Security-architect Phase 7 STRIDE re-confirm:** verify that re-opening a stored
  model is "bounded end-to-end" (not just bounded-at-render by the inherited caps) —
  i.e. that envelope growth across multiple re-edits does not open a practical DoS vector
  in the same-origin extension IDB context. Standing guardrail: do NOT weaken
  `RENDER_ITEM_CAP=500` / `RENDER_TEXT_CAP=10000`. (STORY-fe-002 § Revisions F2;
  conv 0017 § "fe-002 F2 (DEFERRED)")
