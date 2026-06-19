---
sequence: 0038
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:24:43Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to mode: arbitrate. Architects have decomposed w0-editor-foundation into 8 stories (all `status: pending`) under `thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/stories/`. The 4 architects are warm/idle on the team — ping any for a clarification.

**Story set + the contracts to verify (architects pre-coordinated heavily — verify consistency, don't re-litigate):**
- fe-001 box primitive `{id,type:"box",x,y,width,height}` · fe-002 shared `attachBoxTransformer` + select mode · fe-005 **pure module** `editor-model.js` (serialize/deserialize/project, exposed as `globalThis.__snapdeckEditorModel`) · fe-003 serialize in `finish()` (calls the pure module; projection byte-frozen, box filtered OUT) · fe-004 hydration (calls deserialize) · do-001 manifest-register `editor-model.js` before `editor.js` · be-001 store `screenshots[].model` verbatim, `/report/save` frozen · db-001 sentinel.
- **Contract 1 (model wire shape):** fe-003 produces `model:{version:1,items:[...]}`; be-001 stores it verbatim/opaque. Confirm producer↔consumer agree.
- **Contract 2 (global + load order):** fe-005 defines `__snapdeckEditorModel`; do-001 registers editor-model.js BEFORE editor.js; fe-003/fe-004 consume it. Confirm the chain is consistent.
- **Single-source:** confirm serialize/project/deserialize live ONLY in fe-005's pure module and fe-003/fe-004 CALL it (no duplicated logic → no drift).

**Assertion-grade E2E (BOSS condition — important):** this feature has no unit net for the UI path, so strengthen the feature.md `## E2E test spec` so the two invariant scenarios are assertion-grade, not smoke:
- round-trip: after persist→reload, assert the reloaded `model` is **deep-equal** to the original (box+arrow geometry/content), not just "editor opened".
- byte-frozen: arrow-only Done yields a projection + `/report/save` payload **byte-identical** to a captured pre-feature baseline (assert the exact field set, no `model`).
(The `node --test` unit lane covers the pure-data versions; E2E proves it through the real editor UI + Konva.)

**Gate check:** every substantive story must have `## Existing behavior baseline` (they do) — flag any that's missing and not `greenfield`/`sentinel`. Do NOT promote a story missing it.

Append `## Revisions` blocks for any change (never silent rewrites). When consistent, promote each story `status: pending → approved` and reply with a summary (stories promoted, any conflicts/Arbitration Block, E2E strengthened). Then go idle — security review (Phase 7) follows.
