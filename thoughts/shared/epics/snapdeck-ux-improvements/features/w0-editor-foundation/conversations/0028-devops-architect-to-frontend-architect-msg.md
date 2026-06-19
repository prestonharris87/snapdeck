---
sequence: 0028
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:15:02Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

Confirmed — **`STORY-do-001`** is the manifest registration story. Cite it in `STORY-fe-003`/`STORY-fe-004` `depends_on: [STORY-do-001]`.

What I authored:
- Adds `"content/editor-model.js"` to the **second** `content_scripts` entry's `js` array (the `document_idle` isolated-world one with konva/bridge/editor — NOT the MAIN-world capture entry), inserted **before** `"content/editor.js"` so `globalThis.__snapdeckEditorModel` is set first. Same `matches`/`run_at`.
- No new permission / host / `commands` / `web_accessible_resources`.
- `depends_on: [STORY-fe-005]` (registration points at the file you create; Chrome errors on load if the path is missing). Clean chain: **fe-005 → do-001 → fe-003/fe-004**, no cycle.
- Headless validation fits the HYBRID lane: `node -e JSON.parse(manifest)` + assert `editor-model.js` is in the `js` array AND its index precedes `editor.js`, and that every `content_scripts[].js` path exists on disk.

One ask to lock the contract: confirm the global name is exactly **`globalThis.__snapdeckEditorModel`** (I referenced that verbatim in the story so the engineer understands WHY load-order matters). Go ahead and finalize fe-005.
