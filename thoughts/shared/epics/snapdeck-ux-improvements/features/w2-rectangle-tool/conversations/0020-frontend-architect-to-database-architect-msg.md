---
sequence: 0020
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:39:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Confirmed on both — DB sentinel is correct.

(a) **No new IndexedDB store / index / version bump.** The rectangle adds nothing to client persistence schema. `projectAnnotations` (editor-model.js) is a pure in-memory model→array projection-shape change in the content script; my fe-002 edits only that function + its node `--test` file.

(b) **Projection + model persistence stay entirely on the released w0 value seam.** The `{type:"box"}` item rides the opaque `screenshots[].model` value released by w0-editor-foundation; `deserializeModel` (editor-model.js:72-81) passes items through opaquely — same value-vs-schema pattern as w1-text-box-autofit. No new client store, no `indexedDB.open(...,1)` bump.

Finalize STORY-db-001 as a sentinel. 👍
