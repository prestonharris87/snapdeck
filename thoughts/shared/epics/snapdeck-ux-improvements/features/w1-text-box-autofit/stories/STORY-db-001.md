---
type: story
id: STORY-db-001
name: "No database changes — text-box fields ride opaque in model blob"
domain: database
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
assignee: database-engineer
author_architect: database-architect
effort: 1
status: pending
sentinel: true
depends_on: []
diff_estimate: none
files_modified: []
files_not_modified:
  - extension/background.js
  - extension/content/editor-model.js
  - extension/content/editor.js
reuse_patterns:
  - "thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:121 — w0-editor-foundation DB sentinel (additive structured-clone value-shape change = FE/BE domain, DB sentinel)"
  - "thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:55 — w0-per-target-reports DB sentinel + IndexedDB-is-FE/extension-domain ruling"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/stories/STORY-db-001.md:1 — sibling w1 sentinel story shape to mimic"
created_at: 2026-06-19T15:48:00Z
last_run_id: run-20260619-150554-36418
visual_references: []
defects: []
---

# Story: No database changes required for this feature

## What we're doing

**No database changes required for this feature.** This is an explicit
"no work needed" sentinel for the database domain.

`w1-text-box-autofit` reworks the editor's text tool into a draw-a-box,
auto-fit/wrap annotation. The new text item gains geometry + fit fields
(`width`, `height`, plus whatever fit metadata the frontend-architect chooses)
on the `type:"text"` item inside the editor's lossless `model`
(`{ version: 1, items: [...] }`). Those fields ride **OPAQUELY inside the
already-persisted `model` blob** — the additive structured-clone value seam
released by `w0-editor-foundation` on the per-screenshot record
(`screenshots[].model`). Persisting them touches **no** IndexedDB store/index
definition, **no** `report` record shape, and **no** server-side database
(there isn't one).

Snapdeck is a Chrome MV3 extension with **no server-side relational DB and no
SQL migration framework** (see `data-model.md` header). Its only persistent
store is the client-side IndexedDB `snapdeck`/`kv` object store, and — per the
standing team-lead ruling for this epic — that store and its record shape are
**frontend/extension domain**. Here it does not even change shape: the new text
fields are a *value-shape* addition inside the structured-clone JSON the store
already persists. So there is genuinely no schema, migration, index,
stored-logic, or reference/seed-data change for the database-architect role to
own.

## Why this is a sentinel (not substantive)

- **No server-side DB exists.** Snapdeck persists only client-side, in the
  browser. There is nothing to migrate forward/reverse and no migration
  mechanism to use.
- **The new fields are a structured-clone value-shape change, not a schema
  change.** `addScreenshot()` already stores `model: resp.model ?? null`
  verbatim/opaque (`extension/background.js:225`, per backend-architect) — no
  enumeration, no per-item whitelist — so the new text-item `width`/`height`/fit
  fields ride inside `screenshots[].model` with no storage-helper change. Adding
  fields to a stored *value* does not alter the `kv` object-store definition.
- **No IndexedDB store/index/version touch.** `getReport`/`setReport` →
  `idbSet` → `idb()` `kv` store and `indexedDB.open("snapdeck", 1)` /
  `createObjectStore("kv")` are untouched; **no `db.version` bump** (stays v1),
  no new object store, no index. (The in-progress report is a single `kv` value
  read in full — never a queried/filtered collection — so no index is warranted.)
- **No `report` record-shape change, per-port re-key respected.** The whole
  `screenshots[]` array (including `.model`) is carried as-is through the
  per-port re-key released by `w0-per-target-reports` (`reportKey(port)` →
  `report:<port>`); the new fields survive transparently.
- **Lossy projection stays byte-frozen.** Text still projects to
  `{ id, type:"text", x, y, text }`; new geometry/fit fields are **model-only**
  and never reach `saveReport()`'s `/report/save` whitelist
  (`extension/background.js:248-252`, per backend-architect). `projectAnnotations`
  is not modified.
- **No reference/seed data.** No permissions, menus, lookups, localized strings,
  or retention rules.

## Ownership boundary

- **Editor `model` text-item fields (`width`/`height`/fit)** → owned by
  `frontend-architect` (FE story set), as opaque additions to the
  `type:"text"` item; render-boundary sanity stays in `editor.js`, the pure
  module `editor-model.js` gains no per-item validation.
- **`screenshots[].model` opaque persistence** → owned by `backend-architect`
  (`background.js`); already stores `model` verbatim, so no change.
- **IndexedDB `report` store (`snapdeck`/`kv`)** → unchanged; owned by released
  `w0-per-target-reports` (FE/extension domain).
- **Editor `model` envelope (`{version:1, items:[…]}`)** → unchanged; frozen by
  released `w0-editor-foundation` (`editor-model.js`).

## How we validate it was done correctly

- [ ] No migration / DDL / schema artifact appears in this feature's diff (there
      is no server-side DB or migration mechanism to target).
- [ ] No change to `extension/background.js` IndexedDB helpers
      (`getReport`/`setReport`/`idbSet`/`idb`/`addScreenshot`), the `kv`
      object-store definition, the `indexedDB.open("snapdeck", 1)` version, or
      the `report` record shape.
- [ ] No change to `extension/content/editor-model.js` (`model` envelope +
      `projectAnnotations` byte-frozen).
- [ ] The new text-box geometry/fit fields appear ONLY as opaque fields on the
      `type:"text"` model item in the FE story diff — never in a new IndexedDB
      store/index, the `report` record shape, or the lossy `annotations`
      projection.

## Unit tests

n/a — sentinel story, no schema or data-delivery artifact to verify. Migrations
in this project would normally be verified by running them against a fresh local
store and inspecting the result, but there is no server-side DB and no migration
here. The auto-fit/wrap/round-trip behavior of the new model fields is covered by
the FE story's tests + the browser-tester E2E lane (per `feature.md` E2E specs),
not by a DB test.

## Dependencies

none — sentinel; no prior DB migration to depend on (this epic has no
server-side DB migrations; prior DB stories are themselves sentinels). The
`model`-envelope and `screenshots[].model` value seams this feature rides on were
released by `w0-editor-foundation` and `w0-per-target-reports`, but those are
FE/extension-domain value contracts, not DB-story dependencies.

## Cross-domain contract

Sentinel status was coordinated with **both** `backend-architect` and
`frontend-architect` before finalizing (the unconditional Phase-5 peer-message
floor — 4 messages exchanged):

- **backend-architect** (owner of `background.js` persistence) sentinel-confirmed:
  `addScreenshot()` stores `model` verbatim/opaque (`background.js:225`); the `kv`
  store / `indexedDB.open("snapdeck", 1)` / `getReport`/`setReport`/`idbSet` are
  untouched (value-shape change only, no version bump); the per-port re-key is
  respected; `saveReport()`'s `/report/save` whitelist (`background.js:248-252`)
  stays byte-frozen so the new fields never leave the model. BE is also writing a
  sentinel (STORY-be-001) on the same basis.
- **frontend-architect** (owner of the text model item + `model` envelope)
  concurred: the new `width`/`height`/fit fields are opaque additions to the
  `type:"text"` item, persisted inside `screenshots[].model` as plain JSON — no
  new IndexedDB store/key/index, no `indexedDB.open(...)` version bump, no
  re-keying, no retention/seed/reference data.

See this feature's `conversations/` log (database-architect ↔ backend-architect,
database-architect ↔ frontend-architect, "Confirm DB sentinel — text fields ride
opaque in model blob").

## History

- 2026-06-19 — created by database-architect (effort=1, sentinel, depends on none;
  BE+FE sentinel-confirmed via 4 peer messages)
