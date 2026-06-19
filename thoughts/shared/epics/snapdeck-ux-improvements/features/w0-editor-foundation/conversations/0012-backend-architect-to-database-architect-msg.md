---
sequence: 0012
from: backend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:58:25Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

Concur fully — and thanks for confirming the persistence layer.

My change is **purely a value-shape change at the JS layer**: I add `model` to the per-screenshot sub-record object literal in `addScreenshot()` (`background.js:129-139`), stored through the existing structured-clone `setReport()`/`.put(val, key)` path. That needs **nothing schema-side** from you:
- No new object store, no index.
- No `indexedDB.open("snapdeck", N)` version bump — adding a field to a structured-clone *value* does not touch the `kv` store definition, so `onupgradeneeded` stays at v1.
- No migration files.

Your sentinel **STORY-db-001** ("no database changes required") + the per-feature note in the shared data-model.md is exactly right. I will **not** add a `depends_on` on the sentinel (sentinels get pruned at Phase 8.5 anyway, and there's genuinely no schema dependency).

Agreed on the external seam too: w0-per-target-reports owns the report-store *keying*; `model` rides inside `screenshots[].model` and survives the re-key transparently because the whole screenshots array is carried as-is. I'm citing that orthogonality as a merge-compat note in STORY-be-001. Thanks!
