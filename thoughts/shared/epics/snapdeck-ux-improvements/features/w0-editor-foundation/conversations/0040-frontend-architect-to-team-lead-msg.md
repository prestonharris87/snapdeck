---
sequence: 0040
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:23:56Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**Good news — the edges are already on disk.** Your read predated my hybrid-ruling rewrite (it crossed with my re-report). Just grep-verified the live frontmatter:

- `STORY-fe-003 depends_on: [STORY-fe-001, STORY-fe-005, STORY-do-001]` ✓
- `STORY-fe-004 depends_on: [STORY-fe-001, STORY-fe-003, STORY-fe-005, STORY-do-001, STORY-be-001]` ✓

Note I keep **fe-005 explicit on fe-004** (not just transitive via fe-003): fe-004 directly calls `deserializeModel` from fe-005's module, so it's a direct consumer — declaring it is correct per the cite-every-consumer rule. No harm; still acyclic.

**Single-source confirmed:** serialize/project/deserialize live **only** in fe-005's `editor-model.js`. fe-003's `finish()` calls `__snapdeckEditorModel.projectAnnotations` + `serializeModel`; fe-004's hydration calls `__snapdeckEditorModel.deserializeModel`. Both stories explicitly forbid re-implementing the logic inline (`files_not_modified` lists `editor-model.js`). No drift between the tested module and the runtime path.

**Consolidated final report — 5 FE stories:**

| id | one-liner | depends_on | test file(s) |
|---|---|---|---|
| **fe-001** | Box annotation primitive — `{id,type:"box",x,y,w,h}` model item + `renderBox` + Box tool | `[]` | E2E `extension/e2e/w0-editor-foundation.spec.ts` (Konva draw/render) |
| **fe-002** | Shared `Konva.Transformer` move/resize + box select mode (`attachBoxTransformer` helper) | `[fe-001]` | E2E `…/w0-editor-foundation.spec.ts` (Konva transformer/select) |
| **fe-005** | Pure module `editor-model.js` (`serializeModel`/`projectAnnotations`/`deserializeModel`) + node:test | `[fe-001]` | **node** `extension/editor.model.test.mjs` (the unit lane) |
| **fe-003** | Wire `finish()` serialize/projection via pure module; projection byte-frozen; `annotated` gate→`model.length` | `[fe-001, fe-005, do-001]` | **node** `extension/editor.model.test.mjs` + E2E `…/w0-editor-foundation.spec.ts` |
| **fe-004** | Hydrate `openEditor` via `deserializeModel`; ANNOTATE reads optional `msg.model` | `[fe-001, fe-003, fe-005, do-001, be-001]` | **node** `extension/editor.model.test.mjs` + E2E `…/w0-editor-foundation.spec.ts` |

**Contracts:** `model` wire (sibling of `annotations`, `{version:1, items:[…verbatim…]}`) ratified with backend (be-001 stores opaque, `depends_on fe-003`); manifest reg ratified with devops (do-001 registers `editor-model.js` before `editor.js`, `depends_on fe-005`); global name `globalThis.__snapdeckEditorModel` confirmed.

**Full DAG (acyclic):** fe-001 → {fe-002, fe-005}; fe-005 → do-001; {fe-001, fe-005, do-001} → fe-003 → be-001; {fe-001, fe-003, fe-005, do-001, be-001} → fe-004. Topo order: fe-001, fe-002, fe-005, do-001, fe-003, be-001, fe-004.

Ready for DAG-validate + PO arbitration. No `needs-user-input` clarifications.
