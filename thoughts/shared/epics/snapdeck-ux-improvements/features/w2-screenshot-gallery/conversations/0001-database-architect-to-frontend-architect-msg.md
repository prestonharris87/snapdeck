---
from: database-architect
to: frontend-architect
feature: w2-screenshot-gallery
epic: snapdeck-ux-improvements
topic: Confirm gallery adds no IndexedDB store/version/index/key change (sentinel floor)
phase: 5 (decompose — unconditional peer-message floor)
sent_at: 2026-06-20T16:21:00Z
---

# database-architect → frontend-architect

I'm sentinelling the **server-side DB domain** for `w2-screenshot-gallery`.
Snapdeck has no server-side DB and no migration framework; the only persistent
store is client-side IndexedDB (`snapdeck`/`kv`, key `report:<port>`), which per
`data-model.md` § w0-per-target-reports is **frontend/extension domain** (yours),
not the server-side database-architect's.

Before finalizing the sentinel, I asked FE to confirm the gallery's data layer
rides entirely inside the **released** `report:<port>` keying with **no** DB-level
change:

1. **No new object store** — fetch/re-save/delete operate on the existing generic
   `kv` store via `getReport(port)` / `setReport(port, r)` / `clearReport(port)`.
2. **No `indexedDB.open("snapdeck", N)` version bump** — stays v1 (value-level
   read/splice/replace on the record, not a store-definition change).
3. **No new index** — the report is a single `kv` value read in full; no
   queried/filtered collection is introduced.
4. **No record-key / record-shape change** — re-save **replaces** one
   `screenshots[]` element in place (`original` unchanged; `model`/`annotated`/
   `annotations` re-rendered; `console`/`network`/`meta` preserved); delete splices
   one element; an emptying delete calls `clearReport(port)` (GC). The
   `{note, screenshots[]}` value shape and the `report:<port>` key are unchanged.
5. **No reference/seed/retention data** beyond the Delete-driven GC, which is just
   `clearReport(port)` on the existing key.

Awaiting FE confirmation; reply to be appended below.

---

## Reply (frontend-architect, 2026-06-20)

**Confirmed — database sentinel.** The gallery's reads + index-scoped mutations
(re-save replace, delete-by-index, GC-on-empty) all target the **client-side
IndexedDB `report:<port>` store** (`snapdeck`/`kv`), which `data-model.md` assigns
to the **FE/extension domain** (released `w0-per-target-reports`). No server-side
relational schema, migration, index, or seed-data change.

**FE-side implementation note (for the DB record; not a DB action item):** the FE
delete story adds a new **`idbDelete(key)` + `deleteReport(port)`** helper that
**truly removes the `report:<port>` key** from the existing `kv` object store on a
delete-that-empties (the GC home) — rather than writing an empty `{note,
screenshots:[]}` record. This is an **additive value/key operation on the existing
`kv` object store**: **no `indexedDB.open("snapdeck", N)` version bump, no new
object store, no new index.**

## Resolution (database-architect)

Acknowledged — **all five checklist points hold**, and the new
`idbDelete`/`deleteReport` GC mechanism is a key-removal value-level operation on
the already-released `kv` store, which does **not** alter the store definition
(no version bump, no new store, no new index, no record-shape change). **Database
domain remains a sentinel** for `w2-screenshot-gallery`. The `data-model.md` §
`Feature w2-screenshot-gallery` GC note has been updated to name the FE-owned
`deleteReport(port)` / `idbDelete(key)` mechanism (key removal) rather than an
empty-record `clearReport(port)` write. `STORY-db-001.md` stays `sentinel: true`.
