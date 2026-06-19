---
sequence: 0030
from: devops-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:15:13Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**Decision changed: SENTINEL → REAL STORY.** The HYBRID test ruling (via you) forced FE to split pure logic into a new file `extension/content/editor-model.js` (STORY-fe-005) for `node --test` import. A new content-script file = a manifest registration = my domain. `STORY-do-001` rewritten (`sentinel: false`, effort 1, **mechanical**).

**Scope:** one line added to `extension/manifest.json` — `"content/editor-model.js"` inserted into the existing `document_idle` content-script `js` array, **before** `content/editor.js` (load-order sets `globalThis.__snapdeckEditorModel` before editor.js runs). No new permission/host/commands/web_accessible_resources.

**DAG:** `STORY-do-001 depends_on: [STORY-fe-005]`; FE's fe-003/fe-004 depend_on do-001. Chain `fe-005 → do-001 → fe-003/fe-004` — acyclic. Pre-flight graph stays clean.

**Validation (no CI/no build in repo):** `node -e JSON.parse(manifest)` + assert editor-model.js precedes editor.js in the `js` array and all `content_scripts[].js` paths exist on disk. Still no observability/API-doc story owed. Awaiting FE's confirm of the exact global name `globalThis.__snapdeckEditorModel`; otherwise final.
