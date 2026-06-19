---
sequence: 0020
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:08:56Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**FE decompose complete for w0-editor-foundation** — 4 stories written to `…/stories/`, all `status: pending`, `frontend_lane: N/A`, `visual_references: []`. All edit `extension/content/editor.js` only.

**Stories (with baselines, file:line-cited, Verified 2026-06-19):**
- **STORY-fe-001** — Box annotation primitive: `{id,type:"box",x,y,width,height}` model item + `renderBox` (Konva.Rect) + drag-out **Box** tool. `depends_on: []`. effort 2.
- **STORY-fe-002** — Shared `Konva.Transformer` move/resize + box select mode; exposes the reusable `attachBoxTransformer(node,item)` helper (contract surface #3, rotateEnabled:false, one-at-a-time, dedicated select layer). `depends_on: [STORY-fe-001]`. effort 3.
- **STORY-fe-003** — Lossless `model` serialize in `finish()` (additive `model:{version:1,items:clone(model)}`); lossy projection kept **byte-frozen** (box filtered OUT; `annotated` gate widened to `model.length`, provably byte-identical). `depends_on: [STORY-fe-001]`. effort 2.
- **STORY-fe-004** — Model hydration on editor open (round-trip load half): ANNOTATE reads optional `msg.model`, version-guarded seed of internal model. `depends_on: [STORY-fe-001, STORY-fe-003, STORY-be-001]`. effort 2.

**Box-subtype decision:** ship a **generic `type:"box"`** (NOT a `text`→box migration). Rationale: keeps the frozen projection untouched (box is model-only), zero regression to existing point-anchored text, and it's the direct seed for w2-rectangle while w1-text-box adds its own subtype on the same `{x,y,width,height}` base + shared transformer. Least rework for w1/w2, lowest regression risk. Documented in STORY-fe-001 §Decision.

**Agreed `model` wire shape (ratified with backend-architect):** on the editor→background ANNOTATE resolve payload, additive field **`model: { version: 1, items: [ …internal model verbatim… ] }`** — sibling of `annotations`; `items` is a deep clone (plain JSON, no Konva nodes); always present on a non-cancelled resolve (empty ⇒ `items:[]`). BE **`STORY-be-001`** stores it **verbatim/opaque at `screenshots[].model`** (no field whitelist → w1/w2 subtype fields survive with zero BE change), and **NOT** added to `/report/save`. Producer = STORY-fe-003; consumer STORY-be-001 `depends_on` it.

**Peer messages sent: 3**
1. → **backend-architect** — proposed the `model` wire envelope; requested confirm field name/`{version,items}`, verbatim/no-whitelist storage, no `/report/save` change, + their story id; flagged the w0-per-target-reports re-key seam as theirs to hold.
2. → **backend-architect** — gave serialize story id (STORY-fe-003) + presence guarantee (`model` always emitted) + confirmed plain-JSON type; noted hydration (STORY-fe-004) `depends_on STORY-be-001`.
3. → **devops-architect** — confirmed **no** new file/script/host-permission/manifest entry (all in-file editor.js); Konva.Transformer from already-vendored `lib/konva.min.js`; their DevOps sentinel is correct.

**Also filed:** `clarifications.md` (auto-resolved) — no JS unit-test runner exists for the extension; FE "Unit tests" are specified as browser-tester Playwright E2E assertions in `extension/e2e/w0-editor-foundation.spec.ts` (matches the PO's feature.md E2E spec). No `needs-user-input` blockers.

DAG: fe-001 → fe-002; fe-001 → fe-003 → be-001; {fe-001, fe-003, be-001} → fe-004. No cycles.
