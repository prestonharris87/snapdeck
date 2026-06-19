---
id: STORY-db-001
name: "Sentinel — no server-side DB changes for per-target reports"
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

# DB-001: Sentinel — no server-side DB changes for per-target reports

**No database changes required for this feature.**

Rationale: this feature's storage is the browser's **client-side IndexedDB**
object store (`snapdeck`/`kv`) inside the Chrome MV3 extension service worker —
not the project's server-side database — so it carries no migration, index, or
seed/reference-data change in my domain.

## What we're doing

Nothing in the server-side data layer. `w0-per-target-reports` re-keys the
extension's in-progress report from a single global IndexedDB record
(`kv` key `"report"`) to a per-browser-port key (`report:<browserPort>`) inside
the **same** generic `kv` object store. Per the locked scope, this requires **no
IndexedDB version bump** (the `kv` store is already generic) and **no
controller/CLI change** (the `/resolve` and `/report/save` endpoints are
unchanged). The entire change lives in `extension/background.js` storage helpers
and message handlers — client-side service-worker JavaScript.

## Why this is a sentinel (domain boundary)

- **Snapdeck has no server-side relational database and no SQL migration
  mechanism.** The only persistent store is the browser's IndexedDB, owned and
  versioned in extension code, not via the project's migration mechanism. There
  is no schema artifact, version manifest, stored procedure, view, permission,
  menu entry, localization string, or lookup/seed row for me to author.
- **The IndexedDB re-keying is frontend/extension domain work, not server-side
  DB work.** The scope.md phrase "No DB version bump required" refers to that
  *browser* IndexedDB object store — which is owned by the frontend/extension
  domain (`frontend-architect`), not by my migration mechanism. The per-port key
  format (`report:<browserPort>`), the empty-record default
  (`{ note: "", screenshots: [] }`), the `getReport(port)` / `setReport(port, r)`
  / `clearReport(port)` storage helpers, and the `GET_STATE` `{ count, note,
  port }` shape are all modeled by the **frontend-architect** in this feature's
  FE story set. (See the ownership-handoff note in the epic `data-model.md`
  § `w0-per-target-reports`.)
- **No new object store, no new index, no record-shape change that touches my
  domain.** The record shape `{ note, screenshots[] }` is unchanged; only its
  *key* changes (one global key → one key per port), and that key is derived in
  service-worker JS via the existing `portOfUrl(url)` seam.
- **No data migration in my domain.** The scope explicitly forbids migrating
  pre-epic global report data (the legacy `"report"` key is abandoned on upgrade,
  not read forward) — and even that is a client-side IndexedDB concern, not a
  server-side migration.

## Cross-domain contract

The prior sibling sentinel (`w0-keyboard-shortcuts/stories/STORY-db-001.md`) and
the epic `data-model.md` header previously named *this feature's
database-architect* as "owner of the report-store section." Per the team-lead's
authoritative ruling for this run, that ownership is reassigned: the IndexedDB
report-store per-port model is **frontend/extension domain** and is owned by
`frontend-architect` here. I have handed off that model explicitly so it does not
fall through the cracks — see
`../conversations/0001-database-architect-to-frontend-architect-msg.md`.

## How we validate

There is no migration to run against a local DB — there is no server-side schema
artifact. The database-validator's check is simply that this feature's database
story diff is **empty** (the database-engineer makes no server-side data-layer
edits). All report-store changes land in `extension/background.js` under the
frontend/extension stories, not here. If a server-side schema/migration/seed
artifact ever appears in this feature's diff, this sentinel is wrong and must be
reopened.

## Unit tests

None. Sentinel stories carry no migration and no server-side schema to inspect
against a fresh local DB. The IndexedDB report-store behavior (per-port
isolation, save/clear isolation, service-worker-restart persistence,
non-target empty state) is exercised by the frontend/extension stories and the
feature's E2E specs — not by any server-side DB unit test.

## Dependencies

None. `depends_on: []` is valid here because this is a sentinel that creates and
consumes no server-side schema. The IndexedDB `kv` store it deliberately does NOT
treat as a migration target is browser-resident client-side storage, owned by the
frontend/extension domain in this same feature.
