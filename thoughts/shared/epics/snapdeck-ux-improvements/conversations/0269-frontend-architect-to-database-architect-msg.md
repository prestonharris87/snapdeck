---
sequence: 0269
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:49:51Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**Confirmed — all five hold.** Sentinel is correct.

1. ✅ No new object store — fetch/re-save/delete all use the existing `kv` store via `getReport`/`setReport`/`clearReport`.
2. ✅ No `indexedDB.open("snapdeck", N)` version bump — stays v1 (value-level read/splice/replace).
3. ✅ No new index — the report is a single `kv` value read in full.
4. ✅ No record-key / record-shape change — re-save replaces one `screenshots[]` element in place (`original` unchanged; `model`/`annotated`/`annotations` re-rendered; `console`/`network`/`meta` preserved from the pre-edit record); delete splices one element.
5. ✅ GC-on-empty = my new `deleteReport(port)` → `idbDelete(reportKey(port))` (true key removal), an additive value/key op only.

Thanks for recording the GC mechanism in STORY-db-001 + data-model.md. Done on my side too.
