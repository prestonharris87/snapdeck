---
id: STORY-db-001
name: "Sentinel — no database changes for editor-foundation model"
assignee: database-engineer
author_architect: database-architect
status: pending
sentinel: true
greenfield: true
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/background.js
reuse_patterns: []
depends_on: []
---

# DB-001: Sentinel — no database changes for editor-foundation model

**No database changes required for this feature.**

Rationale: the lossless editor `model` rides **inside the existing per-screenshot
sub-record** via IndexedDB structured-clone — it is added as a plain additive field
on the object that `addScreenshot()` already pushes, not as a schema change. The
only persistent store is the browser's client-side IndexedDB (`snapdeck`/`kv`),
owned this wave by sibling feature `w0-per-target-reports` — not the project's
server-side migration mechanism. There is no migration, object store, index, or
seed/reference-data change in my domain.

## What we're doing

Nothing in the data layer. `w0-editor-foundation` persists the editor's full
internal `model` losslessly by adding a single additive `model` field to the
per-screenshot sub-record object literal that `addScreenshot()` already writes
(`extension/background.js:129-139`, alongside the existing
`annotations`/`console`/`network` fields). That value is written through the
**existing** structured-clone path (`setReport()` →
`objectStore("kv").put(val, key)`), which serializes arbitrary object fields with
no fixed column schema. Adding a field to a structured-clone *value* does not
touch the `kv` object-store definition, so **no `indexedDB.open("snapdeck", N)`
version bump** and **no `onupgradeneeded` change** is required — the store stays
at v1. This is purely a value-shape change at the JS layer, owned by the
frontend/backend (extension service-worker) stories, not a schema change.

## Why this is a sentinel (domain boundary)

- **Snapdeck has no server-side relational database and no SQL migration
  mechanism.** The only persistent store is the browser's IndexedDB, versioned in
  extension code rather than via the project's migration mechanism. There is no
  schema artifact, version manifest, stored procedure, view, permission, menu
  entry, localization string, or lookup/seed row for me to author.
- **The `model` field is additive structured-clone data, not schema.** IndexedDB
  `put(val, key)` stores the whole report value (`{ note, screenshots[] }`) by
  structured clone; new fields on a stored object require no store/index/version
  change. The geometry envelope (`{ version: 1, items: [...] }`) is a *value*
  contract owned by the FE/BE stories and the architects' frozen 🤝 CONTRACT — not
  a database schema artifact.
- **The IndexedDB report-store is owned by sibling `w0-per-target-reports` this
  wave.** That feature re-keys the single global `"report"` key → per-port keys
  inside the same generic `kv` store. `model` rides inside `screenshots[].model`
  and is **orthogonal** to that keying — the whole `screenshots` array is carried
  as-is through the re-key, so the field survives transparently. This feature
  treats `addScreenshot()` as a stable function-level seam and must NOT touch the
  report-store keying surface.
- **No new object store, no new index, no record-shape change in my domain.** No
  query is accelerated and no index is added (and none is warranted — the
  in-progress report is a single key holding a small array read in full, not a
  queried/filtered collection).

## Cross-domain confirmation

Sentinel status was coordinated with `backend-architect` (owner of the
service-worker / `background.js` `model`-storage work for this feature) **before**
finalizing. The agreement: adding `model` to the per-screenshot sub-record is a
value-shape change through the existing structured-clone path that needs nothing
schema-side — no object store, no index, no migration, and no IndexedDB version
bump. See `../conversations/0012-backend-architect-to-database-architect-msg.md`.
The external seam with `w0-per-target-reports` (report-store keying) was noted as
orthogonal — `model` survives the re-key because the screenshots array is carried
as-is.

## How we validate

There is no migration to run against a local DB — there is no server-side schema
artifact. The database-validator's check is simply that this feature's database
story diff is **empty** (the database-engineer makes no data-layer edits). The
`model` persistence lands in `extension/background.js` under the FE/BE
(extension service-worker) stories, not here. If a server-side
schema/migration/seed artifact — or any new IndexedDB object store / index /
version bump — ever appears in this feature's diff, this sentinel is wrong and
must be reopened.

## Unit tests

None. Sentinel stories carry no migration and no schema to inspect against a fresh
local DB. The round-trip behavior of the persisted `model`
(`model → persist → load → model` identity) is exercised by the FE/BE stories and
the feature's E2E specs (draw arrow + box → Done → read back `screenshots[].model`
→ assert geometry survived), not by any server-side DB unit test.

## Dependencies

None. `depends_on: []` is valid here because this is a sentinel that creates and
consumes no schema. The IndexedDB `kv` store it deliberately does NOT treat as a
migration target is browser-resident client-side storage, owned by sibling
`w0-per-target-reports` and surfaced through the FE/BE stories of this feature.
