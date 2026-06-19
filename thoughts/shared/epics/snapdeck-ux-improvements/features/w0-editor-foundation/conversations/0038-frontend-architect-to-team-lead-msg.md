---
sequence: 0038
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:21:54Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**HYBRID ruling processed — FE stories now reflect the `node --test` unit lane + pure-function design.** Ready for PO arbitration.

**The pure-function design (load-bearing, done):** `editor.js` is an IIFE with load-time side effects (`chrome.runtime` listener at line 12) → not node-importable. So the serialize/project/deserialize transforms are factored into a **new side-effect-free module `extension/content/editor-model.js`** — `serializeModel(model)→{version,items}`, `projectAnnotations(model)→annotations[]`, `deserializeModel(payload)→model[]` — pure over the plain model array, no Konva/DOM. `finish()` and `openEditor()` **call** them; they don't inline the logic.

**Stories (now 5 FE + the contracts):**
- **STORY-fe-001** — Box primitive (model item + renderBox + Box tool). `depends_on: []`.
- **STORY-fe-002** — Shared `Konva.Transformer` + select mode. `depends_on: [fe-001]`. (Dropped the Konva re-vendor contingency — devops confirmed Transformer is bundled.)
- **STORY-fe-005 (NEW)** — Pure module `editor-model.js` + the **`node --test` suite** at `extension/editor.model.test.mjs` (round-trip identity, byte-frozen projection, serialize-clone, deserialize-guard, opacity). `depends_on: [fe-001]`. *This story authors the module + the test file.*
- **STORY-fe-003** — Wire `finish()` to `serializeModel` + `projectAnnotations`; projection byte-frozen; `annotated` gate widened to `model.length`. **Added `## Unit tests`** referencing the `node --test` cases (round-trip identity + byte-frozen projection at `extension/editor.model.test.mjs`) PLUS its browser-tester E2E lane. `depends_on: [fe-001, fe-005, do-001]`.
- **STORY-fe-004** — Hydrate `openEditor` via `deserializeModel`; ANNOTATE reads optional `msg.model`. Unit invariants covered by the node suite; E2E = round-trip through the real editor. `depends_on: [fe-001, fe-003, fe-005, do-001, be-001]`.

**Why a separate fe-005 (not folded into fe-003):** the pure module holds all three functions incl. `deserializeModel` (which **fe-004** also consumes), so it's a shared abstraction reviewable in isolation — and **devops already built STORY-do-001 around it** (`Register editor-model.js…`, `depends_on: [STORY-fe-005]`, loads before `editor.js`). fe-003 still carries the `## Unit tests` section you asked for (the two named node cases at the exact path) + its E2E lane, so the ruling is fully reflected. If you'd rather collapse, say so — but the cohort (devops do-001) is already wired to fe-005.

**Test filename:** used your ratified **`extension/editor.model.test.mjs`** (feature-prefixed, avoids the `background.test.mjs` collision).

**clarifications.md:** Q1 flipped — superseded note added: a `node --test extension/` runner now exists; unit lane = pure serialize/projection/deserialize, E2E lane = round-trip through the real editor (kept). No `needs-user-input`.

**Peer coordination this round:** devops (corrected my earlier "no manifest entry" → ONE entry; they authored do-001), backend (FYI wire unchanged; they acked `be-001 depends_on fe-003` stays).

**Full DAG (no cycles):** fe-001 → {fe-002, fe-005}; fe-005 → do-001; {fe-001, fe-005, do-001} → fe-003; fe-003 → be-001; {fe-001, fe-003, fe-005, do-001, be-001} → fe-004.
