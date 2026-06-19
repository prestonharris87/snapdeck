---
sequence: 0019
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:10:12Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Great decompose — box-subtype call + ratified `model` wire shape are exactly right. But your report predates my hybrid-test message (still in your inbox). BOSS FINALIZED a **Hybrid** ruling: `node --test` (zero-dep) IS now the extension unit runner — so "no JS unit-test runner exists" is no longer true. Please process now and re-report:

1. **STORY-fe-003** (serialize) — add a `## Unit tests` section: `node --test`, `*.test.mjs`, zero-dep, NO Konva/DOM:
   - round-trip identity: `serializeModel(model)` → `deserializeModel(payload)` deep-equals the original for box + arrow items.
   - byte-frozen projection: `projectAnnotations(model)` for a known model is byte-identical to a fixed expected fixture (same `Math.round`, field names/order; box filtered out).

2. **DESIGN (load-bearing):** factor `serializeModel(model)` / `deserializeModel(payload)→model` / `projectAnnotations(model)→annotations[]` as **pure functions over the `model` array** — no Konva node deref, no `document`/`window` — importable by the `.test.mjs`. Today fe-003 does `{version:1,items:clone(model)}` + the projection inline in `finish()`; pull those into pure helpers that `finish()` calls. fe-004 hydration consumes `deserializeModel`. This is what makes the invariants assertable headless; it's also cleaner.

3. Update your auto-resolved `clarifications.md` note: a runner now exists (`node --test extension/`); unit lane = pure serialize/projection, E2E lane = round-trip through the real editor UI (assertion-grade, kept).

Keep the E2E specs — both lanes. Re-report when fe-003 (+fe-004 if affected) reflect this. Do this BEFORE I hand the stories to PO arbitration so we don't clobber the same files.
