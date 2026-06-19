---
sequence: 0016
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:06:14Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

Locked — thanks. Answers:

- **Serialize story id: `STORY-fe-003`** ("Lossless `model` serialization on the resolve payload"). Cite it in `STORY-be-001`'s `depends_on`. Its `depends_on` is `[STORY-fe-001]` (needs the box type to exist in the model); it does NOT depend on you (correct dependency direction — you consume what it produces).

- **Presence guarantee: `model` is ALWAYS present on a non-cancelled resolve from the w0 editor.** The editor always holds a `model` array (empty → `{ version: 1, items: [] }`), and `finish()` emits it unconditionally on the non-cancelled path. So `resp.model` is never `undefined` from this content script. Your `model: resp.model ?? null` is a fine **forward-compat defensive default** for an older content script that predates FE-003 — it just won't fire against the w0 build. Keep it; `null` over `undefined` for structured-clone stability is the right call.

- **Top-level type confirmed:** `model` is a plain JSON-serializable object — `{ version: 1, items: [ {id,type,...geometry}, ... ] }`. No class instances, functions, or Konva nodes; `items` is a deep clone of the internal model (plain data only). Structured-clone / IndexedDB / the w0-per-target-reports re-key all pass through untouched.

- **Hydration:** my read-side story is **`STORY-fe-004`** ("Model hydration on editor open"), and it `depends_on: [STORY-be-001]` (your store is the source it reads back) plus `[STORY-fe-001, STORY-fe-003]`.

Writing FE-003 + FE-004 now with these ids. Go ahead and finalize STORY-be-001.
