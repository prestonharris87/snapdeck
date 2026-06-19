---
type: story
id: STORY-fe-002
name: "Shared Konva.Transformer move/resize + box select mode"
domain: frontend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 3
status: released
depends_on: [STORY-fe-001]
created_at: 2026-06-19T03:10:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/background.js
  - extension/content/overlay.css
  - extension/lib/konva.min.js
  - extension/manifest.json
reuse_patterns:
  - "extension/content/editor.js:98-108 — renderArrow selected-branch (endpoint anchors): the canonical 'render handles for the selected item' pattern the transformer attach mirrors"
  - "extension/content/editor.js:91-96 + 119 — dragend write-back + snapshot(): the geometry-write-back-on-interaction pattern to mirror for box move/resize"
  - "extension/content/editor.js:46-48 — stage/layer setup (bgLayer/annLayer/cursorLayer): where to add the dedicated select layer that holds the shared transformer"
defects: []
---

# Story: Shared Konva.Transformer move/resize + box select mode

## What we're doing

Add a **single shared `Konva.Transformer`** move/resize mechanism for box-shaped annotations, plus the
**select-mode** interaction that drives it: in select mode, clicking a box selects it and attaches the
one shared transformer (resize handles, `rotateEnabled: false`); dragging a handle resizes and dragging
the body moves, each writing the new `{x,y,width,height}` back to the box's `model` item and committing a
`snapshot()` (so it participates in undo/redo). Exactly one transformer is attached at a time;
deselecting (empty-canvas click, Escape, or tool switch) detaches it. The attach logic is exposed as an
**internal `editor.js` helper** that the future **w1-text-box** and **w2-rectangle** tools attach to
instead of rolling their own resize — this is **contract surface #3** (frozen at STORIES_LOCKED).

## What it should look like

- **One shared transformer instance**, created once per editor session:
  `new Konva.Transformer({ rotateEnabled: false })`. Recommended placement: a **dedicated select layer**
  (`var selectLayer = new Konva.Layer();` added at `editor.js:46-48`) that `render()`'s
  `annLayer.destroyChildren()` (`:75`) never destroys — so the single instance survives re-renders. (The
  engineer may instead host it on `annLayer` and manage its lifecycle across `destroyChildren`, but the
  dedicated layer is simpler and matches the "one shared instance" contract.)
- **Internal helper — the reusable contract (frozen):**

  ```
  // closure-scoped in openEditor(); reused by w1 text-box & w2 rectangle render branches
  function attachBoxTransformer(node, item) {
    transformer.nodes([node]);                 // one node at a time → exactly one transformer attached
    node.draggable(true);
    // resize: Konva applies scaleX/scaleY to the node — bake it back into width/height
    node.on("transformend", function () {
      item.x = node.x();
      item.y = node.y();
      item.width  = Math.max(1, node.width()  * node.scaleX());
      item.height = Math.max(1, node.height() * node.scaleY());
      node.scaleX(1); node.scaleY(1);
      snapshot();
    });
    // move: body drag
    node.on("dragend", function () { item.x = node.x(); item.y = node.y(); snapshot(); });
  }
  ```

  w1/w2 box subtypes call `attachBoxTransformer(rectNode, item)` from their own selected-render branch
  rather than creating their own transformer. **Signature + behavior are the frozen contract** — do not
  rename/reshape without a contract bump.
- **Select-mode wiring (extends STORY-fe-001's `renderBox`):**
  - `renderBox` rect becomes `draggable: tool === "select"`; add `rect.on("click tap", …)` →
    `e.cancelBubble = true; if (tool === "select") { selectedId = item.id; render(); }` (mirror
    `renderArrow` `:90` / `renderText` `:117`).
  - In `render()`'s box branch, when `selectedId === item.id && tool === "select"`, call
    `attachBoxTransformer(rectNode, item)` (mirror the selected-arrow anchor branch `:98-108`).
  - When **no** box is selected (or not in select mode), `render()` detaches the transformer:
    `transformer.nodes([])`.
- **Deselect triggers (all detach the transformer):**
  - Empty-canvas click in select mode — already clears selection at `editor.js:160-162`; ensure `render()`
    then calls `transformer.nodes([])`.
  - Tool switch — `setTool` already nulls `selectedId` + re-renders (`:71`).
  - **Escape** — `onKey` (`:197`) currently always finishes the editor. Change to **deselect-if-selected,
    else finish**: `if (selectedId) { selectedId = null; render(); } else { finish(true); }`. This is
    feature-mandated (feature.md §"UX patterns": Escape is a deselect trigger) and preserves the
    no-selection Escape→close behavior.
- **Visuals:** default `Konva.Transformer` handle chrome only (no theming — deferred to w1).
  `rotateEnabled: false` ⇒ no rotation handle.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:98-108` — selected **arrow** draws bespoke endpoint
  **circle anchors** for resize; `:121-127` — selected **text** draws a static dashed selection `Rect`
  (no resize handles). There is **no `Konva.Transformer`** anywhere and **no box select**.
- **Currently:** `editor.js:46-48` — three layers (`bgLayer`/`annLayer`/`cursorLayer`); `render()`
  calls `annLayer.destroyChildren()` each pass (`:75`).
- **Currently:** `editor.js:160-162` — empty-canvas click in select mode sets `selectedId=null; render()`.
  `editor.js:71` — `setTool` nulls `selectedId`. `editor.js:197` — Escape calls `finish(true)`.
- **Currently:** `editor.js:91-96` (arrow move) and `:119` (text move) — the dragend→write-geometry→
  `snapshot()` pattern.
- **Dispatch path / call graph:** select-mode click → `selectedId` set → `render()` (`:74-81`) →
  `attachBoxTransformer` → handle/body drag → `transformend`/`dragend` → write `item.{x,y,width,height}`
  → `snapshot()` (`:67`) → undo/redo (`:68-69`).
- **No-regression assertion:** arrow endpoint anchors (`:98-108`), whole-arrow move (`:91-96`), text
  drag (`:119`), text selection rect (`:121-127`), undo/redo (`:67-69`), and the empty-canvas/tool-switch
  deselect for arrow/text MUST be unchanged. The transformer/select machinery applies only to `type:"box"`
  nodes.
- **Explicitly changing:** add the shared `Konva.Transformer` (rotateEnabled:false) on a dedicated select
  layer; `renderBox` gains click-select + draggable + transformer attach; `render()` attaches/detaches the
  single transformer; **Escape becomes deselect-if-selected-else-finish**.
- **Verified:** 2026-06-19

## How we're doing it

- All changes in `extension/content/editor.js`. Build on STORY-fe-001's `renderBox` / `box` model item.
- Create the shared transformer once in `openEditor()`; place it on a dedicated select layer added at
  `:46-48`. Implement `attachBoxTransformer(node, item)` as the closure-scoped reusable helper above.
- **Konva resize semantics:** the Transformer mutates the node's `scaleX/scaleY`, not `width/height`. The
  helper MUST bake scale into `width/height` and reset scale to 1 on `transformend` (see snippet),
  otherwise the persisted geometry will be wrong and the round-trip (STORY-fe-003/004) will drift.
- **Konva.Transformer availability — confirmed:** devops-architect verified (2026-06-19) that the
  vendored `extension/lib/konva.min.js` ships the full Transformer (`rotateEnabled`, `anchorSize`,
  `_createAnchor` internals present), so `window.Konva.Transformer` exists and `rotateEnabled: false` is
  supported. No re-vendor needed; do not edit `konva.min.js`.
- Keep the "exactly one transformer" invariant via `transformer.nodes([node])` on select and
  `transformer.nodes([])` on every deselect path.
- **Verification:** delegate the smoke to `bt` (browser-tester) per `.claude/onboarding/frontend.md`
  §"Mandatory smoke-test protocol"; confirm the extension is loaded in a user-owned Chrome first.

## How we validate it was done correctly

- [ ] In **select** mode, clicking a box attaches **exactly one** `Konva.Transformer` to that node, with
      `rotateEnabled === false` (resize handles only, no rotation handle).
- [ ] Dragging a corner handle resizes the box; on `transformend` the box's `model` item reflects the new
      `{x,y,width,height}` with **scale baked back to 1** (node `scaleX/scaleY` reset to 1), and a
      `snapshot()` is committed — **Undo restores the pre-resize geometry**.
- [ ] Dragging the box **body** moves it; on `dragend` the item's `{x,y}` update and a `snapshot()` is
      committed (Undo restores the pre-move position).
- [ ] **Single-transformer invariant:** selecting box A then box B leaves the transformer attached to B
      only (A's handles gone); at most one transformer is ever attached.
- [ ] **Deselect detaches:** clicking empty canvas, pressing **Escape while a box is selected**, and
      switching tools each detach the transformer (`transformer.nodes()` empty). Escape with **nothing**
      selected still closes the editor (unchanged).
- [ ] `attachBoxTransformer(node, item)` exists as an internal closure helper with the frozen signature so
      w1/w2 can attach to it.
- [ ] **No regression:** arrow endpoint anchors, arrow move, text drag, text selection rect, and undo/redo
      behave exactly as before.

## Motion contract

`n/a` — `frontend_lane: N/A`. The `Konva.Transformer` handles appear/disappear on (de)selection with no
branded transition and no project motion tokens; there is no enter/exit animation and therefore no
reduced-motion-affected behavior. (Consistent with feature.md `Motion E2E: n/a`.)

## Unit tests

> No JS unit-test runner exists for the extension (see STORY-fe-001 note + `clarifications.md`). Verified
> via the browser-tester Playwright E2E harness (feature.md E2E "box draw → select → resize" spec).

- `extension/e2e/w0-editor-foundation.spec.ts` — `box select attaches one transformer (no rotate)` — in
  select mode, clicking a box yields exactly one attached transformer with `rotateEnabled:false`.
- `extension/e2e/w0-editor-foundation.spec.ts` — `resize writes geometry back and is undoable` — dragging
  a handle updates `item.{x,y,width,height}` (scale baked to 1); Undo restores prior geometry.
- `extension/e2e/w0-editor-foundation.spec.ts` — `body drag moves the box and is undoable` — dragging the
  body updates `item.{x,y}`; Undo restores position.
- `extension/e2e/w0-editor-foundation.spec.ts` — `selecting a second box re-targets the single
  transformer` — select A then B → transformer attached to B only.
- `extension/e2e/w0-editor-foundation.spec.ts` — `deselect detaches transformer` — empty-canvas click /
  Escape-while-selected / tool switch each empty `transformer.nodes()`.

## Dependencies

STORY-fe-001 (needs the `box` model item + `renderBox` to attach select/resize to).

## Revisions

- 2026-06-19 — **product-owner arbitration.** Confirmed `attachBoxTransformer(node, item)` is the frozen
  **contract surface #3** that w1-text-box and w2-rectangle attach to (single shared transformer, not
  per-tool). Verified the load-bearing detail that `transformend` **bakes `scaleX/scaleY` into
  `width/height` and resets scale to 1** — this is what keeps the persisted geometry correct so the
  STORY-fe-003/004 round-trip does not drift. Confirmed the Escape→deselect-if-selected-else-finish change
  matches feature.md §"UX patterns / interaction notes". No story-content change. **Promoted
  `pending → approved`.**

## Engineer Notes

Smoke verification: browser-tester smoke deferred — extension requires user-owned Chrome (`.claude/state/dev-server.txt` empty). Manual verification deferred — extension content-script.

Implementation notes:
- `selectLayer` inserted between `annLayer` and `cursorLayer` so transformer handles appear above annotations but below the cursor layer.
- `attachBoxTransformer` calls `snapshot(); render()` on `transformend` (after scale bake) so the baked geometry is correctly re-created on the re-render and undo history is correct.
- `dragend` in `attachBoxTransformer` calls only `snapshot()` (no render) since Konva has already moved the node to the new position — this is sufficient for drag interactions.
- Escape deselect: `selectedId` check precedes `finish(true)` call, preserving the no-selection Escape→close behavior.
- Konva.Transformer confirmed available in `extension/lib/konva.min.js` (devops-architect 2026-06-19).

## History

- 2026-06-19 — created by frontend-architect (effort=3, depends on STORY-fe-001)
- 2026-06-19 — implemented (commit: 4e29db1)
2026-06-19T15:02:27Z — BOSS: status: 'validated' -> 'released' (Released via Wave-0 PR #1 (merge 5526403))

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **INFO**

**INFO — clean, no new attack surface.** Single shared `Konva.Transformer` + select-mode interaction, all
within the isolated-world editor. No new permission/host/message/network surface. One robustness positive
worth noting: the `transformend` write-back clamps geometry with `Math.max(1, …)` on `width`/`height`,
so a resize can't persist a zero/negative dimension that would later feed the round-trip — this is the
kind of render-boundary sanity the STORY-fe-004 LOW asks for on the *hydration* side. The
Escape→deselect-if-selected-else-finish change is UI-only with no security impact.

**Spoofing / Tampering / Repudiation / DoS / EoP: N/A** — local editor interaction, no trust boundary
crossed; the `rotateEnabled:false`/single-transformer invariants are correctness, not security,
properties.

**PO disposition:** ACCEPT_AS_RECOMMENDATION. No action — the `Math.max(1, …)` clamp on
`transformend` width/height is a robustness positive already specified in the story (it prevents a
zero/negative dimension persisting into the round-trip). No new surface, no new AC, no STORY-sec.
