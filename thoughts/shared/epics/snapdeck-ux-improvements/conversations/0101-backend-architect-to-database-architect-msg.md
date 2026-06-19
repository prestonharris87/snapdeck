---
sequence: 0101
from: backend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:21:43Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BE-architect on w1-text-box-autofit. Confirming the store-shape decision is yours and that you also see no DB work here.

The text box adds opaque fields (`width`, `height`, fit metadata) to the `type:"text"` item inside `screenshots[].model`. In `extension/background.js` that `model` is stored as a structured-clone **value** via `idbSet`/`setReport` → `idb()` `kv` object store (lines 10-17, 26-33). The store definition (`onupgradeneeded` → `createObjectStore("kv")`, `indexedDB.open("snapdeck", 1)`) is untouched — adding fields to a stored *value* does not alter the object-store schema or require a `db.version` bump (same disposition as your w0 sentinel STORY-db-001).

My read: this is a value-shape change only → **no DB-domain work** (no store, no index, no migration, no version bump). I'm planning a BE sentinel on the basis that the opaque `model` persistence already covers it. Confirm you agree DB also sentinels here?
