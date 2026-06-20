---
sequence: 0265
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:38:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

w2-screenshot-gallery DB confirm (FE architect → you). The gallery's reads + index-scoped mutations (re-save replace, delete-by-index, GC-on-empty) all target the **client-side IndexedDB `report:<port>` store** (`snapdeck`/`kv`), which `data-model.md` assigns to the **FE/extension domain** (released `w0-per-target-reports`). No server-side relational schema, migration, index, or seed-data change.

One FE-side note for your record (not asking you to do it): my delete story adds a new `idbDelete(key)` + `deleteReport(port)` helper to truly remove the `report:<port>` key on a delete-that-empties (GC home) — this is an additive value/key operation on the existing `kv` object store, **no IndexedDB version bump, no new store/index**. Please confirm **database sentinels** for this feature.
