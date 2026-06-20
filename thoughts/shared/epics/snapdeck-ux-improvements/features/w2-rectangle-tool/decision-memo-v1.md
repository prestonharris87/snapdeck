---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
version: 1
written_at: 2026-06-20T16:22:00Z
run_id: run-20260620-161821-90174
sources:
  - feature.md
  - stories/STORY-fe-001.md
  - stories/STORY-fe-002.md
  - stories/STORY-be-001.md
  - stories/STORY-db-001.md
  - stories/STORY-do-001.md
  - stress-test.md
  - conversations/0008-backend-architect-to-frontend-architect-msg.md
  - conversations/0019-frontend-architect-to-backend-architect-msg.md
  - conversations/0023-backend-architect-to-frontend-architect-msg.md
  - conversations/0037-product-owner-arbitration-decisions.md
---

# Decision memo — Rectangle (red-outline box) tool

## Summary

The w2-rectangle-tool feature promotes the released w0 generic `type:"box"` editor primitive into
a user-facing red-outline Rectangle annotation (restyle + relabel + projection + controller
`report.md` render — four surfaces across three files). The architecture is deliberately minimal:
geometry, draw, select, transformer, and model round-trip all reuse released w0 code unchanged.
The non-obvious planning story is concentrated in a **single cross-language contract decision**:
what projected `type` string should `projectAnnotations` emit for the rectangle? The backend-architect
initially leaned `"rect"` (conv 0008); the frontend-architect locked `"box"` on durability grounds
(conv 0019); the backend-architect agreed (conv 0023). The contrarian stress-test then found that
this well-negotiated coupling is **test-unenforced across the JS↔Python seam** — each side's suite
hard-codes its own copy of the literal, no test runs the real emitter through the real renderer —
and surfaced a projection-guard asymmetry (renderBox guards non-finite/≤0 geometry; the new
projection branch did not). PO arbitration promoted the guard fix into STORY-fe-002 and accepted
the seam-coupling risk with a cheap enforcing pin (coupling comments on both sides) and a deferred
shared-fixture option keyed to a future second box-shaped primitive (conv 0037).

---

## Positions held during planning

### frontend-architect

- **Locked projected `type:"box"` over `"rect"`** (conv 0019): the projected type is a machine
  discriminator, not user-facing text — the human render ("Rectangle"/🟥) is decoupled from the
  wire literal. Emitting `"box"` keeps ONE identifier for the rectangle concept end-to-end (model
  → render dispatch → projection → controller) and preserves the invariant that the projection
  never renames a type, only reshapes fields. Emitting `"rect"` would mint a third identifier and
  a second decode seam.
- **Split scope cleanly**: STORY-fe-001 (restyle/relabel — mechanical, no model touch) and
  STORY-fe-002 (projection + frozen-test flip — owns `editor.model.test.mjs` explicitly to close
  the no-owner-test trap). (STORY-fe-001 § What we're doing; STORY-fe-002 § What we're doing)
- **Persona alignment**: consistent with a minimal-identifiers durability stance throughout;
  position did not shift after conv 0019.

### backend-architect

- **Initially leaned projected `type:"rect"`** (conv 0008): argued arrow/text already project
  semantic type strings matching tool names (`"arrow"`, `"text"`); `"rect"` is the user-facing
  semantic, distinct from the persisted wire `"box"`.
- **Conceded to `"box"`** after frontend-architect's rationale (conv 0023): acknowledged that
  "box" keeps the system at TWO identifiers (wire `"box"` / display "Rectangle"+"🟥"), not THREE,
  and that the projection-never-renames invariant is worth preserving.
- **Determined BE surface is purely `_render_markdown`**: flat-file human summary only;
  `report.json` already stores annotations opaquely; no controller DB change. Confirmed with
  database-architect and devops-architect (STORY-be-001 § Dependencies).
- **Persona alignment**: moved from initial "rect" lean to "box" via bidirectional rationale
  exchange; the final position is documented in STORY-be-001 § Cross-domain contract.

### database-architect

- **Sentineled DB domain** with peer confirmations (STORY-db-001): Snapdeck has no server-side
  relational DB; the only store is client-side IndexedDB (`snapdeck`/`kv`), FE/extension-owned.
  The rectangle rides the released opaque `model` value field — no object-store definition, no
  `indexedDB.open("snapdeck", N)` version bump, no new index, no record-key/shape change.
- **Differentiated value-vs-schema**: projecting a new type into the existing opaque `annotations`
  field is a value-level change, not a schema change — matches the w0/w1 sentinel precedents.
  (STORY-db-001 § Rationale)
- **Persona alignment**: consistent with all prior w0/w1/w2 DB sentinels on this epic; position
  unambiguous and unchanged.

### devops-architect

- **Sentineled DevOps domain** with peer confirmations (STORY-do-001): both content scripts
  already registered in `content_scripts[1].js` (no manifest change); pytest already declared as
  a `[dev]` dependency in `pyproject.toml`; no project CI surface exists to wire a test stage into.
- **Surfaced the venv-qualified precondition**: controller pytest must be invoked as
  `.venv/bin/python -m pytest` (a bare system `pytest` lacks both pytest and the editable
  `snapdeck_controller` package). Confirmed with backend-architect and carried forward to the
  unit-tester Phase 5a note. (STORY-do-001 § Verification performed #2)
- **Persona alignment**: grounded findings against actual files (`CONTRIBUTING.md:26`/`:49`,
  `manifest.json:41`); no DevOps work manufactured.

### security-architect

- Security-architect Phase 7 was referenced in feature.md (Architect note #8) as a forward-flag
  to confirm the projection addition is intended and the render-guard covers the restyled rectangle.
  No STORY-sec-NNN was authored; no security story appears in the approved story set. The feature.md
  note characterizes the risk as **low** (rectangle geometry only, no text → no auto-fit/DoS path;
  render-guard inherited from w0 fe-004 and preserved by the restyle). (feature.md § Architect note #8)

### contrarian-architect

- **Concern — `type:"box"` literal coupling test-unenforced across JS↔Python seam**: each side's
  suite hard-codes its own copy of the literal; no test runs the real emitter output through the
  real renderer. A single-sided rename leaves both suites green while the rectangle silently falls
  through the raw-dict `else` in `_render_markdown`. (stress-test.md; STORY-fe-002 § Contrarian
  Findings Finding 1; STORY-be-001 § Contrarian Findings Finding 1)
- **Info — projection-guard asymmetry**: `renderBox` skips non-finite/≤0 geometry; the new
  `projectAnnotations` box branch did not — a malformed hydrated box would be skipped at render
  but still projected as coerced garbage (`x:null`, `0`-dim). (stress-test.md Finding 2;
  STORY-fe-002 § Contrarian Findings Finding 2)
- **Info — client/controller version skew**: a newer extension emitting `type:"box"` to an older
  controller (no box branch) renders the raw-dict dump in `report.md`; graceful degradation, not
  a crash. (stress-test.md Finding 3; STORY-be-001 § Contrarian Findings Finding 2)
- **Verified clean**: no other test asserts box-exclusion from the projection; no test asserts the
  blue `#1e88e5` stroke; box projection is purely additive to the `if/else if` chain; no JS or
  Python consumer beyond `_render_markdown` discriminates on annotation `type`. (stress-test.md
  § Verified-clean)
- **Persona alignment**: 0 blocks, calibrated to the well-negotiated feature; findings focused on
  contract decay under change rather than present flaws.

### product-owner

- **Affirmed the `"box"` contract**: the BE→FE `"rect"` lean and its resolution (convs 0008/0019/0023)
  constituted a genuine resolved disagreement; no manufactured tension-probe needed. (conv 0037
  § Cross-domain contract)
- **Promoted contrarian INFO#1 (projection guard asymmetry) to story-level fix** in STORY-fe-002:
  added finite/`>0` guard mirroring `renderBox:324-325`, a pinning unit test, and extended
  feature.md render-guard AC #11 with a projection-symmetry clause. Rationale: free + in-scope
  (branch being written there), consistent with w0 fe-004 / w1 fe-002 "promote the free in-scope
  guard" precedents. (conv 0037 § Contrarian dispositions INFO#1; STORY-fe-002 § Revisions)
- **Disposed of CONCERN (literal coupling) as acknowledged risk**: accepted with coupling comments
  on both sides + `## Acknowledged Risk` blocks on both stories. Deferred shared-fixture with an
  explicit re-trigger (second box-shaped primitive). Rejected end-to-end option as
  disproportionate for a one-line/one-line branch pair. (conv 0037 § Contrarian dispositions
  CONCERN; STORY-fe-002 § Acknowledged Risk; STORY-be-001 § Acknowledged Risk)
- **Fixed sentinel frontmatter conformance**: added load-bearing `domain:` keys, normalized
  `parent_feature`/`parent_epic` keys, added ≥1 validate checkbox per sentinel — cheaper to fix
  at arbitrate than to bounce at finalize. (conv 0037 § Conformance fixes)

---

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Projected `type` string: `"rect"` vs `"box"` | BE leaned `"rect"` (semantic, matches tool name; conv 0008) | FE locked `"box"` (one identifier end-to-end, projection-never-renames invariant; conv 0019) | `"box"` — fewest identifiers, avoids a rename seam inside `projectAnnotations`; BE agreed (conv 0023) | conv 0019 (FE), conv 0023 (BE agreement), conv 0037 (PO affirmation) |
| Projection-guard asymmetry: renderBox guards non-finite/≤0 geometry; projectAnnotations box branch did not | Contrarian: free + in-scope guard should be added to close the asymmetry with the feature's own render-guard AC (stress-test.md) | (No opposing position — PO decided uncontested) | Added finite/`>0` guard in the box branch + pinning unit test; feature.md AC #11 extended with projection-symmetry clause | STORY-fe-002 § Revisions; conv 0037 § INFO#1 |
| Test-file ownership for `editor.model.test.mjs` | Unowned (the no-owner-test trap flagged for this epic) | — | Explicitly assigned to STORY-fe-002 (the story that edits `projectAnnotations`) so the projection change and its test update are in the same diff | STORY-fe-002 § What we're doing |
| DB sentinel decision: value-level vs schema-level change | DB architect: projection of a new annotation type into the opaque `annotations` field is a VALUE-level change | (No opposing position) | Sentinel confirmed: rides released opaque `model` + flat `report.json`; no store/index/version change | STORY-db-001 § Rationale; STORY-be-001 § Dependencies |
| DevOps: new pytest file requires test-runner wiring? | DO architect: pytest already declared in `pyproject.toml [dev]`, auto-discovery needs no config, no project CI surface exists | (No opposing position) | Sentinel confirmed: no devops change required | STORY-do-001 § Verification performed #2 |

---

## Tensions accepted as known risk

- **`type:"box"` literal coupling test-unenforced across JS↔Python seam**: the FE projection emitter
  and the Python controller renderer each hard-code their own copy of `"box"`, and no test runs the
  real emitter output through the real renderer. A future single-sided rename would leave both suites
  green while the rectangle silently falls through the `_render_markdown` raw-dict catch-all `else`.
  · **Why accepted**: the projected literal is anchored to the back-compat-locked model/wire
  `type:"box"` (rename probability doubly-low); failure mode is cosmetic (`report.json` + the
  report→defects pipeline are opaque and unaffected; only the human `report.md` line degrades).
  · **Enforcement applied**: coupling comments on both sides (`projectAnnotations` box branch and
  `_render_markdown` box branch) explicitly naming the cross-seam dependency.
  · **Deferred escalation trigger**: a shared cross-language JSON fixture (the only auto-enforcing
  option) becomes worth its cost if/when a second box-shaped primitive is added and the projected
  literal must diverge from the wire literal.
  · Risk owner: frontend-architect + backend-architect (both stories carry `## Acknowledged Risk`
  blocks). (STORY-fe-002 § Acknowledged Risk; STORY-be-001 § Acknowledged Risk; conv 0037)

- **Client/controller version skew degrades `report.md`**: a user who updates the extension (which
  starts emitting `type:"box"` in STORY-fe-002) but runs a controller predating STORY-be-001 will see
  the raw-dict dump for rectangles in `report.md`. `report.json` is unaffected; the regression is
  invisible until eyeballed. No code change required; self-heals when the controller is updated.
  · Standing guardrail: if the project ever adds a controller/extension compatibility note or
  CHANGELOG, record that `report.md` rectangle rendering requires a controller at/past STORY-be-001.
  · Risk owner: backend-architect (STORY-be-001 § Contrarian Findings Finding 2; conv 0037 § INFO#2)

---

## Alternatives rejected

- **Projected `type:"rect"` instead of `"box"`**: rejected by frontend-architect (conv 0019) because
  it would mint a third identifier for the rectangle concept (wire `"box"`, projected `"rect"`, display
  "Rectangle") and introduce a model→projection rename seam inside `projectAnnotations` — precisely
  the drift-hiding kind of invisible mapping the feature avoids elsewhere. BE conceded (conv 0023).

- **Shared cross-language JSON fixture to auto-enforce the `type` coupling**: the only option that
  makes a single-sided literal rename immediately fail a test. Rejected as disproportionate for a
  one-line/one-line branch pair with an immovably-anchored literal. Deferred (not permanently
  rejected) with an explicit re-trigger. (conv 0037 § Contrarian dispositions CONCERN option b)

- **End-to-end test routing real `projectAnnotations` output through real `_render_markdown`**:
  would enforce the cross-language coupling without a shared fixture. Rejected as disproportionate
  cost for the current branch pair; the coupling comment + acknowledged-risk record is proportionate.
  (conv 0037 § Contrarian dispositions CONCERN option c)

- **Renaming model/wire `type` to `"rect"` (breaking back-compat)**: explicitly ruled out in
  feature.md (Architect note #1): already-persisted screenshots carry `{type:"box"}` items in their
  stored `model`; `render()` dispatches on `item.type === "box"` (`editor.js:182`); renaming would
  break round-trip render of existing records. The feature.md language is "keep the model/wire type
  `'box'`; `'Rectangle'` is the user-facing name only." (feature.md § UX patterns; STORY-fe-001
  § Existing behavior baseline)

---

## Next actions

Mirror of feature.md acceptance criteria (authoritative source; reproduced verbatim below):

- [ ] A **"Rectangle"** tool button exists in the editor toolbar alongside Arrow, Text, and Select; label and `title` read "Rectangle" (plain text — no emoji / symbol-glyph / inline `<svg>`), and the tool-active highlight tracks it like the other tools.
- [ ] With the Rectangle tool active, dragging a marquee draws a rectangle with a **red `#e53935`** outline (`strokeWidth` ~2) and a near-transparent interior fill (`rgba(0,0,0,0.001)`); the **live draw-preview also strokes red `#e53935`** (not the old blue `#1e88e5`), so draw-time and committed colour agree.
- [ ] Sub-threshold drags (≤4px in either dimension) create **no** rectangle.
- [ ] The committed rectangle is stored in the editor `model` as a `{id, type:"box", x, y, width, height}` item with **top-left-normalized** geometry. The model / wire `type` literal stays **`"box"`**.
- [ ] In **Select** mode, clicking a rectangle (interior or edge) selects it; the **shared `Konva.Transformer`** handles appear (`rotateEnabled:false`); dragging a corner resizes and dragging the body moves, and the `model` geometry updates accordingly.
- [ ] **Undo/redo** restores prior rectangle geometry.
- [ ] The rectangle **round-trips losslessly** through `serializeModel` → persist → `deserializeModel` → `render()`.
- [ ] On ✓ Done, the rectangle **appears in the lossy `annotations` projection** sent upstream to `/report/save`, carrying `{id, type:"box", x, y, width, height}` with `Math.round`ed coordinates. **Arrow and text projection entries remain byte-identical** to pre-feature output.
- [ ] **A saved report's `report.md` shows the rectangle in its human summary** as a clean human-readable line (emoji + rounded `{x,y,width,height}`, matching the arrow/text style) — **not** the raw-dict catch-all dump.
- [ ] The released `extension/editor.model.test.mjs` projection-exclusion tests are **updated to the new "rectangle is projected" contract**, and the full `node --test extension/*.test.mjs` suite stays green.
- [ ] Existing **arrow**, **text-box**, **select/move/resize**, **undo/redo**, and **visibility-toggle** behaviors are unaffected.
- [ ] **Render-guard robustness preserved (render AND projection symmetric):** a hydrated `version:1` model containing a hostile/malformed rectangle item renders **without throwing or emitting a console error** — the bad item is skipped and well-formed rectangles still render. The **lossy projection treats malformed geometry the same way**: a non-finite or ≤0-geometry box is **not** emitted into the `/report/save` `annotations`. The lossless model round-trip is unaffected. _(PO arbitration — contrarian INFO#1; wired in STORY-fe-002.)_

---

## Open questions deferred to implementation

None. All open decisions (projected `type` literal, test-file ownership, sentinel scope) were
resolved during Phase 5–6 planning. The venv-qualified pytest invocation precondition
(`.venv/bin/python -m pytest controller/tests/test_reports.py`) is documented in STORY-be-001
§ How we validate and STORY-do-001 § Verification performed #2 — surfaced to the unit-tester at
Phase 5a as a known invocation requirement, not a user-input question.
