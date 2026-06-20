---
type: story
id: STORY-fe-001
name: "Gallery fetch + delete report-screenshot handlers + GC"
domain: frontend
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
diff_estimate: substantive
frontend_lane: N/A
visual_references: []
created_at: 2026-06-20T16:30:00Z
last_run_id: run-20260620-161818-88519
---

# Story: Gallery fetch + delete report-screenshot handlers + GC

## What we're doing

Add two new **zero-port-arg** message handlers to the extension service worker
(`extension/background.js`) that the popup gallery (STORY-fe-003) consumes:
(1) **`GET_REPORT_SCREENSHOTS`** — returns the current target's `report:<port>`
`screenshots[]` projected to `{ index, sid, thumbnail, light-meta }` for the grid
(the `sid` is a **stable per-screenshot identity** — see "Stable-identity addressing"
below; the array `index` is display-ordering only);
(2) **`DELETE_SCREENSHOT`** — removes one screenshot **by stable identity (`sid`)**
from the current target's report, then emits the `REPORT_COUNT_CHANGED` tick so the
icon badge repaints. Both resolve the current target port **internally** via the
released `currentTargetPort()` — callers pass a **`sid` only, never a port** (write-key ≡
read-key, exactly as `addScreenshot()`/`saveReport()` already do). This story also
owns the **GC home** decision (see "GC helper lock" below): a delete that empties
the report truly removes the `report:<port>` IDB key rather than leaving an empty
record behind; and it owns the **stable-identity projection** that the delete /
re-open / re-save handlers (this story + fe-002) all address records by.

## What it should look like

Two new `case` branches inside the **existing** `handle(msg)` switch
(`background.js:231-258`), reached through the **existing** single
`chrome.runtime.onMessage` listener (`background.js:112-115`). **No new top-level
listener** is added (a second `onMessage`/`storage.onChanged` registration breaks
the frozen released vm suites — see Unit tests).

### `GET_REPORT_SCREENSHOTS` (read; non-mutating)

```js
case "GET_REPORT_SCREENSHOTS": {
  const port = await currentTargetPort();          // released SSOT; non-target → null
  const r = await getReport(port);                 // port==null → EMPTY_REPORT(), NO idb read
  return {
    port,
    screenshots: r.screenshots.map((s, index) => ({
      index,                                        // DISPLAY ordering only — NOT the mutation handle
      sid: screenshotId(s),                         // STABLE identity (captured_at + original fingerprint) — the mutation handle
      thumbnail: s.annotated || s.original,         // annotated PNG; fall back to original when no annotations
      url: s.url, title: s.title, captured_at: s.captured_at,
      hasAnnotations: !!(s.annotations && s.annotations.length),
    })),
  };
}
```

### Stable-identity addressing (resolves fe-002 Finding 1 [block] + fe-001 Finding 1)

The released capture record (`addScreenshot`, `background.js:284-295`) carries **no
`id` field** — array index was the only handle, and index is **not stable** under a
mid-edit splice (the popup is re-openable while an in-page re-edit overlay is active,
so a `Delete` of a lower-index sibling shifts the array under an in-flight re-save →
silent wrong-record corruption; see fe-002 Finding 1). Scope sanctions the fix: the API
is specified **"by index/id"**. This story synthesizes a stable identity from fields
that are **already stored AND preserved across re-save** (`captured_at`, tie-broken by
an `original`-bytes fingerprint) — **no released-code change**:

```js
// Stable per-screenshot identity. Both inputs are preserved by resaveScreenshot
// (fe-002), so the identity survives a re-save AND an array splice → it, not the
// array index, is the mutation handle for delete / re-open / re-save.
function screenshotId(s) {
  // captured_at is primary; append a cheap original-bytes fingerprint so two shots
  // captured in the same millisecond stay distinguishable. (Engineer may pick a
  // stronger deterministic fingerprint; it MUST derive only from preserved fields.)
  const orig = s.original || "";
  return `${s.captured_at}|${orig.length}:${orig.slice(-24)}`;
}
// Resolve a stable identity to its current array position in a freshly-read report.
// Returns -1 when the shot is gone (deleted mid-edit / not in this target) → callers
// fail safe (no throw, no wrong-record write).
function indexOfScreenshotId(r, sid) {
  return r.screenshots.findIndex((s) => screenshotId(s) === sid);
}
```

- **Non-target / empty report** → `currentTargetPort()` returns `null` →
  `getReport(null)` returns `EMPTY_REPORT()` (no IDB read, `background.js:41`) →
  `screenshots: []`. The popup renders its empty state. No throw, no port leak.
- `thumbnail` is the stored base64 data-URL (`annotated` when present, else
  `original`). The popup scales it down with CSS (`object-fit`) — **no SW-side
  resize**. Light meta (`url`/`title`/`captured_at`) is for tile tooltips/labels.

### `DELETE_SCREENSHOT` (mutating; index-scoped; GC home)

```js
case "DELETE_SCREENSHOT": {
  const port = await currentTargetPort();
  if (port == null) return { error: "no current Snapdeck target tab" };  // defensive; popup never reaches this
  const r = await getReport(port);
  const index = indexOfScreenshotId(r, msg.sid);   // match by STABLE IDENTITY, never array position
  if (index < 0) {
    return { error: "no such screenshot" };         // already deleted / not in current target → fail-safe no-op
  }
  r.screenshots.splice(index, 1);                  // remove exactly that one
  if (r.screenshots.length === 0) {
    await deleteReport(port);                       // GC: remove the report:<port> KEY (lock decision)
  } else {
    await setReport(port, r);                       // shrink the record
  }
  emitReportCountChanged(port, r.screenshots.length);  // new count (0 when emptied) → badge repaints
  return { ok: true, count: r.screenshots.length };
}
```

### New IDB + report helpers (additive; released seams untouched)

```js
// mirror idbGet/idbSet (background.js:18-33) — a 'readwrite' delete transaction
async function idbDelete(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite").objectStore("kv").delete(key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// GC: truly remove report:<port>. Null-guarded like setReport (never act on a null port).
async function deleteReport(port) {
  if (port == null) return;
  await idbDelete(reportKey(port));
}
```

## Existing behavior baseline

- **Currently:** `background.js:231-258` — `handle(msg)` switches on `GET_STATE`,
  `SET_NOTE`, `ADD_SCREENSHOT`, `SAVE_REPORT`, `CLEAR_REPORT`; there is **no**
  read-the-screenshots or delete-by-index message. The popup can only read the
  count (`GET_STATE` → `{count, note, port}`, `background.js:233-238`).
- **Dispatch path / call graph:** popup `chrome.runtime.sendMessage`
  (`popup.js:4`) → SW `chrome.runtime.onMessage` listener (`background.js:112-115`)
  → `handle(msg)` → `currentTargetPort()` (`:78-83`, the localhost-gated SSOT) →
  `getReport(port)` (`:40-43`) / `setReport(port, r)` (`:44-47`) /
  `clearReport(port)` (`:48`) → `idbGet`/`idbSet` (`:18-33`) →
  `emitReportCountChanged(port, count)` (`:53-56`) → `chrome.storage.session.set`
  tick consumed by the w1 badge listener (`:468-471`).
- **No-regression assertion:** the released seams stay **byte-identical** —
  `getReport`/`setReport`/`clearReport`/`reportKey`/`EMPTY_REPORT`
  (`:37-48`), `currentTargetPort`/`portOfUrl` (`:59-83`), `addScreenshot`
  (`:261-299`), `saveReport` (`:301-333`), `emitReportCountChanged` (`:53-56`),
  and **every existing `handle()` case**. `clearReport` and its two call sites
  (`SAVE_REPORT` `:328`, `CLEAR_REPORT` `:252`) are **NOT** repointed to the new
  `deleteReport` (scope: the keying contract is consumed unchanged) — `deleteReport`
  is called **only** by the new `DELETE_SCREENSHOT` handler. No new top-level
  listener; no `manifest.json` change. The released vm suites
  (`background.reports.test.mjs`, `background.emit.test.mjs`,
  `background.shortcuts.test.mjs`, `background.icon-badge.test.mjs`) stay green.
- **Explicitly changing:** two additive `handle()` cases
  (`GET_REPORT_SCREENSHOTS`, `DELETE_SCREENSHOT`) + two additive helpers
  (`idbDelete`, `deleteReport`).
- **Verified:** 2026-06-20 — opened `background.js` (full), `editor-model.js`,
  `background.emit.test.mjs`.

### GC helper lock — DECISION (this story owns it)

scope.md §4 wants Delete to be the GC home so the store does not accumulate
empty/stale `report:<port>` entries. The released `clearReport(port)`
(`background.js:48`) does **not** delete the key — it `setReport(port,
EMPTY_REPORT())`, persisting an empty `{note:"", screenshots:[]}` record, which
still occupies a key and is exactly the "stale entry" the per-target LOW-2
forward-flag warns about.

**Decision: add a new `deleteReport(port)` (via new `idbDelete(key)`) and call it
ONLY from the new `DELETE_SCREENSHOT` handler when the splice empties the report —
truly removing the `report:<port>` key.** Released `clearReport` and its existing
call sites (`SAVE_REPORT`, `CLEAR_REPORT`) are **unchanged**.

Rationale:
1. **Fulfills the GC mandate literally.** Removing the key bounds the keyspace; an
   empty record does not. scope §4 / AC "GC — Delete owns cleanup" asks for *no
   stale populated/`report:<port>` entry*.
2. **Observably safe — zero consumer regression.** `getReport(port)` reads a
   missing key as `EMPTY_REPORT()` (`idbGet` → `undefined` → `|| EMPTY_REPORT()`,
   `background.js:42`), so post-delete the report reads `{note:"", screenshots:[]}`,
   `count === 0` — **identical** to the empty-record path. The w1 badge consumer
   (`GET_STATE`/`getReport` → count 0) repaints to green/0 either way.
3. **Minimal + additive.** `idbDelete` mirrors `idbGet`/`idbSet` (a `delete`
   transaction); `deleteReport` mirrors `clearReport`'s null-guard. The released
   keying contract is untouched, satisfying scope's "out of scope: the keying
   contract is consumed unchanged."

Note (accepted, consistent with released `Clear`): a delete-that-empties drops the
report-level `note` (the key is gone; `getReport` reads `note: ""`). This matches
the released `Clear` button, which already wipes the note via `clearReport` →
`EMPTY_REPORT()`. Acceptable: emptying the report is a terminal action.

## How we're doing it

- **File:** `extension/background.js` only (+ a new test file). Add the two
  `case` branches to the existing `handle()` switch and the two helpers near the
  existing IDB/report helpers (`:18-48`). Keep additions **side-effect-free at
  module top level** — function declarations only, no new listeners.
- **Port resolution is internal and released.** Use `currentTargetPort()`
  verbatim; do **not** add a second/looser localhost predicate (the released SSOT
  guards deceptive hosts → null, `:81`). Callers (popup) pass `msg.sid` only (a
  **stable identity**, never an array index or a port).
- **Identity-scoped isolation.** Because the port is resolved from the active tab
  inside the handler and the record is matched by `sid` (not array position), a
  delete in target A can never touch target B's `report:<port>` record (write-key ≡
  read-key) — and a `sid` belonging to a different target simply won't match, so the
  delete is a no-op. Do not accept or read a port from `msg`.
- **Emit on count change only.** `DELETE_SCREENSHOT` emits via the released
  `emitReportCountChanged` (its own `port==null` guard at `:54` protects the
  defensive non-target path). `GET_REPORT_SCREENSHOTS` is read-only — **never**
  emits.
- **No manifest change** — `storage`/`tabs`/`activeTab`/`scripting`/
  `unlimitedStorage` are already granted (`manifest.json:6`); the popup + SW are
  already registered. (devops sentinel — confirmed at the Phase-5 peer floor.)

## How we validate it was done correctly

- [ ] `GET_REPORT_SCREENSHOTS` on a target with N screenshots returns
  `screenshots.length === N`, each item `{ index, sid, thumbnail, url, title,
  captured_at, hasAnnotations }`, `index` ascending `0..N-1` in capture order, and
  `sid` present + distinct per shot.
- [ ] `thumbnail` equals the screenshot's `annotated` when present, else its
  `original`.
- [ ] `GET_REPORT_SCREENSHOTS` on a non-target tab (`currentTargetPort()` → null)
  returns `{ port: null, screenshots: [] }` with **no** IDB read attempted and
  **no** throw.
- [ ] `DELETE_SCREENSHOT { sid }` for the middle shot of a 3-shot report leaves
  exactly the former `#0` and `#2`, returns `{ ok:true, count:2 }`, and the
  persisted record has 2 screenshots.
- [ ] **Stable identity survives a splice:** after deleting a **lower-index** sibling,
  every surviving shot's `sid` still resolves (via `indexOfScreenshotId`) to the
  correct record at its shifted position — and `screenshotId` derives only from
  `captured_at` + `original` (preserved fields), so a `sid` is unchanged by a re-save.
- [ ] `DELETE_SCREENSHOT` that removes the **last** screenshot calls
  `deleteReport` → the `report:<port>` key is **absent** from the store
  afterward (`getReport(port)` reads `{note:"", screenshots:[]}`, count 0).
- [ ] A delete (any) emits `REPORT_COUNT_CHANGED { port, count: <new>, ts }` via
  `chrome.storage.session.set`; the emptying delete emits `count: 0`.
- [ ] `DELETE_SCREENSHOT` with a `sid` **not present** in the current target's report
  (already deleted, or belongs to another target) returns `{ error }` and mutates
  nothing (fail-safe no-op — `indexOfScreenshotId` → -1).
- [ ] Released seams unchanged: `clearReport`, `setReport`, `getReport`,
  `addScreenshot`, `saveReport`, every existing `handle()` case, and the w1 badge
  listeners are byte-identical; **no** new top-level listener.
- [ ] Two-port isolation: a delete with target A active never alters
  `report:<B>` (handler resolves the port internally; `msg` carries no port, only a `sid`).

## Motion contract

n/a — `frontend_lane: N/A`. This story is service-worker message handling (no UI,
no DOM, no animation). Reduced-motion is not applicable.

## Unit tests

Use the released `node --test` vm-context harness pattern from
`background.emit.test.mjs:30-176` (a `vm.createContext` seeded with hand-written
`chrome` + in-memory `indexedDB` Map-backed kv stub, `vm.runInContext(bgSrc, ...)`,
capture the `onMessage` listener and invoke handlers via it OR call the context's
top-level fns directly). **New, feature-distinct filename** to survive the
dir-level `node --test extension/*.test.mjs` run (a sibling owns
`background.reports.test.mjs`):

- `extension/background.gallery.test.mjs` — `getReportScreenshots_returnsIndexedProjection` —
  seed `report:5101` with 3 screenshots (one with `annotated`, one annotation-less);
  assert the response is `{ port:5101, screenshots:[{index:0,sid:<screenshotId(s0)>,thumbnail:<annotated>,…},…] }`
  in order, each `sid` present + distinct, `thumbnail` falls back to `original` for the
  annotation-less shot.
- `extension/background.gallery.test.mjs` — `getReportScreenshots_nonTarget_emptyNoIdbRead` —
  mock tab URL `about:blank`; assert `{ port:null, screenshots:[] }` and the idb
  `get` call-counter did not increment (proves `getReport(null)` short-circuit).
- `extension/background.gallery.test.mjs` — `deleteScreenshot_bySid_splicesAndEmitsCount` —
  seed 3 shots, `DELETE_SCREENSHOT {sid:<screenshotId(middle)>}`; assert remaining
  shots are the former `#0` and `#2`, return `{ok:true,count:2}`, and the captured
  `storage.session.set` tick is `{ reportCountChanged:{ port:5101, count:2, ts:<number> } }`.
- `extension/background.gallery.test.mjs` — `screenshotId_stableAcrossSpliceAndUnknownSidNoOp` —
  **(the identity-stability assertion)** seed 3 shots; capture `sid2 = screenshotId(shot#2)`;
  delete the **lower-index** shot `#1` by its sid; assert `indexOfScreenshotId(getReport(5101), sid2)`
  now resolves to the **shifted** position (former `#2` → index 1) and points at the
  same record (same `captured_at`/`original`); then `DELETE_SCREENSHOT {sid:"does-not-exist"}`
  returns `{error}` and mutates nothing (fail-safe no-op).
- `extension/background.gallery.test.mjs` — `deleteScreenshot_lastShot_removesKey_GC` —
  seed 1 shot, delete it by its sid; assert the kv stub has **no** `report:5101` key
  (use a `has`/`delete` call-counter or assert `'report:5101' in kv === false`),
  `getReport(5101)` reads `{note:"",screenshots:[]}`, and the tick emits `count:0`.
- `extension/background.gallery.test.mjs` — `deleteScreenshot_unknownSid_noMutation` —
  seed 2 shots, `DELETE_SCREENSHOT {sid:"nope"}`; assert `{error}`, kv record
  unchanged (2 shots), **no** tick captured.
- `extension/background.gallery.test.mjs` — `deleteScreenshot_twoPortIsolation` —
  seed `report:5101` (2 shots) + `report:5102` (3 shots), active tab `:5101`,
  delete the first `:5101` shot by its sid; assert `report:5101` has 1 shot and
  `report:5102` is byte-for-byte unchanged (count 3).
- `extension/background.gallery.test.mjs` — `moduleLoadsClean_noStorageKey` —
  a second vm context whose `chrome` mock **omits** `storage` (mirrors frozen
  suites): assert `vm.runInContext` does not throw and the `onMessage` listener
  registers (proves the additions add no new top-level listener and the
  `emitReportCountChanged` optional-chain still no-ops).

## Dependencies

none (intra-FE). Consumes the **released** `w0-per-target-reports` seams
(`currentTargetPort`, `getReport`/`setReport`/`clearReport`, `reportKey`,
`emitReportCountChanged`) and `w0-editor-foundation`'s persisted
`screenshots[].model`/`annotated` — both shipped in prior waves, so the linkage is
prose here, not a `depends_on` id (cross-feature ids must not appear in story
`depends_on`; the feature-level edge is `feature.md depends_on:
[w0-per-target-reports, w0-editor-foundation]`).

## Cross-domain contract

- **backend-architect:** controller (`/resolve`, `/report/save`) untouched — this
  handler edits only the local IndexedDB store. (BE sentinel — peer-confirmed
  Phase 5.)
- **database-architect:** `idbDelete`/`deleteReport` are additive value/key ops on
  the existing `snapdeck`/`kv` store — **no** version bump, new store, or index.
  (DB sentinel — peer-confirmed Phase 5.)
- **devops-architect:** no `manifest.json` / permission / build change. (devops
  sentinel — peer-confirmed Phase 5.)

## History

- 2026-06-20 — created by frontend-architect (effort=2, depends on none)

## Contrarian Findings

### Finding 1 — Screenshots have no stable identity; all three handlers address by array index (root cause of fe-002's block)

**Severity:** concern

**Mechanism:** `GET_REPORT_SCREENSHOTS` projects `{index, …}` (line 53), and
`DELETE_SCREENSHOT` / fe-002's `REOPEN_SCREENSHOT` / `resaveScreenshot` all address a
record by its **array position**. Released capture (`addScreenshot`, `background.js:284-295`,
verified byte-frozen and out-of-scope here) pushes a record with **no id field**, so array
index is the *only* handle the feature has. Within a single popup session `DELETE_SCREENSHOT`
is safe — it re-reads + splices, and fe-003 re-fetches the grid after every mutation, so
shifted indices are recomputed; and external **appends** (a keyboard-shortcut capture) land
at the tail, never disturbing a lower index. The danger is any mutation that **removes or
inserts below a held index while another operation holds that index across an await** — which
is exactly fe-002's long-lived re-edit (see STORY-fe-002 Finding 1, severity **block**:
a delete from a re-opened popup mid-edit makes `resaveScreenshot` overwrite the wrong record,
silently). This story owns the projection, so the fix lands **here**: emit a stable identity
alongside `index` (e.g. `captured_at`, tie-broken by `original` if same-millisecond
collisions matter) and let `DELETE_SCREENSHOT` accept/match by that identity. The scope
sanctions it — the API is specified as **"by index/id"** (scope.md § New zero-port-arg
message API), not index-only.

**Recommendation:** **revise** in lockstep with fe-002 — add a stable per-screenshot
identity to the projection and make delete/re-open/re-save match on it (no match ⇒ no-op).
Index may remain for display ordering (`#N` badge), but must not be the mutation handle.
If the team accepts index-addressing instead, this concern folds into fe-002's required
`## Acknowledged Risk`.

### Finding 2 — "GC home" only removes the key on delete-to-empty; the dominant Save/Clear paths still leave empty `report:<port>` records

**Severity:** info

**Mechanism:** `deleteReport(port)` removes the `report:<port>` key, but **only** when a
delete empties the report (line 82-83). The far more common terminal flows still write an
empty record and **keep the key**: released `saveReport` calls `clearReport(browserPort)`
on a successful upload (`background.js:328`) and `CLEAR_REPORT` calls `clearReport`
(`:252`), both of which `setReport(port, EMPTY_REPORT())` (`:48`). So scope §4's framing
*"so the store does not accumulate empty/stale records"* is imprecise — after any normal
Save the store retains a `{note:"",screenshots:[]}` key per port ever used. This is
practically harmless (the genuine LOW-2 concern was unbounded **screenshot/PNG** bloat,
which delete + clear fully bound by emptying `screenshots[]`; a residual empty record is
~tens of bytes, and the keyspace is bounded by the count of distinct dev-server ports ever
visited), and keeping `clearReport` unchanged is consistent with the "keying contract
consumed unchanged" scope boundary. Recorded so no downstream reader believes the keyspace
is fully GC'd — it is not; only the per-record payload is.

**Recommendation:** **acknowledge** — no change needed; just don't over-claim the GC
extent in the decision memo. (Repointing Save/Clear to `deleteReport` would bound the
keyspace too, but that touches the released keying contract and is explicitly out of scope.)

### Finding 3 — DELETE joins an unlocked read-modify-write set on the report record

**Severity:** info

**Mechanism:** `DELETE_SCREENSHOT` does `getReport` → mutate → `setReport`/`deleteReport`
with no lock, joining the released `addScreenshot`/`SET_NOTE`/`saveReport` mutators that
already share this pattern. Two handlers interleaving at their `await` points (e.g. a
keyboard-capture `addScreenshot`, whose `getReport` is at `background.js:283`, racing a
popup `DELETE_SCREENSHOT`) both read the same pre-state and the second `setReport` wins →
one mutation silently dropped (last-writer-wins). This is a **pre-existing** architectural
property of the store (no IDB-level transactional read-modify-write), not introduced here;
the window is small and the SW is single-threaded so it only manifests across an await.
Flagged because this feature adds a new user-driven mutator to that set, slightly widening
the surface. Not actionable at design time without a store-wide locking change (out of
scope); recorded for conscious awareness.

## Revisions

### 2026-06-20 — product-owner (arbitrate, run-20260620 w2-screenshot-gallery)

**Finding 1 (concern) — RESOLVED BY REVISION (stable-identity projection). This is the
fix site for fe-002's `block`.** Index-addressing is the root cause of fe-002 Finding 1
(silent wrong-record corruption on a mid-edit sibling delete). I verified against released
code that the `addScreenshot` record (`background.js:284-295`) carries **`captured_at` and
`original` but no `id`** — so a stable identity is synthesizable from already-stored,
**re-save-preserved** fields with **zero released-code change**, exactly as the contrarian
recommended and as scope sanctions ("by index/**id**"). Revised:
- `GET_REPORT_SCREENSHOTS` now emits `sid` (a `screenshotId(s)` = `captured_at` +
  `original`-bytes fingerprint) alongside the display `index`; added the `screenshotId` /
  `indexOfScreenshotId` helpers. The `#N` index stays presentation-only.
- `DELETE_SCREENSHOT` now matches the record by `sid` via `indexOfScreenshotId` (no match
  ⇒ `{error}` fail-safe no-op), not by `msg.index`.
- Validate checklist + unit tests updated: projection emits distinct `sid`; delete by sid;
  **`screenshotId_stableAcrossSpliceAndUnknownSidNoOp`** proves a held `sid` re-resolves to
  the correct record after a lower-index sibling splice and that an unknown `sid` is a no-op.
This pairs lock-step with fe-002 (re-open/re-save by `sid`) and fe-003 (popup passes `sid`,
never an index). `depends_on` graph unaffected (fe-001 ← fe-002 ← fe-003). Promoted to a
feature.md AC ("No mid-edit wrong-record corruption (stable-identity)") + a Konva-lane E2E
so the guard is validator-enforceable and an engineer can't backslide to index-addressing.

**Finding 2 (info) — ACCEPTED; GC claim scoped precisely (no over-claim).** The GC home
removes the `report:<port>` key **only on delete-to-empty**; the released `saveReport`
(`background.js:328`) and `CLEAR_REPORT` (`:252`) paths still `setReport(port,
EMPTY_REPORT())` and **keep an empty key** — repointing them touches the released keying
contract and is explicitly out of scope. So the precise extent is: **Delete bounds the
PNG/payload bloat (the real LOW-2 concern) by emptying `screenshots[]` and removes the key
on delete-to-empty; it does NOT GC the empty-record keyspace left by Save/Clear** (residual
~tens of bytes per distinct dev-server port ever visited — bounded, harmless). The
decision-memo and any reader must not state "the store does not accumulate empty/stale
records" without this qualifier. No code change.

**Finding 3 (info) — ACCEPTED (pre-existing, conscious awareness).** `DELETE_SCREENSHOT`
joins the released unlocked `getReport→mutate→setReport` set (`addScreenshot`/`SET_NOTE`/
`saveReport`); last-writer-wins across an await is a pre-existing store property, not
introduced here, and a store-wide lock is out of scope. The stable-identity fix above
narrows the *user-visible* corruption window (a dropped delete is a re-fetchable count
blip, not a Frankenstein record). Recorded; no change.

**Status:** pending → approved.

## Security Review

_security-architect, Phase 7 STRIDE, 2026-06-20. Verified against RELEASED `background.js`
+ `manifest.json` on disk. This story owns the two new SW handlers + the stable-identity
projection that fe-002 also addresses by._

### Finding S1 — `GET_REPORT_SCREENSHOTS` / `DELETE_SCREENSHOT` entry-point hygiene — CLEAN

**Severity:** info (security-positive)

**Threat (STRIDE — Spoofing / Elevation / cross-port Information disclosure):** new SW
message handlers that read/mutate the local store could leak or corrupt another port's
report, or be reachable from a hostile page.

**Verification:**
- **No web reachability:** the manifest has **no `externally_connectable`**
  (`manifest.json`, whole file), so a web page cannot call `chrome.runtime.sendMessage`
  at all — the only caller is the extension's own popup. Spoofing/CSRF on the message API
  is **N/A** by construction.
- **Port resolved internally, never from `msg`:** both handlers derive the port via
  `currentTargetPort()` (the boundary-anchored localhost gate `/^http:\/\/(localhost|
  127\.0\.0\.1)(:|\/|$)/`, `background.js:81`) — the same SSOT the released read/write
  paths use (write-key ≡ read-key). Callers pass `sid` only. ✓
- **Forged / foreign `sid` is a fail-safe no-op, NOT a cross-port write:**
  `DELETE_SCREENSHOT` matches by `indexOfScreenshotId(r, msg.sid)` against the **current
  target's** freshly-read report (this story, line 111); a `sid` from another port (or
  already deleted) → -1 → `{error}`, **no mutation** (line 113). A delete with target A
  active resolves port A internally, so a B-owned `sid` simply won't match A's report. ✓
  Two-port isolation confirmed.
- **Injection:** `sid` is used only for string-equality `findIndex` (lines 92-94), never as
  an IDB key or in `eval`; the IDB key is `report:${int port}` from the gated resolver. No
  injection vector. ✓
- **No new permission / no new top-level listener** (additive `case`s on the existing
  `handle()` switch + additive `idbDelete`/`deleteReport`). EoP surface unchanged. ✓

### Finding S2 — `sid` derivation (`captured_at` + `original` fingerprint) collision/spoofing — LOW, accept

**Severity:** low (defense-in-depth; accept-risk)

**Threat (Spoofing / Tampering within a single port's report):** `screenshotId(s)` =
`` `${s.captured_at}|${orig.length}:${orig.slice(-24)}` `` (lines 82-88). A *collision*
(two distinct records resolving to the same `sid`) would let a delete/re-save match the
wrong sibling.

**Assessment:** a collision requires two genuinely-distinct captures in the **same port's**
report to share an ms-resolution ISO `captured_at` **and** identical `original` byte-length
**and** identical trailing 24 base64 chars — effectively impossible for distinct PNG
captures, and there is **no external path to plant a colliding `sid`** (it is computed
SW-side from stored fields; the popup only echoes back the `sid` it received). The
architect already notes "engineer may pick a stronger deterministic fingerprint" (line 84)
— a full-`original` hash would make collision cryptographically negligible, but the current
fingerprint is sufficient for a single-user local tool with small reports.

**Recommendation:** **acknowledge** — no STORY-sec. If the engineer wants belt-and-suspenders,
fingerprint over the full `original` rather than `length + last-24`; not required.

### Finding S3 — Hard-delete + key-removal GC (no soft-delete) — N/A by data model

**Severity:** info

`DELETE_SCREENSHOT` does a hard `splice` and removes the `report:<port>` key on
delete-to-empty (lines 115-120). The default-checklist "soft-delete" item is **N/A** here:
the `report:<port>` store is an *ephemeral in-progress* local report, not a server entity
table with audit columns, and scope §4 explicitly wants Delete to be the GC home (bound the
PNG/keyspace bloat). The destructive action is gated behind the fe-003 confirm step. Correct
pattern for this data model. (Per fe-001 Finding 2 / PO revision: the GC bounds the
PNG/payload bloat and the empty-key on delete-to-empty, but Save/Clear still leave empty
records — bounded, harmless, out of scope; do not over-claim full keyspace GC.)

### Default-checklist N/A dispositions (recorded so PO sees the checklist was applied)

Local no-server MV3-extension feature → most items N/A: **authn/authz** = the intrinsic
localhost host-guard in `currentTargetPort()` (`background.js:81`), reused unchanged (no
HTTP endpoint, no login); **secrets** none; **audit columns** N/A (no server entity table);
**rate limiting / CSRF / CORS** N/A (not externally_connectable, no server change, local
single-user); **injection** none (string-equality `sid`, int port key); **multi-tenant
isolation** → analog is two-port isolation, confirmed (S1).
