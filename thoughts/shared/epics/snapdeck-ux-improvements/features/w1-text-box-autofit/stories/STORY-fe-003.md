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
status: pending
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
- **Move:** `attachBoxTransformer` sets `node.draggable(true)` and a `dragend` that writes
  `item.x,item.y` + `snapshot()` (`editor.js:69`) — body-drag moves the box, undoable. (No bespoke
  dragend in `renderText`.)
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
  wires `click→select` / `dblclick→editText`, `draggable: tool==="select"`, and the bounded auto-fit is
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
- Ensure the attached node (the Group) exposes `width()/height()` (set explicitly in fe-002) so the
  helper's scale→geometry bake is correct; if the Group's intrinsic size is not honored by the helper's
  math during testing, attach to the background Rect instead and keep the Text synced on render — but
  **prefer the Group** so move/resize affect text+box as one unit. (Engineer judgment; the contract is
  "one shared `attachBoxTransformer`, geometry written back, snapshot committed".)
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
- [ ] **Double-click** re-opens the box-aware editor pre-filled with the existing text; committing changes
      only `text` and leaves `{x,y,width,height}` unchanged (geometry-preserving re-edit, undoable).
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
  updated, line count drops / font grows ≤ cap; Undo restores prior geometry + fit.
- `double-click re-edits, single-click only selects` — single-click selects (no textarea); double-click
  opens the pre-filled editor; re-commit preserves geometry, changes only text.
- `text box round-trips losslessly through persist→reload` — `done2.model.items deepEquals done1.model.items`;
  the lossy projection stays `{id,type:"text",x,y,text}`.

## Dependencies

- STORY-fe-001 — box-geometry text item + box-aware `editText` (the re-edit path).
- STORY-fe-002 — the auto-fit Group render whose node is attached to the transformer and re-fit on resize.

(Reuses the **released** w0-editor-foundation `attachBoxTransformer` + single shared transformer at the
feature level. No cross-domain dependency; see feature.md §No-work domains.)

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on STORY-fe-001, STORY-fe-002)
