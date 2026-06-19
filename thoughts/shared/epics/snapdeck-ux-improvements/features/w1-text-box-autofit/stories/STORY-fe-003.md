---
type: story
id: STORY-fe-003
name: "Text-box select/move/resize via shared transformer + re-fit"
domain: frontend
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: released
depends_on: [STORY-fe-001, STORY-fe-002]
created_at: 2026-06-19T15:30:00Z
last_run_id: run-20260619-150554-36418
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
greenfield: false
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
  - extension/background.js
  - extension/manifest.json
  - extension/content/overlay.css
  - extension/content/capture.js
  - extension/lib/konva.min.js
reuse_patterns:
  - "extension/content/editor.js:57-70 — attachBoxTransformer(node,item): the FROZEN shared transformer helper (bakes scaleX/scaleY→width/height on transformend, then snapshot();render()). Attach the text Group to it — do NOT roll a parallel transformer."
  - "extension/content/editor.js:185-188 — renderBox's selected block (`if (selectedId===item.id && tool==='select'){ attachBoxTransformer(rect,item); selectLayer.batchDraw(); }`): the exact select/attach pattern to mirror in renderText"
  - "extension/content/editor.js:52-53 — the single shared Konva.Transformer on selectLayer (rotateEnabled:false): the one instance reused by box/text/rect (survives annLayer.destroyChildren())"
defects: []
---

# Story: Text-box select/move/resize via shared transformer + re-fit

## What we're doing

Make a committed text box **selectable, movable, and resizable** in select mode by attaching it to the
**released shared `attachBoxTransformer(node, item)`** — the same helper the box tool uses and
`w2-rectangle-tool` will reuse (no parallel transformer). Single-click selects the box and shows the
transformer resize handles; dragging the body moves it; dragging a handle resizes it, **bakes the new
`{x,y,width,height}` back into the model + commits a `snapshot()`** (via the frozen helper), and the
font **re-fits within the cap** with the wrap **re-flowing** — automatically, because the auto-fit
(STORY-fe-002) is recomputed on every `render()` and the helper calls `render()` on commit. Double-click
re-edit (single-click only selects) is the interaction model preserved from fe-001/fe-002; this story
confirms it under the transformer. It also verifies the **lossless round-trip** through the real editor.
This closes the feature.

## What it should look like

- **Select / attach (in `renderText`):** add the selected block mirroring `renderBox` (`editor.js:185-188`):
  ```js
  if (selectedId === item.id && tool === "select") {
    attachBoxTransformer(group, item);   // group = the Konva.Group(Rect+Text) from fe-002
    selectLayer.batchDraw();
  }
  ```
  The attached node is the **fe-002 `Konva.Group`**, which has explicit `width/height` set (for clip),
  so `attachBoxTransformer`'s `node.width() * node.scaleX()` write-back is well-defined. Exactly **one**
  shared `Konva.Transformer` (`editor.js:52-53`, `rotateEnabled:false`) is ever attached; it lives on
  `selectLayer` so it survives `annLayer.destroyChildren()` (`editor.js:98`).
- **Draggable gate (REQUIRED — Concern resolution, see Revisions):** the text Group's creation-time
  `draggable` flag MUST be gated `tool === "select" && selectedId === item.id` — **not** the looser
  `tool === "select"`. The flag physically lives in `renderText` and is **set tight by fe-002 from the
  start** (so there is no loose-then-tight intermediate); this story owns the contract rationale below,
  the transformer attach, and the verification. Rationale: under the loose gate an **unselected**
  box is draggable, so a body-`mousedown` drags the Konva node and suppresses the trailing `click` →
  no selection AND no `dragend` (the geometry write-back lives only in `attachBoxTransformer`, attached
  only when selected) → the move silently reverts on the next `render()`, including the `render()`
  inside `finish()` before serialize, so it can vanish from the saved screenshot. With the tighter gate,
  an unselected box is not draggable → `mousedown` fires `click` → it selects (transformer attaches,
  node becomes draggable) → a second drag moves it with the helper's `dragend` write-back. Standard
  "click-to-select, then drag." `attachBoxTransformer` is **untouched** (still frozen — it calls
  `node.draggable(true)` on the now-selected node). This corrected gate is the **documented shared
  select/move contract** that `w2-rectangle-tool` adopts. **Scope note:** released `renderBox`'s legacy
  `draggable: tool==="select"` is **left unchanged** (changing it would break fe-001's "box tool behaves
  exactly as before" no-regression AC + alter a released contract under a text-box feature); aligning
  `renderBox` is a recommended **separate** follow-up, not folded here.
- **Move:** once selected, `attachBoxTransformer` sets `node.draggable(true)` and a `dragend` that
  writes `item.x,item.y` + `snapshot()` (`editor.js:69`) — body-drag moves the box, undoable. (No
  bespoke dragend in `renderText`.)
- **Resize → re-fit (automatic, no new code):** on `transformend` the helper bakes
  `scaleX/scaleY → width/height` (`Math.max(1, …)`), resets scale to 1, then `snapshot(); render()`
  (`editor.js:61-68`). `render()` rebuilds the text Group at the new geometry and **re-runs the bounded
  auto-fit** (fe-002), so enlarging reduces line count / can grow the font **up to but never above
  `TEXT_AUTOFIT_MAX`**, and shrinking re-wraps + shrinks the font down to `TEXT_AUTOFIT_MIN` (then
  clips). The live transform scales the Group as a visual preview; the crisp re-fit happens on release.
- **Re-edit interaction (preserved, validated here):** **single-click** selects + shows handles and
  does **not** open the editor; **double-click** opens the box-aware textarea (fe-001) pre-filled with
  the current text; committing changes only `text` and preserves `{x,y,width,height}` (`editText` never
  writes geometry). Switching tools / clicking empty canvas / Escape detaches the transformer
  (`render()`'s `transformer.nodes([])` at `editor.js:107`, unchanged).
- **w2 reuse:** after this story the **select/move/resize path is one shared mechanism** across
  `box` (renderBox) and `text` (renderText) — both attach the same `attachBoxTransformer`. The factored
  box-shaped draw (fe-001) + this shared select/resize is exactly what `w2-rectangle-tool` reuses; it
  adds a `renderRect` + a tool registration and attaches to the same helper, with **no** transformer or
  resize rewrite.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:57-70` — `attachBoxTransformer(node,item)` is the frozen
  shared helper: `transformer.nodes([node])`, `node.draggable(true)`, `transformend` bakes
  `width = max(1, node.width()*node.scaleX())` / `height = max(1, node.height()*node.scaleY())`, resets
  scale, `snapshot(); render()`; `dragend` writes `item.x,item.y` + `snapshot()`.
- **Currently:** `editor.js:52-53` — one shared `Konva.Transformer({rotateEnabled:false})` on
  `selectLayer`. `editor.js:107` — `render()` detaches it (`transformer.nodes([])`) when nothing is
  selected in select mode. `editor.js:170-189` — `renderBox` already attaches via the selected block
  (`:185-188`).
- **Currently (post-fe-002):** `renderText` renders the `Konva.Group`(white Rect + black wrapped Text),
  wires `click→select` / `dblclick→editText`, `draggable: tool==="select" && selectedId===item.id` (the
  **tight** gate, set by fe-002 per this story's Concern-2 contract), and the bounded auto-fit is
  recomputed each `render()`. There is **no** transformer attach in `renderText` yet (this story adds it).
- **Dispatch path / call graph:** select-click → `selectedId=item.id` → `render()` → `renderText`
  selected block → `attachBoxTransformer(group,item)`. Resize → `transformend` → bake geometry +
  `snapshot()` + `render()` → re-fit. Undo (`editor.js:91`) pops the pre-resize `model` snapshot.
- **No-regression assertion:** the **box** tool's select/resize (renderBox + the same helper),
  arrow/box undo-redo, the **one-transformer-at-a-time** invariant, `rotateEnabled:false`, and the lossy
  projection are all unchanged. `attachBoxTransformer` is **reused as-is** — **not** renamed, reshaped,
  or duplicated. No change to `editor-model.js`/`background.js`/`manifest.json`.
- **Explicitly changing:** add the `attachBoxTransformer` attach to `renderText`'s selected block (text
  boxes become selectable/movable/resizable with re-fit). No other behavior added.
- **Verified:** 2026-06-19

## How we're doing it

- Single browser file: `extension/content/editor.js`. Add the selected block to `renderText` (mirror
  `renderBox:185-188`) attaching the fe-002 Group to the shared `attachBoxTransformer`. That is the only
  required code change — **re-fit on resize is automatic** (recompute-on-render; fe-002), and **re-edit**
  is already wired (fe-001/fe-002). Do **not** add a re-fit hook, a second transformer, or a bespoke
  transformend/dragend in `renderText`.
- **Attach the `Konva.Group` (the contract, not just "preferred").** The Group exposes explicit
  `width()/height()` (set in fe-002) so the helper's `node.width()*node.scaleX()` bake (`editor.js:64-65`)
  is well-defined, and move/resize affect **text + box as one unit**. The Rect-only fallback is allowed
  **only** if the Group path hits a real blocker AND the Text is made a **child of the transformed node**
  (or `listening:false` and re-synced on render) so the move-as-one-unit invariant + click/transform
  hit-testing still hold — and that fallback must be **flagged to the PO** (it changes behavior the ACs
  assume). Do not silently ship the sibling-Rect fallback (Text lagging the Rect on drag / glyphs snapping
  on `transformend` / click-shadowing are the un-analyzed behaviors that path introduces — contrarian
  Finding 2). (Engineer judgment is limited to the fit-loop internals, not the attach topology.)
- **Mid-drag glyph distortion is EXPECTED, not a defect.** A non-uniform corner resize scales the Group
  via `scaleX/scaleY`, so the black glyphs visibly stretch/squash **during** the drag and snap to the
  crisp re-fit only on `transformend` release (the live transform is Konva's built-in preview). The
  resize E2E note + the browser-tester must treat this mid-drag distortion as expected so it is not filed
  as a false-positive rendering defect (contrarian Finding 2).
- **Round-trip is verification-only** (no code): the text item `{x,y,width,height,text}` already
  serializes/deserializes opaquely via the released w0 pure module; re-render re-fits identically. Drive
  the through-the-editor round-trip in the E2E lane.
- **Do NOT** touch `editor-model.js` (opaque pass-through preserved; no per-item validation),
  `background.js`, or `manifest.json`.
- **Dev server / verification:** confirm the extension is loaded in a **user-owned** Chrome, then
  delegate the smoke to `bt` (handle-drag resize, re-fit, single-vs-double-click, round-trip read live
  Konva nodes + the resolve payload). Do **not** background-spawn a long-lived browser.

## How we validate it was done correctly

- [ ] **Single-click** a committed text box → it selects and attaches **exactly one** shared
      `Konva.Transformer` (`rotateEnabled:false`) showing resize handles; it does **not** open the editor.
- [ ] **Body-drag** moves the box and writes `{x,y}` back (undoable); **handle-drag** resizes it, bakes
      `{x,y,width,height}` back into the model (scale reset to 1), and commits a `snapshot()`.
- [ ] **Resize re-fits within the cap + re-flows wrap:** enlarging the box reduces line count / grows the
      font up to (never above) `TEXT_AUTOFIT_MAX`; shrinking re-wraps and shrinks the font (to
      `TEXT_AUTOFIT_MIN`, then clips). The font/line change happens via `render()` re-fit, not a stored value.
- [ ] **Undo** after a resize restores the prior `{x,y,width,height}` **and** the prior fit/wrap (the
      resize committed one `snapshot()`).
- [ ] **Double-click** re-opens the box-aware editor pre-filled with the existing text; committing
      **non-empty** text changes only `text` and leaves `{x,y,width,height}` unchanged
      (geometry-preserving re-edit, undoable). Committing **empty** text on re-edit **removes the whole
      committed box** (geometry + all), consistent with the create-flow empty-removal and undoable — this
      is intended, NOT a regression (see Revisions / fe-001 Finding 1).
- [ ] **Unselected body-drag does not lose the move:** in select mode, an unselected text box's
      `mousedown` **selects** it (does not drag); a drag of the now-selected box writes `{x,y}` back via
      the helper's `dragend`. A move survives a subsequent `render()` / `finish()` (no silent revert).
      The text Group's `draggable` is gated `tool==="select" && selectedId===item.id`.
- [ ] **Lossless round-trip:** store the Done payload's `model` at `screenshots[].model`, re-send via
      `ANNOTATE {image, model}`, Done again → `done2.model.items` `deepEquals` `done1.model.items`
      (text item `{x,y,width,height,text}` survives verbatim); the reloaded box reconstructs the same
      line count + font; the lossy projection entry is still exactly
      `{id,type:"text",x:round(x),y:round(y),text}`.
- [ ] `attachBoxTransformer` is **reused unchanged** (no parallel transformer, no signature/behavior
      change); the box tool's select/resize is unregressed.

## Motion contract

`n/a` — vanilla-JS Konva canvas editor, `frontend_lane: N/A`. The transformer handle chrome appears on
selection and the wrap/font re-fit on resize are **instantaneous canvas updates** (the live transform is
Konva's built-in drag, not a branded animation), so there is no reduced-motion-affected motion.
Consistent with feature.md `Motion E2E: n/a`.

## Unit tests

> Transformer attach, resize-bake, re-fit, and the through-the-editor round-trip are
> **Konva/DOM-dependent** → **browser-tester Playwright E2E** lane. The pure-module round-trip invariant
> for the geometry-bearing text item is already covered by `extension/editor.textbox.test.mjs`
> (STORY-fe-001) and `extension/editor.model.test.mjs:185` (opaque-field round-trip, released) — no
> change to either node file here.

**browser-tester E2E lane — `extension/e2e/w1-text-box-autofit.spec.ts` (authored by `bt`):**
- `select attaches exactly one shared transformer (rotateEnabled:false)` — single-click a text box shows
  handles; clicking empty canvas / Escape detaches it; never two transformers.
- `resize re-fits font + re-flows wrap and is undoable` — enlarge via a corner handle → `{x,y,width,height}`
  updated, line count drops / font grows ≤ cap; Undo restores prior geometry + fit. **Note:** mid-drag
  glyph stretch/squash before the on-release re-fit is EXPECTED (Konva's live Group scale), not a defect.
- `double-click re-edits, single-click only selects` — single-click selects (no textarea); double-click
  opens the pre-filled editor; re-commit of NON-EMPTY text preserves geometry, changes only text;
  re-commit of EMPTY text removes the committed box (intended, undoable — not a regression).
- `unselected body-drag does not lose the move` — in select mode, mousedown-drag a NOT-yet-selected box;
  assert it selects (rather than performing a non-written-back drag), and that a move of the selected box
  survives a subsequent render()/Done (geometry persisted, not silently reverted).
- `text box round-trips losslessly through persist→reload` — `done2.model.items deepEquals done1.model.items`;
  the lossy projection stays `{id,type:"text",x,y,text}`.

## Dependencies

- STORY-fe-001 — box-geometry text item + box-aware `editText` (the re-edit path).
- STORY-fe-002 — the auto-fit Group render whose node is attached to the transformer and re-fit on resize.

(Reuses the **released** w0-editor-foundation `attachBoxTransformer` + single shared transformer at the
feature level. No cross-domain dependency; see feature.md §No-work domains.)

## History


- 2026-06-19T17:24:51Z — orchestrator — validate validated; honesty passed (BOSS-mode implement)
- 2026-06-19 — created by frontend-architect (effort=2, depends on STORY-fe-001, STORY-fe-002)
- 2026-06-19T00:00:00Z — implemented (commit: 3cab947)
- 2026-06-19T20:10:00Z — DEFECT-001 fix applied (commit: 6a03abb) — dblclick Option A + bounded fit loop; bt re-smoke 7/7 scenario 4 pass
2026-06-19T22:19:59Z — BOSS: status: 'validated' -> 'released' (Released via Wave-1 PR #2 (8c340a6))

## Engineer Notes

Implemented in the same commit as fe-001 and fe-002.

**Key implementation details:**
- Select block added to `renderText`: mirrors `renderBox:185-188` exactly:
  ```js
  if (selectedId === item.id && tool === "select") {
    attachBoxTransformer(group, item);
    selectLayer.batchDraw();
  }
  ```
- The attached node is the `Konva.Group` from fe-002, which has explicit `width`/`height` set (for
  the clip). `attachBoxTransformer`'s `node.width() * node.scaleX()` bake is therefore well-defined.
- `attachBoxTransformer` is reused **unchanged** (frozen signature — no parallel transformer, no fork).
  On `transformend` it bakes `scaleX/scaleY → width/height` + `snapshot(); render()`, which triggers
  the auto-fit re-fit automatically.
- **Resize → re-fit is automatic** (no new code): `render()` rebuilds the Group at the new geometry
  and re-runs `fitTextFontSize`. Enlarging reduces line count / can grow font up to (never above)
  `TEXT_AUTOFIT_MAX`; shrinking re-wraps + shrinks to `TEXT_AUTOFIT_MIN` (then clips).
- **Tight draggable gate** physically set in fe-002's `renderText` Group creation; this story owns
  the contract rationale. On unselected mousedown → `click` fires → selectedId set → `render()` →
  group becomes draggable → second drag moves with `dragend` write-back.
- **Re-edit** (double-click → `editText(item, null)`): box-aware from fe-001 — textarea fills the
  current box geometry. Geometry preserved on non-empty commit; box removed on empty (intentional,
  consistent with create-flow, undoable).
- **Lossless round-trip**: model→persist→load→model is identity by construction (geometry+text only,
  no stored fit); verified by `editor.textbox.test.mjs` node tests.
- `renderBox` (released) `draggable: tool==="select"` left unchanged — preserving fe-001 no-regression AC.

**Contract nuance discovered:** The tight draggable gate on the text Group diverges from released
`renderBox` which uses the looser `tool==="select"`. This is **intentional by PO arbitration** and
documented in fe-003 revisions. The text pattern is the correct contract `w2-rectangle-tool` adopts.

**Smoke verification (bt, 2026-06-19):**
- Scenarios 1–3 + 5 all passed: drag-to-draw ✓, round-trip ✓, select/transformer/resize ✓, hostile model ✓
- Scenario 4 (double-click re-edit) initially FAILED — root cause: Konva 9.3.22 dblclick detection
  compares the shape ref stored at click #1 pointerup (`r`) with `getIntersection()` at click #2 (`l`).
  Since `render()` is called synchronously in the `click tap` handler, `annLayer.destroyChildren()`
  creates a new Group object between the two clicks → `r !== l` → `pointerdblclick` never fires.
- **Fix applied (commit 1fcf947):** skip `render()` in `click tap` when `selectedId === item.id`
  (no state change, no re-render needed). Both clicks of the dblclick then hit the same Group object
  → Konva fires `pointerdblclick` → `editText` opens. UX: single-click selects (renders once on
  first selection), subsequent dblclick on the selected item opens the editor. Matches the AC.
- **DEFECT-001 combined commit (`6a03abb`):** Fix 1 (dblclick, Option A from commit 1fcf947) and
  Fix 2 (bounded fit loop — binary search + TEXT_FIT_SAMPLE=500, owned by fe-002) shipped together.
  bt re-smoke 2026-06-19T20:05Z: **7/7 scenario 4 sub-steps pass** — transformer handles visible
  after single-click (no textarea), textarea open and pre-filled after dblclick, geometry preserved
  after edit+Enter commit, 0 console errors. Screenshots: `bt-s4-1-single-click-selected.png`,
  `bt-s4-2-dblclick-textarea-open.png`, `bt-s4-3-after-edit-committed.png`.
  Large-text scenario also cleared: no hang, render <2s, 0 console errors.
  **Smoke evidence for gate-2**: bt → fe conversation, 2026-06-19T20:05Z.

## Contrarian Findings

_Phase 5.5 stress-test (contrarian-architect). Claims verified against released
`extension/content/editor.js` (lines cited inline)._

### Finding 1 — Body-dragging an *unselected* text box silently loses the move (no `dragend` write-back) — and this story enshrines it into the shared shape mechanism w2 inherits

**Severity:** concern
**Mechanism:** In select mode the node is `draggable: tool === "select"` (STORY-fe-002 sets this on the
Group; `editor.js:178` does the same on `renderBox`'s rect) — i.e. **draggable even when not selected**.
The `dragend` that writes `item.x/item.y` back to the model lives **only** inside `attachBoxTransformer`
(`editor.js:69`), which this story calls **only** in the `selectedId === item.id` block. So if the user
mousedown-drags a text box that is not already selected, Konva moves the node and suppresses the trailing
`click` (so no selection happens either) → **no `dragend` fires → the model is never updated**. The very
next `render()` (select something else, resize, undo, tool change, or `finish()` at `editor.js:300` right
before serialize) rebuilds the Group at the old `item.x/item.y`, so the move **silently reverts** — and
if it reverts during `finish()`, the saved screenshot loses the move entirely. This is identical to the
released `renderBox` characteristic, so it is "consistent with w0," but this story explicitly makes
select/move/resize "one shared mechanism across box and text" that "**w2-rectangle-tool reuses**" — so
the latent move-loss is about to be enshrined as the contract for a third shape, tripling its surface
before anyone has consciously accepted it. **Recommendation:** acknowledge or mitigate-via-revision. Two
clean options: (a) accept as consistent-with-w0 and add an `## Acknowledged Risk` block stating the
"select-then-drag" requirement is intentional; or (b) fix once in the shared path — gate `draggable` on
`tool==="select" && selectedId===item.id` so an unselected box's mousedown selects (via the `click`
handler) instead of dragging, then a second drag moves it with the helper's `dragend` attached. Option (b)
touches the shared box/text/rect pattern, so it is a deliberate cross-shape decision for arbitration, not
an in-FE-story tweak.

### Finding 2 — Group-vs-Rect transformer attachment: the fallback path has un-analyzed live-drag and hit-test behavior

**Severity:** info
**Mechanism:** The story prefers attaching `attachBoxTransformer` to the fe-002 `Konva.Group` (which has
explicit `width/height` so the helper's `node.width()*node.scaleX()` bake at `editor.js:64-65` is
well-defined), but hedges: "if the Group's intrinsic size is not honored ... attach to the background Rect
instead and keep the Text synced on render." That fallback changes behavior the ACs do not cover: (1) the
helper's `dragend` writes `item.x/item.y` from the **Rect's** position, but the Text is a *sibling*, not a
child, so during a body-drag the Text does not move with the Rect until the next `render()` — a visible
lag; (2) on resize, only the Rect scales live while the Text stays put, then snaps on `transformend`; (3)
whichever node sits on top intercepts clicks, so the Text node must be `listening:false` or the Rect's
click-select/transform handles can be shadowed. Separately, even on the **preferred** Group path, a
non-uniform corner resize scales the Group via `scaleX/scaleY`, so the black glyphs visibly **stretch/squash
during the drag** and snap to the re-fit only on release (the story calls this an acceptable "visual
preview") — a tester unaware of this may file the mid-drag distortion as a rendering bug.
**Recommendation:** record the decision explicitly. Prefer the Group; if falling back to the Rect, require
the Text be a child of the transformed node (or `listening:false` and resynced on render) so move/resize
affect text+box as one unit. Add a one-line note to the resize E2E that mid-drag glyph distortion before
the on-release re-fit is expected, not a defect.

## Revisions

### 2026-06-19 — product-owner arbitration (Phase 6)

**Finding 1 (concern — unselected body-drag silently loses the move): RESOLVED by revision, scoped
carefully.** The data-loss is real and this story explicitly promotes the select/move/resize path to the
"one shared mechanism" `w2-rectangle-tool` reuses, so the latent quirk would be enshrined for three
shapes. **Decision: FIX on the NEW text path** — gate the text Group's creation-time `draggable` flag
`tool === "select" && selectedId === item.id` so an unselected box's mousedown selects (via `click`)
instead of performing a non-written-back drag; the now-selected box drags with `attachBoxTransformer`'s
`dragend` write-back. `attachBoxTransformer` stays frozen (untouched). I **diverged from the contrarian's
"fix once in the shared path" wording** after finding a contradiction: applying the gate to a shared
helper that released `renderBox` also uses would change released box-drag behavior and **break fe-001's
"box tool behaves exactly as before" no-regression AC**. So the corrected gate is applied to the text
path only and **documented as the shared contract `w2-rectangle-tool` adopts** (w2 follows the text
pattern, not legacy `renderBox`). Aligning released `renderBox` is recommended as a **separate**
follow-up — not folded into a text-box feature. This is a conscious fix, not an Acknowledged Risk: the
data-loss is eliminated everywhere this feature owns code (text), and the contract w2 inherits is the
correct one. Added an E2E case asserting an unselected-box drag does not lose the move.

**Finding 2 (info — Group-vs-Rect attach fallback + mid-drag glyph distortion): FOLDED IN.** Promoted
the Group attach from "preferred" to the **contract** (text+box move/resize as one unit; the
well-defined `width()*scaleX()` bake). The Rect-only fallback is now allowed only if the Group path hits
a real blocker AND the Text is a child of the transformed node (or `listening:false`+resync), and must
be **flagged to the PO** — closing the un-analyzed sibling-Rect lag/hit-shadow behavior. Recorded that
mid-drag glyph stretch/squash (Konva's live Group scale before the on-release re-fit) is **expected**,
with an E2E note so the browser-tester does not file a false-positive rendering defect.

**fe-001 Finding 1 cross-reference (info — re-edit→empty deletes the committed box): ACCEPTED as
intended; AC wording fixed here + in fe-001 + feature.md.** Re-edit→empty removing the whole box is the
intended behavior (consistent with the locked create-flow empty-removal; undoable; a Snapdeck text box
carries only text, so an emptied box has no annotation value — Google-Slides retention parity rejected).
The contrarian correctly caught that the AC framing "only `text` changes" silently failed on the empty
path; clarified the re-edit AC to distinguish non-empty (geometry preserved) vs empty (box removed) and
added the E2E note so the empty-delete is not filed as a regression.

Status promoted pending → approved. **FE-architect confirmed both revisions implementable as written**
(Group attach is satisfiable — the fe-002 Group has explicit `width/height`, so the helper's
`width()*scaleX()` bake is well-defined; no Rect fallback needed). **Cross-story reconciliation applied:**
FE-architect flagged that the `draggable` flag lives in fe-002's `renderText`, so to avoid a
loose-then-tight intermediate + a one-line story contradiction, the **tight gate is now set in fe-002
from the start** (fe-002's "Interaction handlers preserved" bullet + its "Currently (post-fe-002)"
baseline here both read the tight gate); this story retains the contract rationale + the transformer
attach + verification. Released `renderBox` stays loose (preserves fe-001's no-regression AC) — unchanged.

## Security Review

_Phase 7 STRIDE pass (security-architect). Claims grounded against released
`extension/content/editor.js` (lines cited inline)._

### Finding — Select/move/resize reuses the frozen shared `attachBoxTransformer`; no new security surface

**Severity:** info
**Threat (STRIDE):** none material across S/T/R/I/D/E. This story only adds the
`attachBoxTransformer(group, item)` attach to `renderText`'s selected block — the **frozen** shared helper
(`editor.js:57-70`), reused unchanged (no parallel transformer). All effects are local Konva node
manipulation plus `snapshot()`/`render()` on the **in-memory** `model`; the resize write-back bakes
`Math.max(1, node.width()*node.scaleX())` / `…height…` into **numeric** `width/height` and writes numeric
`x/y` on `dragend` (`editor.js:64-65,69`) — numeric only, never interpolated into markup or a `style`
string, so no injection vector is introduced. No new persistence path, no new `chrome.runtime` message
type/resolve field, no network call, no manifest/permission/host change (confirmed against the be/db/do
sentinels + `manifest.json`). The unselected-body-drag move-loss the contrarian flagged (resolved by PO
via the tight `draggable` gate `tool==="select" && selectedId===item.id`) is a **data-integrity / UX**
concern, **not** a confidentiality/integrity-against-an-attacker issue — the data source remains the
extension's own isolated-world `model`, not page- or network-controlled.
**Recommendation:** none (record-only). Keep `attachBoxTransformer` frozen (do not fork it); the geometry
write-back staying **numeric** (`editor.js:64-65,69`) is precisely what keeps this resize/move surface free
of a style/markup-injection vector. The lossless round-trip this story verifies rides the same opaque
extension-owned `model` path — no new trust boundary.

**PO disposition (Finding — frozen transformer, no new security surface):** ACCEPT_AS_RECOMMENDATION —
confirmed; reusing the frozen `attachBoxTransformer` with numeric-only geometry write-back adds no
persistence/IPC/network/permission surface, and the unselected-drag move-loss (resolved in Phase 6 via
the tight `draggable` gate) is a data-integrity/UX matter, not an attacker-facing one. **Standing
guardrail (carries to w2-rectangle-tool):** the shared select/move/resize contract must keep
`attachBoxTransformer` frozen and the write-back numeric — no forked transformer, no style/markup path.
Non-gating; no AC change.

## Validation

- 2026-06-19T17:24:51Z — result: **validated** (honesty: passed)
- frontend-validator: all ACs met — shared attachBoxTransformer reused unchanged, resize re-fit, double-click re-edit / single-click select, lossless round-trip. renderBox untouched; factored for w2 reuse.
