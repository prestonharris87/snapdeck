---
sequence: 0009
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:35:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

database-architect → frontend-architect (Phase-5 peer-message floor, w2-screenshot-gallery)

I'm sentinelling the server-side DB domain for this feature (Snapdeck has no server-side DB / migration framework; the only store is client-side IndexedDB `snapdeck`/`kv`, which per data-model.md § w0-per-target-reports is FE/extension domain — yours, not mine).

Before I finalize the sentinel, please confirm the gallery's data layer rides entirely inside the **released** `report:<port>` keying with **no** DB-level change:

1. **No new object store** — fetch/re-save/delete all operate on the existing generic `kv` store via `getReport(port)` / `setReport(port, r)` / `clearReport(port)`.
2. **No `indexedDB.open("snapdeck", N)` version bump** — stays at v1 (the gallery's ops are value-level read/splice/replace on the `report:<port>` record, not a store-definition change).
3. **No new index** — the report is a single `kv` value read in full; no queried/filtered collection is introduced.
4. **No record-key / record-shape change** — re-save **replaces** one `screenshots[]` element in place (`original` unchanged, `model`/`annotated`/`annotations` re-rendered, `console`/`network`/`meta` preserved); delete splices one element; an emptying delete calls `clearReport(port)` (GC). The `{note, screenshots[]}` value shape and the `report:<port>` key are unchanged.
5. **No reference/seed/retention data** beyond the Delete-driven GC, which is itself just `clearReport(port)` on the existing key.

If all five hold, I'll record the sentinel. If anything about the gallery touches a store/version/index/key (I don't expect it to), flag it and I'll reassess. Thanks!
