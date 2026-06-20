---
name: "DB sentinel — no schema/store change (rectangle rides opaque model + flat report)"
assignee: database-engineer
author_architect: database-architect
status: pending
sentinel: true
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/content/editor.js
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
  - extension/background.js
  - controller/snapdeck_controller/reports.py
reuse_patterns:
  - thoughts/shared/epics/snapdeck-ux-improvements/features/w1-text-box-autofit/stories/STORY-db-001.md:1
  - thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/stories/STORY-db-001.md:1
depends_on: []
---

# STORY-db-001 — Database sentinel (no database changes required for this feature)

**No database changes required for this feature.**

## What we're doing

Nothing, in the database domain. This story exists as the explicit sentinel record
that `w2-rectangle-tool` requires **zero** server-side DB / IndexedDB store / index
/ version / migration / reference-data / seed / retention changes. The
database-engineer should pick this up, confirm there is no schema work, and resolve
it without writing a migration.

## Rationale (grounded in what I read)

Snapdeck is a **Chrome MV3 extension with an in-repo Python controller** — there is
**no server-side relational database and no SQL/ORM migration framework**. This
feature's four surfaces touch three distinct persistence-adjacent layers, **none of
which is a database the database-architect owns**:

1. **The lossy projection (`extension/content/editor-model.js:45-63`).** Adding a
   `box`→`{id, type, x, y, width, height}` entry (with `Math.round`, model/wire
   `type` kept literal `"box"`) to `projectAnnotations` is a pure in-memory
   model→array *projection-shape* change running in the content script. The
   companion frozen-test update (`extension/editor.model.test.mjs:88-101`, the
   `projectAnnotations excludes box items` / `returns empty array for box-only
   model` cases) is a **unit-test** change. Neither is a store, index, schema, or
   migration. **FE-owned (STORY-fe).**

2. **The rectangle's persistent home is `screenshots[].model`** — an **opaque
   structured-clone value** field released by `w0-editor-foundation`. The
   `{type:"box"}` item already round-trips opaquely: `deserializeModel` passes
   items through without per-item validation (`editor-model.js:72-81`), and
   `addScreenshot()` stores `model` verbatim in `background.js`. Projecting /
   persisting a value that is already stored opaquely touches **no `kv`
   object-store definition, no index, and no `indexedDB.open("snapdeck", 1)`
   version bump** (stays v1). This is the recurring Snapdeck **value-vs-schema**
   distinction — identical to `w1-text-box-autofit`. **FE/extension-owned.**

3. **The controller report bundle (`controller/snapdeck_controller/reports.py`).**
   The projection now reaches the in-repo controller's `save_report`, which writes
   **flat files on disk** — `out_dir/"report.json"` (line 172) and
   `out_dir/"report.md"` (line 173). `annotations` are stored **opaquely**
   (`shot.get("annotations") or []`, line 147) with no type validation. The
   in-scope `_render_markdown` rectangle branch (~line 227) is **pure rendering**
   of an already-persisted opaque dict. There is **no SQL, no ORM, no
   relational/managed DB, and no migration mechanism** behind the controller — it
   is flat-file output. **BE/Python-owned (STORY-be).**

No new IndexedDB object store, no index, no `report` record-shape change, no
reference/seed data, no localized strings, and no retention-rule change.

## Ownership boundary (do NOT treat these as DB work)

| Surface | Owner | Why not DB |
|---|---|---|
| `projectAnnotations` box branch + frozen-test update (`editor-model.js`, `editor.model.test.mjs`) | `frontend-architect` (STORY-fe) | pure model-transform + unit test |
| `renderBox`/draw-preview restyle + toolbar relabel (`editor.js`) | `frontend-architect` (STORY-fe) | render/UI only |
| Editor `model` `{type:"box"}` item persistence (`screenshots[].model`) | released `w0-editor-foundation` seam; stored verbatim by `addScreenshot()` | opaque structured-clone value; no store/version change |
| `report.md` rectangle render (`reports.py` `_render_markdown`) | `backend-architect` (STORY-be) | flat-file output, opaque `annotations`, no DB |
| IndexedDB `report` store (`snapdeck`/`kv`, `report:<port>` keying) | released `w0-per-target-reports` (FE/extension) | unchanged; not touched here |

## How we validate

- **Schema check:** there is no migration artifact in this story's (empty) diff. A
  fresh local provision is unaffected by this feature — there is no relational DB
  to provision. The "service starts" smoke is unchanged: no version-manifest /
  minimum-version gate exists or is bumped (Snapdeck has no such gate).
- **Negative assertion:** the engineer confirms `files_modified: []` — no
  `indexedDB.open("snapdeck", N)` version bump, no `createObjectStore`, no new
  index, no seed/reference row, anywhere in the diff for this feature.
- **Boundary assertion:** any rectangle-projection, model-persistence, or
  controller-render edits appear ONLY in the FE/BE story diffs (`STORY-fe-*`,
  `STORY-be-*`), never as a DB migration.

## Unit tests

N/A for the DB domain — there is no migration to run against a local DB and no
schema to inspect. The rectangle-projection unit-test update lives in the FE
story's `extension/editor.model.test.mjs` change (merged `node --test
extension/*.test.mjs` suite, currently 121/121); the controller render is covered
by the BE story's pytest on `_render_markdown`. Neither is a DB-domain artifact.

## Dependencies

`depends_on: []` — justified: this is a **sentinel**. There is no prior migration
to chain (Snapdeck has no migration mechanism), and this story creates, alters, or
drops nothing. The functional ordering (FE projection ↔ BE controller render must
agree on the projected `type` string) is a FE↔BE contract carried on those stories,
not a DB migration-ordering dependency.

## Cross-domain confirmation

Sentinel status was coordinated with **both** `frontend-architect` and
`backend-architect` before finalizing (the unconditional Phase-5 peer-message
floor):

- **frontend-architect** — confirm the rectangle projection + `model` persistence
  add no IndexedDB store/index/version change (value rides the released w0 seam).
- **backend-architect** — confirm the controller persists to flat
  `report.json`/`report.md` with opaque `annotations`; the `_render_markdown`
  rectangle branch needs no paired DB story.

Replies are auto-logged under `features/w2-rectangle-tool/conversations/`. The
epic-level data model records this decision in
`thoughts/shared/epics/snapdeck-ux-improvements/data-model.md` §
`w2-rectangle-tool`.
