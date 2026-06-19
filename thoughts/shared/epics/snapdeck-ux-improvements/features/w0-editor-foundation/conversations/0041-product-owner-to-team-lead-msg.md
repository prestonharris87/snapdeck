---
from: product-owner
to: team-lead
type: arbitration-decision
feature: w0-editor-foundation
epic: snapdeck-ux-improvements
date: 2026-06-19
---

# PO arbitration — w0-editor-foundation (Phase 5 → stories approved)

8 stories reviewed: STORY-fe-001/002/003/004/005, STORY-be-001, STORY-do-001, STORY-db-001 (sentinel).
**All promoted `pending → approved`.** No re-architect cycle needed — the architects' cross-domain
coordination (40 conversation files) was thorough and the contracts are internally consistent.

## 1. Cross-domain contract verification — PASS

**FE→BE wire (contract surface #2, the load-bearing one, 4 dependents):**
- **Producer** STORY-fe-003 emits `resp.model = serializeModel(model)` → `{ version: 1, items: [...] }`,
  additive sibling of `annotations`, always present (empty ⇒ `items: []`), plain JSON.
- **Consumer** STORY-be-001 stores `resp.model ?? null` **verbatim/opaque** at `screenshots[].model` — no
  field whitelist, so w1/w2 box-subtype fields survive with zero backend change — and keeps `model` OUT of
  the `/report/save` whitelist (byte-frozen upstream).
- The item shapes (`arrow {x1,y1,x2,y2}` / `box {x,y,width,height}` / `text {x,y,text}`) match across
  fe-003, be-001, and the db-001 sentinel rationale. **Consistent.** Envelope is now ratified & frozen for
  STORIES_LOCKED — I firmed it into the feature.md AC (was "architect-ratifiable").

**`__snapdeckEditorModel` global chain — acyclic, correctly declared:**
`fe-005` (authors the pure module + node tests) → `do-001` (registers it in the manifest, ordered before
`editor.js`) → `fe-003` (finish/serialize) + `fe-004` (hydrate). Verified no cycle: fe-005 depends only on
fe-001; do-001 on fe-005; fe-003 on {fe-001, fe-005, do-001}; be-001 on fe-003; fe-004 on {fe-001, fe-003,
fe-005, do-001, be-001}.

**Round-trip identity holds end-to-end:** fe-002's `transformend` bakes Konva `scaleX/scaleY` into
`width/height` (reset to 1) → fe-003 `serializeModel` → be-001 verbatim store → fe-004 `deserializeModel`
→ `render()`. `deserializeModel(serializeModel(m))` is deep-equal `m` (clone∘clone). The float geometry
from a resize survives JSON round-trip.

## 2. depends_on / wave-DAG validation — PASS (manual)

Every cited STORY id exists in the feature; every consumer declares its producer (be-001→fe-003,
fe-004→{producers}, do-001→fe-005); all `depends_on` arrays are unquoted-id YAML. No same-wave
inter-feature deps (this is intra-feature story ordering). **I have no Bash** — flagging for the
team-lead/finalize step to run `python3 scripts/validate-depends-on.py thoughts/shared/epics/snapdeck-ux-improvements/`
and confirm exit 0 before plan-lock.

## 3. E2E strengthened to assertion-grade (feature.md)

- **Byte-frozen projection** test: now asserts `annotations deepEquals` a frozen fixture **+**
  `Object.keys(resolvePayload)` delta of exactly `"model"` **+** the `/report/save` `screenshots[0]` key
  set is exactly the 9 frozen fields with no `model`. Mirrors be-001's `saveReport` test.
- **Round-trip** test: now asserts `done2.model.items deepEquals done1.model.items` (re-emit after
  hydration) **+** post-hydration Undo is a no-op. Proves identity, not resemblance.

## 4. Conformance fixes (documented in each story's Revisions)

- **STORY-do-001** (ships): added required `domain: devops` (drives validator selection), renamed
  `epic`/`feature` → `parent_epic`/`parent_feature`, added `created_at`/`last_run_id`/`defects: []`,
  converted "How we validate" prose bullets → `- [ ]` checklist + added a JSON-valid/path-exists item.
- **STORY-db-001** (sentinel, pruned at lock): added `type: story`, `domain: database`, `parent_*`,
  `created_at`/`last_run_id`/`defects: []`, and a `- [ ]` "empty DB diff" check (db sentinels drifted on
  schema in the keyboard-shortcuts run — cheaper to fix here than bounce at finalize).

## 5. Tension-pair check — considered, no concern (no probe fired)

Per persona, I look for <3 substantive disagreements as a "converged too easily" signal. **Not the case
here** — the conversations log shows ≥5 real cross-domain engagements, all peer-resolved: (1) the BOSS
HYBRID test-lane ruling (pure module + `node --test` vs. E2E-only), (2) the FE↔BE wire shape + opacity,
(3) the box-subtype design decision (generic `box` vs. migrate `text`), (4) Konva.Transformer availability
in the vendored lib, (5) the three-way `background.js` shared-file / test-file-collision coordination.

The **backend↔frontend durability tension** (BE wants a contract that won't need a surprise v2; FE wants
the shape that minimizes today's bindings) was genuinely handled, not papered over: the `version: 1`
envelope field + **opaque item storage** is exactly the forward-compat hedge — w1/w2 add subtype fields
with zero backend change and an explicit version to gate any future migration. No probe needed; recording
"considered, no concern" so the retro sees the tension was consciously weighed.

## Disposition

All 8 stories `approved`. feature.md `## Stories` populated (dependency order) and the two E2E specs
strengthened. **feature.md `status` left at `planning`** — I did not advance it to `planned`, deferring
that stamp to the security/finalize phase (Phase 7+), which may still add STORY-sec-* and owns the final
lock. Tell me if you'd rather I stamp `planned` now.
