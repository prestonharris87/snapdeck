---
type: story
id: STORY-fe-002
name: "Project rectangle in projectAnnotations + flip frozen tests"
domain: frontend
parent_feature: w2-rectangle-tool
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
files_modified:
  - extension/content/editor-model.js   # add the box branch to projectAnnotations
  - extension/editor.model.test.mjs     # flip the two frozen exclusion tests (TEST OWNERSHIP: this story)
files_not_modified:
  - extension/content/editor.js                # finish() already calls projectAnnotations (:485) — do NOT touch; restyle is STORY-fe-001
  - extension/background.js                     # /report/save payload assembler (:315-323) is opaque — no change
  - extension/manifest.json                     # editor-model.js already registered (content_scripts[1].js) — no new file
  - controller/snapdeck_controller/reports.py   # _render_markdown "box" branch — backend-architect (STORY-be), CONSUMER of this story
reuse_patterns:
  - extension/content/editor-model.js:48-53   # arrow projection branch — field/order/Math.round template to mirror
  - extension/content/editor-model.js:54-59   # text projection branch — template
  - extension/editor.model.test.mjs:65-71     # byte-frozen arrow test — deepEqual-vs-fixture pattern to mirror for the box test
  - extension/editor.model.test.mjs:28        # boxItem fixture — reuse as the box projection fixture
defects: []
created_at: 2026-06-20T16:48:00Z
last_run_id: run-20260619-021434-24507
---

# Story: Add the rectangle to the lossy projection + flip the frozen exclusion tests

## What we're doing

Fulfill w0's forward-flagged _"w2 handles eventual projection"_ by adding a **box branch to
`projectAnnotations`** (`extension/content/editor-model.js`) so the rectangle reaches the upstream
`/report/save` consumer, and **flip the two released frozen unit tests** that currently assert the
box is *excluded* from the projection to the new "rectangle IS projected" contract. The projected
entry is strictly **additive** — the byte-frozen arrow `{from,to}` and text `{x,y,text}` entries
stay byte-identical, and `serializeModel`/`deserializeModel` are untouched (the box already
round-trips losslessly via opaque pass-through). **This story explicitly owns
`extension/editor.model.test.mjs`** (the no-owner-test trap flagged for this epic — the story that
edits `projectAnnotations` updates its test file in the same diff).

## What it should look like

**Projected entry (RATIFIED with backend-architect — see `## Cross-domain contract`):**

```js
// box → projected (w2 rectangle); type literal "box" matches model/wire + controller discriminator
{ id: m.id, type: "box", x: Math.round(m.x), y: Math.round(m.y),
  width: Math.round(m.width), height: Math.round(m.height) }
```

Mirrors the arrow/text branches: field order `{id, type, x, y, width, height}`, `Math.round` on all
four numeric coordinates. The projected `type` literal is **`"box"`** — identical to the model/wire
type and to the literal the controller's `_render_markdown` cases on (one identifier end-to-end).

Projection output for a mixed model `[arrow, box, text]` (order preserved by the existing `forEach`):

```js
[ { id:"a1", type:"arrow", from:[100,121], to:[240,201] },   // byte-identical to today
  { id:"b1", type:"box",   x:300, y:80, width:160, height:90 }, // NEW
  { id:"t1", type:"text",  x:51,  y:60, text:"hello" } ]       // byte-identical to today
```

## Existing behavior baseline

- **Currently:** `extension/content/editor-model.js:45-63` — `projectAnnotations` emits an `arrow`
  branch (`:48-53` → `{id, type:"arrow", from:[round(x1),round(y1)], to:[round(x2),round(y2)]}`) and
  a `text` branch (`:54-59` → `{id, type:"text", x:round(x), y:round(y), text}`); the **box is
  explicitly excluded** — the comment at `:60` reads `// box: excluded from the lossy projection`,
  and the module header docs the exclusion at `:7` and `:43`.
- **Currently:** `extension/editor.model.test.mjs:88-96` — test
  `"projectAnnotations excludes box items (never projected)"` feeds `[arrowItem, boxItem, textItem]`
  and asserts `result.length === 2`, `result.every(r => r.type !== "box")`, and that result[0]/[1]
  equal the arrow/text fixtures. `:98-101` — test
  `"projectAnnotations returns empty array for box-only model"` asserts
  `projectAnnotations([boxItem])` deepEquals `[]`. The `boxItem` fixture (`:28`) is
  `{ id:"b1", type:"box", x:300.0, y:80.0, width:160.0, height:90.0 }`.
- **Dispatch path (producer → consumer):** `editor.js finish()` calls `em.projectAnnotations(model)`
  (`editor.js:485`) → `annotations` → resolve payload → `background.js:315-323` → `/report/save`
  → controller `reports.py` `save_report` (stores `annotations` opaquely → `report.json`) +
  `_render_markdown` (the **backend-architect's STORY-be** cases on the `"box"` literal this story
  emits — that story is a CONSUMER and declares `depends_on: [STORY-fe-002]`).
- **No-regression assertion:** the **arrow and text projection entries stay BYTE-IDENTICAL** — field
  names, order, and `Math.round` unchanged. The byte-frozen arrow/text tests
  (`editor.model.test.mjs:65-71`, `:73-78`, `:80-86`) MUST stay green. `serializeModel` /
  `deserializeModel` are **untouched** — the box already round-trips losslessly via opaque
  pass-through, so the round-trip tests (`:163-167`, `:175-179`) and the opaque-subtype test
  (`:185-190`) stay valid and green. The model/wire `type` literal stays `"box"`.
- **Explicitly changing:** (1) add the `else if (m.type === "box")` branch to `projectAnnotations`;
  (2) flip the two exclusion tests (`:88-96`, `:98-101`) to assert the box IS projected with the
  `{id, type:"box", x, y, width, height}` shape; (3) update the now-stale module header docs (`:7`,
  `:43`) and the test section comment (`:61-63`) that claim "box excluded".
- **Verified:** 2026-06-20 — opened `editor-model.js` and `editor.model.test.mjs` and confirmed all
  cited line numbers + the `boxItem` fixture values.

## How we're doing it

**`extension/content/editor-model.js`:**
1. Add a branch to `projectAnnotations` after the `text` branch (before the `// box: excluded …`
   comment at `:60`):
   ```js
   } else if (m.type === "box") {
     // PO arbitration (INFO#1): mirror renderBox's render-boundary guard so render and projection
     // treat malformed geometry symmetrically — a non-finite or ≤0 box is NOT projected (it is
     // already skipped at render by renderBox:324-325). Pure inline check — do NOT import
     // isFiniteNum from editor.js (this module is dependency-free).
     var fin = function (n) { return typeof n === "number" && isFinite(n); };
     if (!fin(m.x) || !fin(m.y) || !fin(m.width) || !fin(m.height)) return;
     if (m.width <= 0 || m.height <= 0) return;
     result.push({
       id: m.id, type: "box",
       x: Math.round(m.x), y: Math.round(m.y),
       width: Math.round(m.width), height: Math.round(m.height),
     });
   }
   ```
   Keep the arrow/text branches byte-identical — do not reorder fields or touch their `Math.round`.
   (The `forEach` callback's `return` skips just this item — same control flow `renderBox` uses.)
2. Update the now-stale docs: the header bullet at `:7` and the `projectAnnotations` doc-comment at
   `:43` (and remove/replace the `:60` `// box: excluded …` comment) so they describe
   `box → {id, type:"box", x, y, width, height}` (w2) instead of "excluded".

**`extension/editor.model.test.mjs` (this story owns this file):**
3. Flip `"projectAnnotations excludes box items (never projected)"` (`:88-96`) → rename to e.g.
   `"projectAnnotations projects box items (w2 rectangle)"`; for `[arrowItem, boxItem, textItem]`
   assert `result.length === 3`, `result[1]` deepEquals
   `{ id:"b1", type:"box", x:300, y:80, width:160, height:90 }` (the `boxItem` fixture is already
   integers, so `Math.round` is a no-op here), and `result[0]`/`result[2]` still equal the arrow/text
   fixtures. Remove the `result.every(r => r.type !== "box")` exclusion assertion.
4. Flip `"projectAnnotations returns empty array for box-only model"` (`:98-101`) → rename to e.g.
   `"projectAnnotations projects a box-only model"`; assert `projectAnnotations([boxItem])` deepEquals
   `[{ id:"b1", type:"box", x:300, y:80, width:160, height:90 }]`.
5. Update the section comment at `:61-63` ("byte-frozen output … box excluded") to reflect the new
   contract (arrow/text byte-frozen; box now projected).
6. **Add** a rounding-coverage test, e.g. `"projectAnnotations Math.rounds box geometry"`: project
   `{ id:"b3", type:"box", x:10.6, y:20.4, width:100.5, height:50.5 }` and assert it equals
   `{ id:"b3", type:"box", x:11, y:20, width:101, height:51 }` — proves the rounding convention
   matches arrow/text.
7. **Do NOT touch** the byte-frozen arrow/text tests (`:65-86`), the round-trip tests (`:157-179`),
   or the opaque-subtype / render-boundary-precondition tests (`:185-232`).

Then run `node --test extension/*.test.mjs` and confirm the full suite is **green** (today 121/121;
this story flips 2 existing tests + adds 1, so the count becomes ~122 — all passing).

This is a pure data-transform change — no browser needed to validate (the `node --test` lane is
authoritative for `projectAnnotations`). The FE→`/report/save` half is also covered by the
PO-authored browser-tester E2E "Projection reaches /report/save (arrow byte-identical)" spec.

## How we validate it was done correctly

- [ ] `projectAnnotations` emits a box entry `{ id, type:"box", x, y, width, height }` with
  `Math.round` on all four coordinates, field order `id, type, x, y, width, height`.
- [ ] The projected `type` literal is **`"box"`** (matches model/wire type + the controller's
  `_render_markdown` discriminator — see `## Cross-domain contract`).
- [ ] **Arrow** projection entry stays byte-identical
  (`{id, type:"arrow", from:[round,round], to:[round,round]}`) — `:65-71`, `:80-86` stay green.
- [ ] **Text** projection entry stays byte-identical (`{id, type:"text", x:round, y:round, text}`) —
  `:73-78` stays green.
- [ ] Both exclusion tests are flipped to assert the box IS projected with the
  `{id,type:"box",x,y,width,height}` shape; **no test still asserts box exclusion** from the
  projection.
- [ ] A rounding test proves fractional box geometry is `Math.round`ed (matches arrow/text).
- [ ] **(PO arbitration — INFO#1 promote) Projection geometry guard mirrors `renderBox`:** the box
  branch skips a non-finite or `≤0`-geometry box (does NOT project it), keeping render and projection
  symmetric. A unit test pins this (non-finite/`≤0` box is absent from the projection). The
  lossless-round-trip contract is UNAFFECTED — `serializeModel`/`deserializeModel` are untouched, so a
  malformed box still survives in `model.items` (only the lossy projection skips it).
- [ ] `serializeModel` / `deserializeModel` are unchanged; the box round-trip tests (`:163-167`,
  `:175-179`) and opaque-subtype test (`:185-190`) stay green.
- [ ] Module header docs (`:7`, `:43`) and the test section comment carry no stale "box excluded"
  claim.
- [ ] `node --test extension/*.test.mjs` is **GREEN** (full suite, ~122/122).

## Motion contract

n/a — pure data-transform module (no chrome / DOM / Konva / UI). No motion surface.

## Unit tests

- `extension/editor.model.test.mjs` — `projectAnnotations projects box items (w2 rectangle)` —
  `[arrow,box,text]` → `result.length === 3`, `result[1]` deepEquals
  `{id:"b1",type:"box",x:300,y:80,width:160,height:90}`, arrow/text entries unchanged.
- `extension/editor.model.test.mjs` — `projectAnnotations projects a box-only model` —
  `[boxItem]` → `[{id:"b1",type:"box",x:300,y:80,width:160,height:90}]`.
- `extension/editor.model.test.mjs` — `projectAnnotations Math.rounds box geometry` —
  `{x:10.6,y:20.4,width:100.5,height:50.5}` → `{x:11,y:20,width:101,height:51}`.
- `extension/editor.model.test.mjs` — (PO arbitration — INFO#1 promote)
  `projectAnnotations skips a non-finite/≤0 box (render↔projection symmetry)` — project
  `[{id:"bad",type:"box",x:NaN,width:"120",height:Infinity}, boxItem]` and assert the malformed box is
  ABSENT and only the well-formed `boxItem` entry is emitted. Use a pure inline finite check
  (`typeof n === "number" && isFinite(n)`) — `editor-model.js` is a pure module and MUST NOT import
  `isFiniteNum` from `editor.js`; mirror the predicate, not the dependency.
- `extension/editor.model.test.mjs` — (RETAINED, must stay green)
  `projectAnnotations byte-frozen vs fixture — arrow item` / `— text item` /
  `— arrow + text (mixed model)` — proves arrow/text byte-identity is preserved.
- `extension/editor.model.test.mjs` — (RETAINED, must stay green) the `serializeModel` /
  `deserializeModel` round-trip + opaque-subtype tests — proves the box still round-trips losslessly
  (this story does not touch those functions).

## Cross-domain contract

**Projected rectangle annotation `type` literal — RATIFIED 2026-06-20 (frontend-architect ⇄
backend-architect).**

- The lossy projection emits `{ id, type:"box", x:round, y:round, width:round, height:round }` for
  the rectangle. The `type` literal is **`"box"`**.
- The controller's `_render_markdown` rectangle branch (`controller/snapdeck_controller/reports.py`,
  backend-architect's STORY-be-001) **cases on the same `"box"` literal** (`elif a.get("type") == "box":`)
  and renders a clean human line `- 🟥 (x,y) width×height` (emoji + rounded geometry, matching the
  sibling 📝/➡️ text/arrow style — no raw-dict catch-all dump). That story is a CONSUMER of this
  contract and declares `depends_on: [STORY-fe-002]`. **Bidirectionally ratified 2026-06-20**
  (backend-architect AGREED off an initial "rect" lean); the coupling is documented on both sides —
  if fe-002 ever changes the projected literal, the controller branch moves in lockstep.
- Rationale for `"box"` over `"rect"`: the projected `type` is a machine discriminator (not
  user-facing text — the human label is decoupled in `_render_markdown`). The model/wire type is
  immovably `"box"` (back-compat, locked), so emitting `"box"` keeps one identifier for the rectangle
  concept end-to-end (model → render dispatch → projection → controller) and avoids a rename seam.
- The model/wire item `type` stays `"box"` independently of this decision (ARCHITECT NOTE #1).

## Dependencies

none — this story is the **producer** of the projected `type` contract; it consumes no unreleased
upstream work (the `/report/save` consumer is released and stores `annotations` opaquely). The
backend-architect's controller story declares `depends_on: [STORY-fe-002]` against it.

## History

- 2026-06-20 — created by frontend-architect (effort=2, depends on none; projected `type:"box"`
  ratified with backend-architect)

## Contrarian Findings

### Finding 1 — The `type:"box"` projection↔controller literal is coupled in prose but guarded by no test on either side

**Severity:** concern
**Mechanism:** The cross-domain contract (this story emits `type:"box"`; STORY-be-001's
`_render_markdown` cases on `a.get("type") == "box"`) was deliberately negotiated and is documented
on both sides ("if fe-002 ever changes the projected literal, my branch must move in lockstep" —
conversations 0019/0023). But the two sides are verified by **independent** unit suites that each
hard-code their own copy of the literal: this story's `extension/editor.model.test.mjs` asserts the
emitter produces `{type:"box",...}`, and be-001's `controller/tests/test_reports.py` feeds a
hand-built `{type:"box"}` dict into `_render_markdown`. No test takes the **actual** emitter output
and runs it through the **actual** renderer. So a future single-sided edit — e.g. someone renames
the projected literal to `"rect"` in `projectAnnotations` and updates only this file's fixtures —
leaves **both** suites green while the rectangle silently falls through the controller's raw-dict
catch-all `else` (`reports.py:227-228`) and renders as `- {'id':...,'type':'rect',...}` in
`report.md`. The "documented coupling" the room is relying on as its mitigation is exactly the kind
of invariant that has no enforcing assertion. (Verified 2026-06-20: `_render_markdown` at
`reports.py:220-228` is the *only* annotation-`type`-discriminating consumer in the repo — the MCP
server and `core.py`/`server.py` treat `annotations` opaquely — so the catch-all fallthrough is the
single point of silent decay.)
**Recommendation:** acknowledge as a known contract-decay risk on **both** stories, and prefer a
cheap enforcing guard over prose: either (a) a single shared contract fixture (e.g. a small JSON
file holding the canonical projected box shape) that **both** the node test and the pytest load and
assert against, so a one-sided literal change reddens that side's test; or (b) make the PO E2E
"Rectangle appears in the controller report.md human summary" a true end-to-end check (real
`projectAnnotations` output → real `_render_markdown`) instead of two independent half-tests. If
neither is adopted, record an explicit `## Acknowledged Risk` that the literal coupling is
test-unenforced and any change to the projected `type` is a coordinated two-file edit.

### Finding 2 — `projectAnnotations` has no finite/positive geometry guard, unlike `renderBox` — a non-finite box projects as null/coerced coordinates

**Severity:** info
**Mechanism:** `renderBox` (`editor.js:324-325`) skips a box whose geometry is non-finite or `≤0`
(the inherited w0 fe-004 render-boundary guard — and this feature's own AC + render-guard E2E
exercise exactly such a hostile hydrated item). The box branch this story adds to
`projectAnnotations` has **no** matching guard: it runs `Math.round(m.x/y/width/height)`
unconditionally. A malformed box that survives into `model` via a hydrated/hostile model (the same
scenario the render-guard AC contemplates) is therefore **skipped at render** but **still projected**
on ✓ Done — emerging as JSON-safe garbage (`Math.round(NaN)→NaN→null` via the serialize clone,
`Math.round("120")→120`), e.g. `{id, type:"box", x:null, y:0, width:120, height:0}`, which reaches
`/report/save` and renders `- 🟥 (null,0) 120×0` in `report.md`. Before this story the box was
excluded from the projection, so this asymmetric path did not exist. Reachability is low (a
normally-drawn box is always finite and `>4px`; only a corrupt/hostile stored model produces this)
and the impact is cosmetic — no throw, and the round-trip `model` is unaffected — so this is an info,
not a concern. The asymmetry simply isn't covered: the added rounding test uses well-formed
fractional geometry only.
**Recommendation:** acknowledge; optionally mirror `renderBox`'s finite/`>0` guard in the box
projection branch (skip non-finite/`≤0` boxes from the projection too, keeping render and projection
symmetric), or add a one-line test asserting the projection's behavior on a non-finite box so the
chosen behavior is pinned rather than incidental.

## Acknowledged Risk

**The projected `type:"box"` literal coupling (this emitter ⇄ STORY-be-001's `_render_markdown`) is
test-unenforced across the JS↔Python seam.** Each side's suite hard-codes its own copy of `"box"`; no
test runs the real emitter output through the real renderer, so a hypothetical one-sided rename of the
projected literal would leave both suites green while the rectangle silently falls through the
controller's raw-dict catch-all in `report.md`.

- **Why accepted (not auto-enforced via a shared fixture):** the projected literal is anchored to the
  model/wire `type:"box"`, which is **back-compat-locked and immovable** (Critical directive #1) — the
  architects deliberately chose `"box"` end-to-end precisely so there is *one* identifier with no
  rename seam. The realistic rename probability is therefore doubly-low, the failure mode is
  **cosmetic** (`report.json` + the report→defects pipeline are unaffected; only the human `report.md`
  line degrades), and the consumer side already carries a no-raw-dict-fallthrough guard test (be-001).
- **Enforcement applied (cheap, in-scope):** a one-line coupling comment in this `projectAnnotations`
  box branch naming `reports.py` `_render_markdown` + "change the projected `type` literal in lockstep
  with the controller branch." (Mirror comment required on the be-001 side.)
- **(b) escalation trigger (recorded, not adopted now):** the contrarian's shared-cross-language
  fixture (one JSON shape loaded by both the node test and the pytest — the only option that makes a
  one-sided rename red) becomes worth its cost **if/when a second box-shaped primitive is added**
  (the stress-test's latent name-collision note) — at that point the projected literal may need to
  diverge from the model/wire literal and the anchor that makes this risk low disappears. Until then,
  the comment + decision-memo record is the proportionate disposition.

## Security Review

**Reviewer:** security-architect · **Date:** 2026-06-20 · **Verdict:** INFO / LOW (clean — no change
required; I endorse the already-planned guard)

This is the one story in the feature with a real information-flow delta (rectangle geometry now reaches
the upstream `/report/save` projection). STRIDE pass, all findings INFO/LOW:

- **Information disclosure (projection → upstream) — INTENDED, no new disclosure class.** The box branch
  emits `{id, type:"box", x, y, width, height}` — `Math.round`ed numeric geometry plus a uid. This is
  strictly *narrower* than data already projected: the released `arrow` branch projects `from`/`to`
  coordinate pairs and the `text` branch projects a full **user-authored string** (`text`). The rectangle
  carries no PII, token, credential, internal URL, or free text. The flow is the user's own annotation on
  their own screenshot → their own localhost controller. Not multi-tenant, no cross-origin. Affirm as
  INFO security-positive — the projection addition is intended (rectangles ARE report annotations) and
  adds no disclosure beyond the existing arrow/text geometry. (Grounded: `editor-model.js:45-63` +
  `background.js:315-323` `/report/save` assembler, read 2026-06-20.)
- **DoS — closed by the planned guard; I endorse it.** The finite/`≤0` projection guard this story adds
  (the contrarian INFO#1 the PO promoted) mirrors `renderBox:324-325` and is the correct
  defense-in-depth: it stops a malformed hydrated box from emitting coerced garbage (`Math.round(NaN)→
  null`, `0`-dim) into `/report/save`, keeping render and projection **symmetric**. No text on a
  rectangle → no auto-fit measurement loop (the w1 slow-wrap DoS axis is N/A here). Projection is
  O(items), bounded by user draw gestures. Confirmed this story does **not** fork the shared `render()`
  path, so the inherited RENDER_ITEM_CAP / render-boundary caps stay in force (feature directive #7).
- **Tampering — LOW defense-in-depth, already covered.** The editor `model` is built in the
  isolated-world `content_scripts[1]` entry (no `"world"` key — only `capture.js` is MAIN-world/
  page-reachable; grounded against `manifest.json`), and there is **no `externally_connectable`**, so a
  hostile web page cannot write the model or reach the extension's message API. The "malformed/hostile
  box" scenario is therefore reachable only via the extension's own stored model or a future bug — which
  is exactly the residual the promoted finite/`≤0` guard now neutralises on the projection side. No
  further action.
- **Note on the test-unenforced `"box"` literal coupling (this story's `## Acknowledged Risk`):** this is
  a contract-decay/maintainability risk, **not** a security finding — the failure mode is a cosmetic
  `report.md` line, `report.json` stays opaque and correct. I concur with the PO disposition (two-sided
  coupling comment now; shared fixture deferred to the second-box-primitive re-trigger). No security
  escalation.

Disposition: affirm. No `STORY-sec` minted — the only defensive change worth making (the projection
geometry guard) is already in-scope on this story. Default checklist mostly N/A (no endpoint, no entity
table, not multi-tenant); recorded so the PO sees it was applied.

**PO disposition:** ACCEPT_AS_RECOMMENDATION — the projection info-flow is intended and security-positive (numeric `{x,y,width,height}` + uid is strictly narrower than the already-projected arrow coords / full user `text` string; localhost-only, single-user, not multi-tenant), and the finite/≤0 projection guard security endorses was ALREADY PROMOTE_TO_AC during arbitration (contrarian INFO#1) — no further change. The test-unenforced `"box"` literal coupling security flags is a maintainability/contract-decay risk, not security (cosmetic `report.md` failure mode; `report.json` opaque+correct), already dispositioned in this story's `## Acknowledged Risk`. No STORY-sec.

## Revisions

- **2026-06-20 — product-owner (arbitrate).** Promoted `status: pending → approved`. Cross-domain
  contract reviewed: the projected `type:"box"` literal is consistent with STORY-be-001 (emitter here,
  consumer there; be-001 `depends_on: [STORY-fe-002]`) and reflects the arbitrated resolution of the
  BE architect's initial `"rect"` lean → `"box"` (anchored to the immovable model/wire literal; avoids
  a third identifier). **Affirmed, no change to the contract.**
- **Contrarian CONCERN (literal coupling, producer side) → ACKNOWLEDGED RISK + cheap enforcing pin.**
  See the `## Acknowledged Risk` section above. Disposition: (a) accept with a two-sided coupling code
  comment + decision-memo record; (b) shared fixture deferred with an explicit re-trigger (second
  box-shaped primitive). Rejected (c) end-to-end test as disproportionate for a one-line/one-line
  branch pair.
- **Contrarian INFO#1 (no projection geometry guard) → PROMOTED (story-level).** Added the
  finite/`>0` guard to the box branch (mirrors `renderBox:324-325`), a pinning unit test
  (`projectAnnotations skips a non-finite/≤0 box`), and a `## How we validate` item. Rationale: free +
  in-scope (the branch is being written here), and it closes an asymmetry with the feature's OWN
  render-guard AC/E2E — without the guard, a malformed hydrated box is skipped at render but leaks
  coerced garbage (`x:null`, `0`-dims) into the upstream `/report/save` report, which is exactly the
  pipeline this feature exists to feed. The lossless-round-trip AC is unaffected (model items
  untouched; only the lossy projection skips). The feature.md render-guard AC (#11) was extended with
  a one-clause projection-symmetry note to keep the robustness contract complete (PO-owned artifact).
