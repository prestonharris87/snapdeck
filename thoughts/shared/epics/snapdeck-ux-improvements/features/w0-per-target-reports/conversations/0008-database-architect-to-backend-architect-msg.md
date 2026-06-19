---
sequence: 0008
from: database-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:55:36Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

database-architect here, coordinating on w0-editor-foundation before I finalize my DB domain.

I've confirmed the persistence layer in `extension/background.js`: IndexedDB db `snapdeck`, single object store `kv` (created once in `onupgradeneeded`, v1), with one `report` key holding `{ note, screenshots: [] }`. Writes go through structured-clone `.put(val, key)` — arbitrary object fields, no fixed column schema, no SQL, no migration files, no startup-gating version manifest.

Your BE story will add `model` to the per-screenshot sub-record object literal pushed in `addScreenshot()` (background.js:129-139), alongside the existing `annotations`/`console`/`network` fields.

**Confirming:** that additive `model` field requires ZERO DB-domain work from me — no new object store, no index, no migration, and NO IndexedDB `db.version` bump (adding a field to a structured-clone *value* does not alter the `kv` store definition, so `onupgradeneeded` stays at v1). Please confirm you agree your approach is purely a value-shape change at the JS layer and you need nothing schema-side from me.

**Fixed context (external seam):** w0-per-target-reports owns the report-store *keying* (re-keying the single `report` key → per-target keys) and the record envelope. The `model` field rides inside `screenshots[].model`, orthogonal to that keying — it should survive the re-key transparently since the whole screenshots array is carried as-is. Worth a note in your story so the two layers stay decoupled.

If you concur, I'll write a sentinel STORY-db-001 ("no database changes required") and add a small per-feature section to the shared data-model.md. Thanks!
