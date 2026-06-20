# Data Model — epic `snapdeck-ux-improvements`

> Epic-level data model, authored per feature. Each feature's database-architect
> appends/updates its own section. Snapdeck is a Chrome MV3 extension; its only
> persistent client-side store is **IndexedDB** (the `report` object store driven
> by `getReport` / `setReport` / `addScreenshot()` in `extension/background.js`).
> There is no server-side relational database and no migration framework — schema
> here means the IndexedDB store/record shape, owned and versioned in extension
> code rather than via SQL migrations.

---

## Feature `w0-keyboard-shortcuts` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** schema/data/storage changes.

### Rationale

- Per `features/w0-keyboard-shortcuts/scope.md` § Out of scope: *"No changes to
  report storage / IndexedDB. The single-`report`-record seam
  (`getReport`/`setReport`/`addScreenshot()`'s persistence tail) is being re-keyed
  by sibling feature `w0-per-target-reports`. This feature must NOT touch that
  surface — it only adds a listener that calls `addScreenshot()`."*
- The feature is **caller-only**: a `manifest.json` `commands` block plus one
  top-level `chrome.commands.onCommand` listener in `extension/background.js` that
  dispatches to the existing **zero-arg `addScreenshot()`** function. The localhost
  guard, visible-tab capture, annotate-overlay handshake, and the IndexedDB
  persistence tail all already live inside `addScreenshot()` and are unchanged.
- No new IndexedDB object store, no new index, no `report` record-shape change, no
  reference/seed data, no retention rule changes.

### Ownership boundary

The IndexedDB `report` object store and its record shape are owned by sibling
feature **`w0-per-target-reports`** this wave (it is re-keying the single-`report`
seam to per-target). That feature's database-architect owns the report-store
section of this document. `w0-keyboard-shortcuts` deliberately does not duplicate
or pre-empt that model — it treats `addScreenshot()` as a stable function-level
seam.

### Cross-domain confirmation

Sentinel status was coordinated with `backend-architect` (owner of the
service-worker / `background.js` work for this feature) before finalizing — see
`features/w0-keyboard-shortcuts/conversations/0002-database-architect-to-backend-architect-msg.md`.

### Migration / rollback strategy

N/A — no schema change to migrate forward or reverse. Forward-only/soft-delete
policy is not engaged because no data is written, altered, or dropped by this
feature.

---

## Feature `w0-per-target-reports` — NO server-side DB changes (sentinel) + ownership handoff

**Decision: sentinel for the server-side database domain.** This feature's only
storage is the browser's **client-side IndexedDB** (`snapdeck`/`kv`) inside the
Chrome MV3 extension service worker — not the project's server-side database.
There is no server-side migration, index, stored-logic, or seed/reference-data
change. See `features/w0-per-target-reports/stories/STORY-db-001.md`.

### Ownership correction (supersedes the earlier pointer)

The header above and the `w0-keyboard-shortcuts` section previously named *this
feature's database-architect* as "owner of the report-store section of this
document." Per the team-lead's authoritative ruling for this run, that is
**reassigned**: the IndexedDB report-store re-keying is **frontend/extension
domain** work, owned by **`frontend-architect`** in this feature's FE story set.
The distinction: "schema" in this MV3 extension means a *browser* IndexedDB
store/record shape, versioned in extension JS — which is frontend/extension
territory, not the server-side migration mechanism that the database-architect
owns. The server-side database-architect role is a sentinel here.

### IndexedDB report-store model (FOR REFERENCE — authored by frontend-architect)

Recorded here only so cross-team readers (backend-architect, future db runs) have
a single map. The authoritative model lives in the FE stories.

- **Store:** existing `snapdeck` DB, existing generic `kv` object store. **No
  version bump** (the `kv` store is already a generic key→value store).
- **Key change:** single global `kv` key `"report"` → per-port key
  `report:<browserPort>`, where `<browserPort>` is derived from the active tab's
  URL via the existing `portOfUrl(url)` seam (the same derivation `saveReport()`
  already uses — no second port-derivation path).
- **Record shape (UNCHANGED):** `{ note: string, screenshots: Screenshot[] }`;
  empty-record default stays `{ note: "", screenshots: [] }`. Only the *key*
  changes, not the value shape.
- **Helpers become port-scoped:** `getReport(port)` / `setReport(port, r)` /
  `clearReport(port)`. Caller-facing signatures (`addScreenshot()`,
  `saveReport()`) stay zero-arg — they resolve the active tab internally and pass
  their own resolved port down into the storage helpers.
- **`GET_STATE` return shape:** `{ count, note, port }` for the current target;
  `{ count: 0, note: "", port: null }` on a non-localhost (non-target) tab.
- **Port-resolution cache:** **none in this feature** — resolution is
  at-handling-time from the active tab (per `frontend-architect`, fe-001), so
  there is nothing cross-tab to persist. The load-bearing rule that IS enforced
  is **no module-level report/port state** in the service worker. The
  `chrome.storage.session` (MV3-ephemeral-safe) rule is documented as a
  constraint that engages only IF a future change introduces a cache. The
  per-port reports themselves stay in IndexedDB (survive service-worker restart).
- **No data migration:** the legacy global `"report"` key is abandoned on upgrade
  (not read-and-ported-forward).

### Migration / rollback strategy

N/A for the server-side DB domain — no server-side schema to migrate forward or
reverse. The IndexedDB key change is non-versioned (same generic `kv` store) and
forward-only by abandonment: the legacy `"report"` record is simply no longer
read; no destructive drop of user data is performed (it is left in place and
ignored). That client-side strategy is owned and detailed by the
frontend-architect.

### Cross-domain confirmation

Ownership handoff coordinated with `frontend-architect` — see
`features/w0-per-target-reports/conversations/0001-database-architect-to-frontend-architect-msg.md`.

---

## Feature `w0-editor-foundation` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** schema/index/migration/
seed changes. See `features/w0-editor-foundation/stories/STORY-db-001.md`.

### Rationale

- The feature persists the editor's lossless `model` by adding a single **additive
  field** to the per-screenshot sub-record object literal that `addScreenshot()`
  already writes (`extension/background.js:129-139`), serialized through the
  existing structured-clone path (`setReport()` → `objectStore("kv").put(val, key)`).
- Adding a field to a structured-clone **value** does not alter the `kv` object-store
  definition: **no new object store, no index, no `indexedDB.open("snapdeck", N)`
  version bump** (stays at v1), no migration. The geometry envelope
  (`{ version: 1, items: [...] }`) is a **value** contract owned by the FE/BE
  stories and the architects' frozen 🤝 CONTRACT — not a DB schema artifact.
- No index is added or warranted: the in-progress report is a single `kv` key
  holding a small array read in full, never a queried/filtered collection.

### Ownership boundary

The IndexedDB report-store (`snapdeck`/`kv`) and its keying are owned by sibling
feature **`w0-per-target-reports`** (frontend/extension domain — see the ownership
correction in that feature's section above). `w0-editor-foundation` adds
`screenshots[].model` **orthogonally** to that keying: the whole `screenshots`
array is carried as-is through the per-port re-key, so the `model` field survives
transparently. This feature treats `addScreenshot()` as a stable function-level
seam and does not touch the report-store keying surface.

### Cross-domain confirmation

Sentinel status was coordinated with `backend-architect` (owner of the
`background.js` `model`-storage work) before finalizing — confirmed the additive
field needs nothing schema-side (no store/index/migration/version bump). See
`features/w0-editor-foundation/conversations/0012-backend-architect-to-database-architect-msg.md`.

### Migration / rollback strategy

N/A — no schema change to migrate forward or reverse. Forward-only/soft-delete
policy is not engaged because no schema is created, altered, or dropped. The
client-side IndexedDB value-shape change is owned by the FE/BE stories.

---

## Feature `w1-draggable-toolbar-toggle` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** server-side DB /
IndexedDB / index / migration / reference-data changes. See
`features/w1-draggable-toolbar-toggle/stories/STORY-db-001.md`.

### Rationale

- The feature's only persistence is the **toolbar position**, written to
  **`chrome.storage.local`** under a dedicated UI-chrome key (e.g.
  `snapdeckEditorToolbarPos: {left, top}`). `chrome.storage.local` is a
  browser-local key→value store **owned by the frontend/extension domain** —
  not the project's (non-existent) server-side DB, and a layer distinct from the
  IndexedDB `report` store. `extension/content/editor.js` has **zero**
  `chrome.storage`/`indexedDB` usage today (verified 2026-06-19), so this is
  net-new browser-local UI-chrome state authored in extension JS by the FE
  stories.
- The **visibility toggle persists nothing** — it is pure view state
  (`annLayer.visible()` + hide selection chrome), never written to any store, and
  resets to "shown" on each `openEditor()`.
- **No IndexedDB `report`-store touch** (no new object store, no index, no
  `indexedDB.open("snapdeck", N)` version bump, no record-shape change) and **no
  `model`-envelope touch** — both are explicitly out of scope per
  `features/w1-draggable-toolbar-toggle/scope.md`.

### Ownership boundary

- **Toolbar-position persistence (`chrome.storage.local`)** → owned by
  `frontend-architect` (FE story set); browser-local UI-chrome, authored in
  extension JS.
- **IndexedDB `report` store (`snapdeck`/`kv`)** → unchanged; owned by released
  `w0-per-target-reports` (FE/extension domain).
- **Editor `model` envelope** → unchanged; frozen by released
  `w0-editor-foundation` (`editor-model.js`).

### Cross-domain confirmation

Sentinel status was coordinated with `frontend-architect` before finalizing (the
unconditional Phase-5 peer-message floor) — confirmed toolbar position lives in
`chrome.storage.local` (FE-owned) and the feature does not touch the IndexedDB
`report` store or the `model` envelope. See
`features/w1-draggable-toolbar-toggle/conversations/`.

### Migration / rollback strategy

N/A — no server-side schema to migrate forward or reverse, and no IndexedDB
store/version change. `chrome.storage.local` is a non-versioned browser-local
key→value store written and read entirely by FE/extension code; the
forward-only/soft-delete policy is not engaged because no schema is created,
altered, or dropped by this feature.

---

## Feature `w1-text-box-autofit` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** server-side DB /
IndexedDB store / index / version / migration / reference-data changes. See
`features/w1-text-box-autofit/stories/STORY-db-001.md`.

### Rationale

- The feature reworks the editor text tool into a draw-a-box auto-fit/wrap
  annotation. The `type:"text"` item in the editor's lossless `model`
  (`{ version: 1, items: [...] }`) gains opaque geometry + fit fields
  (`width`, `height`, plus any fit metadata the frontend-architect chooses).
- Those fields are an **additive structured-clone value-shape change** inside the
  per-screenshot `screenshots[].model` value released by
  `w0-editor-foundation`. `addScreenshot()` stores `model: resp.model ?? null`
  **verbatim/opaque** (`extension/background.js:225`) — no enumeration, no
  per-item whitelist — so the new fields persist with no storage-helper change.
- Adding fields to a stored *value* does **not** alter the `kv` object-store
  definition: the `idb()` `kv` store, `indexedDB.open("snapdeck", 1)`, and
  `createObjectStore("kv")` are untouched — **no `db.version` bump** (stays v1),
  no new store, no index. (The in-progress report is a single `kv` value read in
  full, never a queried/filtered collection — no index warranted.)
- The per-port re-key released by `w0-per-target-reports` (`reportKey(port)` →
  `report:<port>`) is respected: the whole `screenshots[]` array (incl.
  `.model`) is carried as-is, so the new fields survive the re-key transparently.
- The lossy `annotations` projection stays **byte-frozen**
  `{ id, type:"text", x, y, text }`; the new geometry/fit fields are
  **model-only** and never reach `saveReport()`'s `/report/save` whitelist
  (`extension/background.js:248-252`). `projectAnnotations` is not modified.
- No reference/seed data, no retention rule, no localized strings.

### Ownership boundary

- **Editor `model` text-item fields (`width`/`height`/fit)** → `frontend-architect`
  (FE story set); opaque additions to the `type:"text"` item, render-boundary
  sanity in `editor.js`, no per-item validation in the pure `editor-model.js`.
- **`screenshots[].model` opaque persistence** → `backend-architect`
  (`background.js`); already stores `model` verbatim — no change (BE sentinel,
  STORY-be-001).
- **IndexedDB `report` store (`snapdeck`/`kv`)** → unchanged; owned by released
  `w0-per-target-reports` (FE/extension domain).
- **Editor `model` envelope (`{version:1, items:[…]}`)** → unchanged; frozen by
  released `w0-editor-foundation` (`editor-model.js`).

### Cross-domain confirmation

Sentinel status was coordinated with **both** `backend-architect` and
`frontend-architect` before finalizing (the unconditional Phase-5 peer-message
floor — 4 messages exchanged). BE confirmed `background.js` needs zero change
(`model` stored verbatim at `:225`, `kv`/`indexedDB.open("snapdeck",1)` untouched,
`/report/save` whitelist at `:248-252` byte-frozen) and is also sentinelling
(STORY-be-001); FE confirmed the new fields ride entirely inside the existing
`model` items with no IndexedDB store/version/key change. See
`features/w1-text-box-autofit/conversations/`.

### Migration / rollback strategy

N/A — no server-side schema to migrate forward or reverse, and no IndexedDB
store/version change. The forward-only/soft-delete policy is not engaged because
no schema is created, altered, or dropped by this feature; the client-side
value-shape change (new opaque fields on the `model` text item) is owned by the
FE/BE stories.

---

## Feature `w1-dynamic-icon-badge` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** server-side DB /
IndexedDB / index / migration / reference-data changes. See
`features/w1-dynamic-icon-badge/stories/STORY-db-001.md`.

### Rationale

- The feature turns the static toolbar (`action`) icon into a per-`tabId` state
  machine (gray / green / orange+count). Its orange count is **read** from the
  released `w0-per-target-reports` in-progress report via the
  `GET_STATE → { count, note, port }` message path (`background.js:167`) —
  **consumed READ-ONLY**. Per `features/w1-dynamic-icon-badge/scope.md` § Out of
  scope, the `report:<port>` keying and `GET_STATE` payload shape are *consumed
  only, never modified* (AC10/AC11 reinforce the boundary).
- **No IndexedDB change:** no new object store, no index, no `report` record-shape
  change, and **no** `indexedDB.open("snapdeck", N)` version bump. The badge is a
  pure reader of w0's released store.
- The feature's only **new** persisted state is a **port-resolution cache** in
  **`chrome.storage.session`** (AC2/AC9) — an MV3-ephemeral-safe, browser-local
  key→value store owned by the **frontend/extension** domain, distinct from
  IndexedDB and further still from any (non-existent) server-side DB. It holds no
  `report:*` data and is authored in extension JS by the FE story set.
- **No write path** is added: the released `addScreenshot()` / `saveReport()` /
  `currentTargetPort()` / `getReport()` / `GET_STATE` / `runCaptureCommand()` seams
  are consumed read-only (AC11). Live count freshness rides a lightweight notify/push
  message plus a re-read of the existing `GET_STATE` path — no new stored state.
- **No reference/seed data**, and **no new `manifest.json` permission** (AC13 —
  `action`/`tabs`/`storage` are already granted).

### Ownership boundary

- **Port-resolution cache (`chrome.storage.session`)** → owned by
  `frontend-architect` (FE story set); browser-local, MV3-ephemeral-safe
  UI/extension state authored in extension JS.
- **IndexedDB `report` store (`snapdeck`/`kv`, `report:<port>` keying)** → unchanged;
  owned by released `w0-per-target-reports` (FE/extension domain). This feature reads
  it via `GET_STATE` only.
- **Released write/read seams** (`addScreenshot`, `saveReport`, `currentTargetPort`,
  `getReport`, `GET_STATE`, `runCaptureCommand`) → unchanged; consumed read-only.

### Cross-domain confirmation

Sentinel status was coordinated with `frontend-architect` before finalizing (the
unconditional Phase-5 peer-message floor) — confirmed (1) the badge reads the
released w0 `report:<port>` IndexedDB store via `GET_STATE` **READ-ONLY** with no
new store / key / version bump, (2) the port-resolution cache lives in
`chrome.storage.session` (FE-owned, not a DB), and (3) no `report:<port>` write
path or reference/seed/retention data is added. See
`features/w1-dynamic-icon-badge/conversations/`.

### Migration / rollback strategy

N/A — no server-side schema to migrate forward or reverse, and no IndexedDB
store/version change. The `chrome.storage.session` resolution cache is a
non-versioned, ephemeral browser-local store written and read entirely by
FE/extension code; the forward-only/soft-delete policy is not engaged because no
schema is created, altered, or dropped by this feature.

---

## Feature `w2-screenshot-gallery` — NO server-side DB changes (sentinel)

**Decision: sentinel for the server-side database domain.** This feature
introduces **zero** server-side DB / IndexedDB store / index / version / migration
/ reference-seed / retention-rule changes. See
`features/w2-screenshot-gallery/stories/STORY-db-001.md`.

### Rationale

- Snapdeck has **no server-side relational database and no migration framework**
  (it is a Chrome MV3 extension). The only persistent client-side store is
  IndexedDB (`snapdeck`/`kv`, key `report:<port>`), and per the ownership
  correction in § `w0-per-target-reports` above, that IndexedDB store is
  **frontend/extension domain** — owned by `frontend-architect`, NOT the
  server-side database-architect. The server-side DB role is therefore a
  **sentinel** for this feature.
- The gallery does **index-scoped reads / mutations of the existing
  `report:<port>` record only**, all through the released
  `w0-per-target-reports` helpers:
  - **Fetch** — reads `getReport(port).screenshots[]` in full (a new zero-port-arg
    `background.js` message returns `{ index, thumbnail-source, light meta }`).
  - **Re-open + re-save** — re-emits the editor `model` via the released
    `ANNOTATE {image, model}` seam, then **replaces one `screenshots[]` element
    in place** via `setReport(port, r)`: `original` unchanged, `model` /
    `annotated` / `annotations` re-rendered, `console` / `network` / `meta`
    preserved. Value-level array-element replace — no store/key/shape change.
  - **Delete** — splices one `screenshots[]` element via `setReport(port, r)`;
    when a delete empties the report the FE delete story **truly removes the
    `report:<port>` key** from the existing `kv` store via a new FE-owned
    `deleteReport(port)` / `idbDelete(key)` helper (the GC home for the per-target
    LOW-2 forward-flag) — rather than writing an empty `{note, screenshots:[]}`
    record — so the store does not accumulate empty/stale entries. Removing a *key*
    from the existing generic `kv` store is an additive value/key-level operation,
    **not** a store-definition / version change (confirmed with frontend-architect,
    2026-06-20: no `indexedDB.open("snapdeck", N)` version bump, no new store, no
    new index).
- **No `indexedDB.open("snapdeck", N)` version bump** (stays at v1), **no new
  object store, no new index** (the report is a single `kv` value read in full —
  never a queried/filtered collection, so no index is warranted), **no
  record-shape change** (the `{note, screenshots[]}` value contract and the
  `report:<port>` key are unchanged).
- **No reference/seed data, no localized strings, no server-side retention rule.**
  The only retention behavior is the Delete-driven `clearReport(port)` GC, which
  is a client-side value-level clear on the existing key, owned by the FE story
  set.
- The re-open path inherits the released render-boundary guards
  (`RENDER_ITEM_CAP = 500`, `RENDER_TEXT_CAP = 10000`, text-box clamp /
  clamped-inset short-circuit) verbatim. The bounded-arbitrary-model concern is a
  **render-time** resilience property of `editor.js` (FE/security domain), **not**
  a storage/schema concern — the `model` is read from the extension's own
  IndexedDB (isolated-world, not page-writable, not network), so there is no
  DB-side validation/index to add.

### Ownership boundary

- **New `background.js` message handlers** (fetch-report-screenshots,
  re-open-and-resave by index/id, delete by index/id; each resolves
  `currentTargetPort()` internally — callers pass index/id only) →
  `backend-architect` (service-worker domain). These are message-routing +
  value-level `getReport`/`setReport`/`clearReport` calls, not schema.
- **Popup gallery UI** (thumbnail grid, delete-confirm, re-open entry) →
  `frontend-architect` (`extension/popup/*`).
- **IndexedDB `report` store (`snapdeck`/`kv`, `report:<port>` keying, the
  `getReport`/`setReport`/`clearReport` helpers, `portOfUrl`/`currentTargetPort`)**
  → unchanged; owned by released `w0-per-target-reports` (FE/extension domain).
  Consumed here as read + index-scoped value mutation only.
- **Editor `model` envelope + render-boundary guards** → unchanged; frozen by
  released `w0-editor-foundation` (`editor-model.js` / `editor.js`).
- **`REPORT_COUNT_CHANGED` `chrome.storage.session` tick** → unchanged; consumed
  as released (`w0-per-target-reports` STORY-fe-003); the badge consumer is
  `w1-dynamic-icon-badge`.

### Cross-domain confirmation

Sentinel status was coordinated with `frontend-architect` before finalizing (the
unconditional Phase-5 peer-message floor) and **confirmed by FE on 2026-06-20** —
the gallery's data layer rides entirely inside the released `report:<port>` keying
with **no** new object store, no `indexedDB.open("snapdeck", N)` version bump, no
new index, and no record-key/record-shape change (fetch = read-in-full; re-save =
in-place array-element replace; delete = splice, with an emptying delete removing
the `report:<port>` key via the FE-owned `deleteReport(port)` / `idbDelete(key)`
GC helper — an additive value/key-level op on the existing `kv` store, not a
store-definition/version change). See
`features/w2-screenshot-gallery/conversations/0001-database-architect-to-frontend-architect-msg.md`.

### Migration / rollback strategy

N/A — no server-side schema to migrate forward or reverse, and no IndexedDB
store/version change. The forward-only / soft-delete policy is not engaged for the
server-side DB domain because no schema is created, altered, or dropped. Note that
the feature's **user-driven Delete is intentionally destructive** at the
client-side value level (it removes a single `screenshots[]` element, and clears
the `report:<port>` key when the report empties) — but this is a
frontend/extension client-side operation gated behind an explicit in-popup confirm
step (owned by the FE story set), **not** a server-side schema drop, so the
server-side `destructive: true` / human-review-Open-Question rule does not apply
to this DB sentinel. The client-side delete-confirm contract is owned and detailed
by the FE/BE stories.

---

## Feature `w2-rectangle-tool` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** server-side DB /
IndexedDB store / index / version / migration / reference-data / seed changes.
See `features/w2-rectangle-tool/stories/STORY-db-001.md`.

### Rationale

This feature promotes the released w0 generic `type:"box"` editor primitive into
a user-facing red-outline rectangle (restyle + relabel + add to the lossy
projection + render in the controller report). Its four surfaces touch **three
distinct persistence-adjacent layers — none of which is a database the
database-architect owns**:

1. **`projectAnnotations` box branch (`editor-model.js:45-63`).** Adding a
   `box`→`{id, type, x, y, width, height}` entry (with `Math.round`) to the lossy
   projection is a pure in-memory model→array *projection-shape* change executed
   in the content script. No store, no index, no schema, no version bump. The
   companion frozen-test update (`extension/editor.model.test.mjs:88-101`) is a
   unit-test change, not a data artifact. **FE-owned.**

2. **The rectangle's persistent home is `screenshots[].model`** — the
   `{type:"box"}` item rides the **opaque structured-clone value** field released
   by `w0-editor-foundation`. `deserializeModel` passes items through opaquely
   (`editor-model.js:72-81`); the model/wire `type` literal **stays `"box"`** for
   round-trip back-compat with already-persisted records. Adding/projecting a
   value that is already stored opaquely touches **no `kv` object-store
   definition, no index, and no `indexedDB.open("snapdeck", 1)` version bump**
   (stays v1) — the same value-vs-schema distinction as `w1-text-box-autofit`.
   **FE/extension-owned.**

3. **The controller report bundle (`controller/snapdeck_controller/reports.py`).**
   The projection now reaches the in-repo controller's `save_report`, which writes
   **flat files on disk** — `out_dir/"report.json"` (line 172) and
   `out_dir/"report.md"` (line 173). `annotations` are stored **opaquely**
   (`shot.get("annotations") or []`, line 147) → straight into `report.json` with
   no type validation. The in-scope `_render_markdown` rectangle branch (~line 227)
   is **pure rendering** of an already-persisted opaque dict. There is **no SQL,
   no ORM, no relational/managed DB, and no migration mechanism** behind the
   controller — it is flat-file output. **BE/Python-owned (backend-architect).**

No new IndexedDB object store, no index, no `report` record-shape change, no
reference/seed data, no localized strings, no retention rule change, and no
controller database.

### Ownership boundary

- **`projectAnnotations` box branch + frozen-test update (`editor-model.js`,
  `editor.model.test.mjs`)** → `frontend-architect` (FE story set); pure
  model-transform + unit-test change.
- **`renderBox` restyle + draw-preview restyle + toolbar relabel (`editor.js`)** →
  `frontend-architect` (FE story set); render/UI only, no persistence.
- **Editor `model` rectangle item (`{type:"box"}`)** → opaque value on the released
  `screenshots[].model` structured-clone seam (`w0-editor-foundation`); persisted
  verbatim by `addScreenshot()` in `background.js` — no storage-helper change.
- **Controller `report.md` rectangle render (`reports.py` `_render_markdown`)** →
  `backend-architect` (BE/Python story); flat-file output, opaque `annotations`,
  no DB.
- **IndexedDB `report` store (`snapdeck`/`kv`, `report:<port>` keying)** → unchanged;
  owned by released `w0-per-target-reports` (FE/extension domain).
- **Editor `model` envelope (`{version:1, items:[…]}`)** → unchanged; frozen by
  released `w0-editor-foundation` (`editor-model.js`).

### Cross-domain confirmation

Sentinel status was coordinated with **both** `frontend-architect` (the rectangle
projection + `model` persistence add no IndexedDB store/index/version change —
value rides the released w0 seam) and `backend-architect` (the controller persists
to flat `report.json`/`report.md` with opaque `annotations`; the `_render_markdown`
rectangle branch needs no paired DB story) before finalizing — the unconditional
Phase-5 peer-message floor. See `features/w2-rectangle-tool/conversations/`.

### Migration / rollback strategy

N/A — no server-side schema to migrate forward or reverse, and no IndexedDB
store/version change. The rectangle is an opaque value-shape addition on the
released `model` seam (forward-compatible by construction — the wire `type` stays
`"box"`, so already-persisted records round-trip unchanged), and the controller
writes flat files. The forward-only/soft-delete policy is not engaged because no
schema is created, altered, or dropped by this feature; the value-shape change is
owned by the FE stories and the flat-file render by the BE story.
