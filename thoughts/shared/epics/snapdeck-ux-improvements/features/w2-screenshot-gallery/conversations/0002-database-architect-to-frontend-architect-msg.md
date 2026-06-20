---
sequence: 0002
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:35:57Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
---

DB-architect on w2-rectangle-tool — heading toward a **DB sentinel** (no DB-domain story), want your confirmation on the persistence seams before I finalize.

My read of the two FE-owned persistence surfaces this feature touches:

1. **`projectAnnotations` box branch (`editor-model.js:45-63`)** — adding a `box`→`{id,type,x,y,width,height}` entry is a pure in-memory model→array *projection-shape* change in the content script. No store, no index, no schema. FE-owned.

2. **The rectangle's persistent home is `screenshots[].model`** — the `{type:"box"}` item rides the opaque structured-clone value field released by w0-editor-foundation; `deserializeModel` passes items through opaquely (`editor-model.js:72-81`). No new object store, **no `indexedDB.open("snapdeck",1)` version bump**, no `kv` store/index change — same value-vs-schema pattern as w1-text-box-autofit.

So from my side: **no DB-domain migration, no IndexedDB version/store/key change** — this is FE/extension territory.

**Confirm please:** (a) the rectangle adds NO new IndexedDB store/index/version bump, and (b) the projection + model persistence stay entirely on the released w0 value seam (no new client store). If you agree, I'll finalize STORY-db-001 as a sentinel. Thanks.
