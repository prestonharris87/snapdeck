---
type: story
id: STORY-db-001
name: "DB sentinel — gallery rides released report:<port> IndexedDB, no schema change"
domain: database
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: database-engineer
author_architect: database-architect
effort: 1
status: approved
sentinel: true
depends_on: []
created_at: 2026-06-20T16:21:00Z
last_run_id: run-20260620-161818-88519
frontend_lane: N/A
visual_references: []
defects: []
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/background.js
  - extension/popup/popup.js
  - extension/popup/popup.html
  - extension/popup/popup.css
reuse_patterns:
  - thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:55 (w0-per-target-reports sentinel + IndexedDB ownership correction)
  - thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:283 (w1-dynamic-icon-badge sentinel — read-only report consumer pattern)
---

# Story: DB sentinel — no server-side database changes for the screenshot gallery

> **Sentinel story.** No implementation work for the database-engineer. Recorded
> so the per-feature DB domain is explicitly accounted for, the sentinel decision
> is auditable, and the dependency graph is complete.

## What we're doing

**No server-side database changes.** Snapdeck is a Chrome MV3 extension with **no
server-side relational database and no migration framework**. Its only persistent
client-side store is IndexedDB (`snapdeck`/`kv`, key `report:<port>`), and per the
established ownership correction in `data-model.md` § `w0-per-target-reports`, that
IndexedDB store is **frontend/extension domain** — owned by `frontend-architect`,
not the server-side database-architect. The server-side database domain is
therefore a **sentinel** for `w2-screenshot-gallery`.

The gallery does **index-scoped reads / mutations of the existing `report:<port>`
record only**, all through the **released** `w0-per-target-reports` helpers
(`getReport(port)` / `setReport(port, r)` / `clearReport(port)`):

- **Fetch** — reads `getReport(port).screenshots[]` in full for the current target.
- **Re-open + re-save** — replaces **one** `screenshots[]` element in place
  (`original` unchanged; `model` / `annotated` / `annotations` re-rendered;
  `console` / `network` / `meta` preserved).
- **Delete** — splices **one** `screenshots[]` element; an emptying delete
  **removes the `report:<port>` key** from the existing `kv` store via the FE-owned
  `deleteReport(port)` / `idbDelete(key)` helper (the GC home for the per-target
  LOW-2 forward-flag) so the store does not accumulate empty/stale entries. (FE
  confirmed 2026-06-20: key-removal is an additive value/key-level op — no
  `indexedDB.open("snapdeck", N)` version bump, no new store, no new index.)

None of these add a new object store, a new index, an
`indexedDB.open("snapdeck", N)` version bump, a record-key/record-shape change, or
any reference/seed/retention data. They are value-level read/splice/replace
operations on an already-released key.

## What it should look like

Nothing to implement, schema-side. There is **no migration, no version/manifest
bump, no stored-logic artifact, no reference/seed row, and no index**. The
`indexedDB.open("snapdeck", 1)` / `createObjectStore("kv")` definition is
untouched (stays at v1). The `{ note, screenshots[] }` value shape and the
`report:<port>` key released by `w0-per-target-reports` are unchanged.

The new `background.js` message handlers (fetch-report-screenshots, re-open-and-
resave by index/id, delete by index/id — each resolving `currentTargetPort()`
internally) are **message-routing + value-level helper calls**, owned by
`backend-architect` (service-worker domain). The popup gallery UI is owned by
`frontend-architect` (`extension/popup/*`). Neither is a database/schema artifact.

## How we're doing it

No migration ordering identity is claimed (there is no migration mechanism in this
repo to claim one from). `files_modified: []`. The sentinel is recorded in:

- This story (`STORY-db-001.md`, `sentinel: true`).
- `data-model.md` § `Feature w2-screenshot-gallery` (sentinel decision + FE-owned
  IndexedDB ops + ownership boundary table).

## How we validate

- [ ] **Schema diff is empty** — the database-engineer opens no migration, edits no
  schema/version manifest, and adds no stored-logic/seed artifact for this feature.
  A non-empty DB-domain diff would itself be the defect.
- [ ] The gallery's data behavior (fetch/re-save/delete/GC, two-port isolation,
  count+badge tick, bounded arbitrary-model re-open) is validated by the FE/BE
  stories and the PO's E2E specs — not by any server-side schema assertion.

## Unit tests

N/A for the server-side DB domain — there is no migration to run against a fresh
local DB and no schema to inspect. The gallery's IndexedDB behavior is exercised by
the feature's E2E specs (browser-tester Playwright lane for the Konva-render-
dependent re-open / hostile-model scenarios; `node --test` where applicable),
owned by the FE/BE story set, not by this DB sentinel.

## Dependencies

`depends_on: []`. This is a sentinel for the server-side DB domain — there is no
server-side schema lineage to chain to. The client-side IndexedDB store this
feature reads/mutates was released by `w0-per-target-reports` (FE/extension
domain), and the `model` it round-trips was released by `w0-editor-foundation`
(FE/extension domain); those are FE-owned producers, not DB-domain producer
stories, so they are tracked via the **feature-level** `depends_on:
[w0-per-target-reports, w0-editor-foundation]` (feature.md), not as DB-story
dependencies. There are no prior DB stories in this epic (every sibling DB domain
is likewise a sentinel), so an empty `depends_on` is correct here.

## Cross-domain confirmation

Sentinel status was coordinated with `frontend-architect` (owner of the IndexedDB
`report:<port>` store per the ownership correction) at the unconditional Phase-5
peer-message floor — **confirmed by FE 2026-06-20** that the gallery rides entirely
inside the released `report:<port>` keying with no new object store, no
`indexedDB.open("snapdeck", N)` version bump, no new index, and no
record-key/record-shape change (the GC-on-empty path uses the FE-owned
`deleteReport(port)` / `idbDelete(key)` key-removal helper — still an additive
value/key-level op on the existing `kv` store). See
`../conversations/0001-database-architect-to-frontend-architect-msg.md`.

## Note on the user-driven Delete (not a server-side destructive change)

The feature's **Delete is intentionally destructive at the client-side value
level** — it removes a single `screenshots[]` element and clears the
`report:<port>` key when the report empties. This is a **frontend/extension
client-side operation gated behind an explicit in-popup confirmation step** (owned
by the FE story set), **not** a server-side schema drop. The server-side
database-architect's `destructive: true` flag + human-review Open Question rule
governs dropping a server-side table/column with data loss; it does not apply to
this DB sentinel, which authors no schema and no destructive DDL. The client-side
delete-confirm contract and the emptying-report key-removal GC (FE-owned
`deleteReport(port)` / `idbDelete(key)`) are owned and detailed by the FE/BE
stories.

## Revisions

### 2026-06-20 — product-owner (arbitrate, run-20260620 w2-screenshot-gallery)

- **Sentinel affirmed.** No server-side DB change for the gallery — verified the
  feature rides entirely inside the released `report:<port>` IndexedDB keying
  (FE/extension-owned per the `data-model.md` ownership correction); no migration
  mechanism exists in this repo and none is introduced. Cross-domain conflict: none
  (FE peer-confirmed the no-version-bump / no-new-store / no-new-index basis).
- **Validate checklist normalized to `- [ ]` items** (was prose bullets) so the
  finalize "≥1 `- [ ]` validate item per story" gate is satisfied. No content change —
  same two assertions (empty schema diff; behavior validated by FE/BE stories + PO E2E).
- The FE-side stable-identity revision (fe-001/002/003) is a value-level read/match
  change inside the existing `kv` store — still **no** schema/version/store/index impact,
  so this sentinel is unaffected.

**Status:** pending → approved.
