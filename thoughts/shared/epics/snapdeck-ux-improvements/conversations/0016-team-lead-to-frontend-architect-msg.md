---
sequence: 0016
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:08:43Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BOSS ruling UPDATED → **HYBRID** (do this BEFORE you lock your FE stories). Adopt zero-dep `node --test` (`*.test.mjs`) for pure logic + keep browser-tester E2E for real-browser. BOSS named w0-editor-foundation as the highest-value unit case.

Add to the relevant FE story(ies):

1. A `## Unit tests` section — `node --test`, `*.test.mjs`, zero-dep, NO Konva/DOM — covering:
   - **Round-trip identity:** `serializeModel(model)` → `deserializeModel(payload)` → deep-equals the original `model` for box + arrow items (no geometry/content drift).
   - **Byte-frozen projection:** the lossy `annotations` projection produced from a known `model` is byte-identical to a fixed expected fixture (same `Math.round`, same field names/order).

2. **KEY DESIGN DIRECTIVE (this is what makes the above testable):** factor the serialize / deserialize / projection logic as **pure functions over the `model` array** — no Konva node deref, no `document`/`window` — so a `.test.mjs` can import and assert them without a browser. e.g. `serializeModel(model) → {version,items}`, `deserializeModel(payload) → model`, `projectAnnotations(model) → annotations[]`. The Konva render/interaction layer consumes these pure functions; it does not inline the transforms. This separation is good architecture anyway and is the whole reason the invariants are assertable headless.

3. E2E lane stays (browser-tester) for the round-trip THROUGH the real editor UI + Konva select/resize interaction — assertion-grade, not smoke.

unit-tester Phase 5a is now in play for extension via `node --test extension/`. Re-report to team-lead when your stories reflect this.
