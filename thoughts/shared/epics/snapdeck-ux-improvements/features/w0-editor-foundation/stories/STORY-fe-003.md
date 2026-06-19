---
type: story
id: STORY-fe-003
name: "Wire finish() serialize via pure module (projection frozen)"
domain: frontend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: [STORY-fe-001, STORY-fe-005, STORY-do-001]
created_at: 2026-06-19T03:30:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
  - extension/background.js
  - extension/manifest.json
  - extension/content/overlay.css
reuse_patterns:
  - "extension/content/editor-model.js — projectAnnotations(model) / serializeModel(model) (STORY-fe-005): call these from finish(); do NOT re-implement the transforms inline"
  - "extension/content/editor.js:220-223 — the projection that is being REPLACED by a projectAnnotations() call (byte-frozen output preserved)"
  - "extension/content/editor.js:226-237 — the resolved object literal: where the additive `model` key is inserted"
defects: []
---

# Story: Wire finish() serialize via pure module (projection frozen)

## What we're doing

On ✓ Done, `finish()` now emits the **full internal `model` losslessly** as a new **additive** field on
the editor→background resolve payload — `model: serializeModel(model)` (→ `{ version: 1, items: [...] }`) —
**alongside** the existing lossy `annotations` projection, now produced by `projectAnnotations(model)`,
which stays **byte-for-byte unchanged**. Both transforms come from the pure module
`extension/content/editor-model.js` (**STORY-fe-005**) via the isolated-world global
`window.__snapdeckEditorModel` — `finish()` **calls** them; it does **not** inline the logic (BOSS HYBRID
ruling: the transforms must stay pure + headless-testable). This is **contract surface #2** (load-bearing,
4 dependents) and the **producer** side of the FE↔BE wire: `STORY-be-001` consumes `resp.model` verbatim
into `screenshots[].model`. One more correction rides along so a box-bearing screenshot keeps its annotated
PNG: gate `annotated` on `model.length` (provably byte-identical for the frozen cases).

## What it should look like

- **Resolve payload** (`editor.js:226-237`) gains one new key, sibling of `annotations`:
  ```js
  model: __snapdeckEditorModel.serializeModel(model),   // → { version: 1, items: <deep clone of model> }
  ```
  Always present on a non-cancelled resolve (empty model ⇒ `{ version: 1, items: [] }`). `items` is plain
  JSON (arrows `{id,type:"arrow",x1,y1,x2,y2}`, boxes `{id,type:"box",x,y,width,height}`, text
  `{id,type:"text",x,y,text}`), no Konva nodes.
- **Lossy projection** (`editor.js:220-223`) is **replaced by a call**:
  ```js
  var annotations = __snapdeckEditorModel.projectAnnotations(model);
  ```
  Output is byte-identical to today (arrow→`{from,to}` rounded, text→`{x,y,text}` rounded, **box
  excluded**). The byte-freeze is now guaranteed by `projectAnnotations` and asserted by its node test
  (STORY-fe-005) plus the E2E below.
- **Annotated-PNG gate** (`editor.js:227`): `annotations.length ? annotated : null` →
  `model.length ? annotated : null`. Byte-identical for the frozen cases (pre-feature every model item
  projects 1:1, so `model.length === annotations.length` for arrow/text-only and empty), and it keeps the
  annotated PNG for a box-bearing screenshot (box excluded from `annotations` but visibly rendered).
- **Global access:** `window.__snapdeckEditorModel` is live because STORY-do-001 lists
  `content/editor-model.js` before `content/editor.js` in the manifest. Reference it the same way
  `editor.js` already reads `window.Konva` (`:43`).

  Example resolve payload (one arrow + one box):
  ```json
  {
    "annotations": [ { "id": "a1", "type": "arrow", "from": [100,120], "to": [240,200] } ],
    "model": { "version": 1, "items": [
      { "id": "a1", "type": "arrow", "x1": 100, "y1": 120, "x2": 240, "y2": 200 },
      { "id": "b1", "type": "box",   "x": 300, "y": 80, "width": 160, "height": 90 }
    ] }
  }
  ```
  Box is in `model.items`, NOT in `annotations`.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:208-238` — `finish()`; the lossy projection at `:220-223` is
  **inline** (`.map` → arrow `{from,to}`, fallthrough text `{x,y,text}`, `Math.round`); the resolved
  object literal `:226-237` has **no `model` key** (internal model discarded); `annotated` is gated on
  `annotations.length` (`:227`).
- **Currently:** `editor.js:63` — internal model shape; `editor.js:43` — `window.Konva` is read the same
  global-deref way the new `window.__snapdeckEditorModel` will be.
- **Dispatch path / call graph:** `finish()` resolve → `background.js:123` ANNOTATE response →
  `background.js:127-141` builds the `screenshots[]` record (STORY-be-001 adds `model: resp.model ?? null`)
  → `background.js:159-163` `/report/save` whitelist (NOT touched).
- **No-regression assertion:** the `annotations` array bytes and the `/report/save` payload
  (`background.js:159-163`) MUST be **byte-for-byte identical** to pre-feature output for the same
  arrow/text set — same field names, same `Math.round`, same `meta.viewport`. The **only** new field on
  the resolve payload is `model`.
- **Explicitly changing:** route the projection through `projectAnnotations(model)`; add the additive
  `model: serializeModel(model)` field; widen the `annotated` gate to `model.length` (byte-identical for
  the frozen cases).
- **Verified:** 2026-06-19

## Cross-domain contract (FE→BE, ratified 2026-06-19)

- **Producer:** this story (`STORY-fe-003`) emits `resp.model = { version: 1, items: [...] }` on the
  non-cancelled resolve (always present from the w0 editor; empty ⇒ `items: []`).
- **Consumer:** `STORY-be-001` (backend-architect) stores it **verbatim/opaque** at `screenshots[].model`
  via the existing structured-clone `setReport()` path — **no field whitelist**, so w1/w2 box subtype
  fields survive with zero backend change. `model` is **NOT** added to `/report/save`
  (`background.js:159-163` stays frozen). BE default for an absent field: `model: resp.model ?? null`
  (forward-compat only; never fires against the w0 build).
- **Type guarantee:** plain JSON object — no class instances/functions/Konva nodes — survives IndexedDB
  structured-clone + the w0-per-target-reports re-key untouched.
- **Refactor note:** whether `finish()` builds `model` inline or via `serializeModel()` is invisible to BE
  (acked by backend-architect) — the wire is identical.

## How we're doing it

- Single file edit: `extension/content/editor.js`, inside `finish()` (`:208-238`).
- Replace the inline projection (`:220-223`) with `__snapdeckEditorModel.projectAnnotations(model)`; add
  `model: __snapdeckEditorModel.serializeModel(model)` to the resolved literal (`:226-237`); change the
  `annotated` gate to `model.length`.
- **Do NOT re-implement** serialize/projection logic in `editor.js` — call the pure module. The pure
  functions and their `node --test` suite are STORY-fe-005 (`files_not_modified` here); the manifest
  registration is STORY-do-001.
- **Verification:** delegate to `bt` to draw arrow-only / arrow+text / arrow+box, Done, and capture the
  resolve payload + stored record to diff the `annotations` bytes and confirm `model`. See
  `.claude/onboarding/frontend.md` §"Mandatory smoke-test protocol"; confirm the extension is loaded in a
  user-owned Chrome first.

## How we validate it was done correctly

- [ ] `finish()` calls `__snapdeckEditorModel.projectAnnotations(model)` and
      `__snapdeckEditorModel.serializeModel(model)` — **no** inline serialize/projection remains in
      `editor.js`.
- [ ] **Projection byte-frozen (arrow-only / arrow+text):** Done yields an `annotations` array
      byte-for-byte identical to pre-feature output (same fields, `Math.round`, order); the only added
      field on the resolve payload is `model`; **no box ever appears in `annotations`**.
- [ ] **Lossless model present:** arrow+box Done → `resp.model.version === 1` and `resp.model.items` has
      the arrow + box geometry verbatim; `items` is a deep clone (mutating the live editor after Done does
      not change the emitted payload).
- [ ] **Annotated gate:** a box-only screenshot still emits a non-null `annotated` PNG; an empty model
      emits `annotated: null` (unchanged from pre-feature).
- [ ] **`/report/save` unchanged:** the saved upstream payload carries **no** `model` field and is
      byte-identical to pre-feature for the same annotations (cross-checks STORY-be-001's frozen whitelist).

## Motion contract

`n/a` — serialization wiring only; no UI, no animation, `frontend_lane: N/A`.

## Unit tests

> **HYBRID lane — both runners.** The pure serialize/projection invariants are asserted by the zero-dep
> `node --test` suite at **`extension/editor.model.test.mjs`** (authored in STORY-fe-005; `unit-tester`
> runs `node --test extension/` in Phase 5a). The wiring through the real `finish()` + Konva stage is the
> browser-tester E2E lane (assertion-grade, kept). NO Konva/DOM in the `.test.mjs`.

**`node --test` (unit lane — the serialize/projection behavior this story wires):**
- `extension/editor.model.test.mjs` — `round-trip identity (serialize→deserialize)` —
  `deserializeModel(serializeModel(model))` deep-equals the original for box + arrow items.
- `extension/editor.model.test.mjs` — `projection byte-frozen vs fixture` — `projectAnnotations(model)`
  for a known model is byte-identical to a fixed expected fixture (same `Math.round`, field names/order;
  box filtered out).

**browser-tester E2E (integration lane — through the real editor `finish()`):**
- `extension/e2e/w0-editor-foundation.spec.ts` — `arrow-only Done emits byte-identical projection` —
  resolve `annotations` deep-equals pre-feature shape; `model` is the only added key.
- `extension/e2e/w0-editor-foundation.spec.ts` — `arrow+box Done carries model, excludes box from
  projection` — `annotations` has the arrow only; `resp.model.items` has both.
- `extension/e2e/w0-editor-foundation.spec.ts` — `annotated PNG retained for box-only` — box-only Done →
  `annotated` non-null; empty model → `annotated` null.

## Dependencies

- STORY-fe-001 — needs the `box` model item to serialize / exercise projection-exclusion.
- STORY-fe-005 — `finish()` calls its `serializeModel` / `projectAnnotations` (the pure module + node tests).
- STORY-do-001 — registers `editor-model.js` in the manifest so `window.__snapdeckEditorModel` is live at runtime.
- Producer of the FE→BE wire consumed by STORY-be-001 (it `depends_on` this story).

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified this is the **producer** side of the FE→BE wire
  (contract surface #2): `resp.model = serializeModel(model)` → `{version:1, items}` is additive and
  always present; `annotations` routed through `projectAnnotations(model)` stays byte-frozen with the box
  excluded; the `annotated` gate widening from `annotations.length` to `model.length` is provably
  byte-identical for the frozen cases (arrow/text project 1:1) and only changes the new box-bearing case.
  **Strengthened the matching feature.md E2E ("arrow-only Done emits a byte-identical lossy projection") to
  assertion-grade** — explicit `annotations deepEquals` a frozen fixture + `Object.keys(resolvePayload)`
  delta of exactly `"model"` + the 9-field `/report/save` key-set assertion — so the PO E2E and this
  story's `validates` enforce the same byte-freeze. No story-content change. **Promoted `pending →
  approved`.**

## History

- 2026-06-19 — created by frontend-architect (effort=2)
- 2026-06-19 — revised by frontend-architect for BOSS HYBRID ruling: consume pure module (STORY-fe-005) + add node:test unit lane; depends_on now [STORY-fe-001, STORY-fe-005, STORY-do-001]

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **INFO**

**INFO — Information disclosure (producer side): byte-freeze + upstream exclusion verified.** This is the
producer of the FE→BE wire and the point where the "what leaves the editor" envelope is set. Two
properties are correct and asserted: (1) the lossy `annotations` projection routes through
`projectAnnotations(model)` and stays **byte-frozen** (box excluded, `Math.round` and field order
preserved); (2) the additive `model` is the **only** new key on the resolve payload and does **not**
reach `/report/save`. The strengthened assertion-grade E2E (`Object.keys(resolvePayload)` delta of
exactly `"model"` + the 9-field `/report/save` key-set check) locks this so no annotation geometry/text
silently widens the upstream payload. Good — this is exactly the disclosure boundary to nail down.

**No new trust boundary.** `finish()` calls the pure module via the isolated-world global
`window.__snapdeckEditorModel` (same-world, not page-reachable); `serializeModel`'s deep-clone emits
plain JSON only (no Konva nodes/functions). The `annotated`-gate widening (`annotations.length` →
`model.length`) is a render/output decision with no security surface.

**Spoofing / Tampering / Repudiation / DoS / EoP: N/A** for this serialization-wiring story.
