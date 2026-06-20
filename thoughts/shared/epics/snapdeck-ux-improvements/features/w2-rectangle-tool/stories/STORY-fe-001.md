---
type: story
id: STORY-fe-001
name: "Restyle box render+preview to red, relabel Rectangle"
domain: frontend
parent_feature: w2-rectangle-tool
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 1
status: pending
depends_on: []
frontend_lane: N/A
visual_references: []
diff_estimate: mechanical
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/content/editor-model.js          # projection lives here — STORY-fe-002 owns it
  - extension/editor.model.test.mjs            # projection tests — STORY-fe-002 owns them
  - controller/snapdeck_controller/reports.py  # report.md rectangle branch — backend-architect (STORY-be)
reuse_patterns:
  - extension/content/editor.js:226   # renderArrow stroke "#e53935" — the annotation-red literal to copy
  - extension/content/editor.js:272   # renderText bgRect stroke "#e53935" — red-outline house style
  - extension/content/editor.js:517   # btn(label, title) toolbar factory + plain-text label convention (box already plain)
defects: []
created_at: 2026-06-20T16:40:00Z
last_run_id: run-20260619-021434-24507
---

# Story: Restyle box render + draw-preview to annotation red, relabel toolbar "Box" → "Rectangle"

## What we're doing

Promote the released w0 generic `type:"box"` editor primitive into the user-facing red-outline
rectangle by **restyling** it and **relabeling** its toolbar button — no geometry, draw, select,
transformer, or model change. Three one-line edits in `extension/content/editor.js`: (1) the
committed-box stroke `#1e88e5` → `#e53935` (the annotation red used by arrows and text), (2) the
live drag-preview stroke for the box branch `#1e88e5` → `#e53935` so draw-time and committed colour
agree, and (3) the toolbar button label + `title` "Box" → "Rectangle". The internal tool key, the
`api.onTool("box")` dispatch, the model item `type:"box"` literal, the `>4px` sub-threshold reject,
and the `attachBoxTransformer` move/resize path all stay **exactly as released** (back-compat with
already-persisted records — see the no-regression assertion).

## What it should look like

- **Toolbar:** the button currently rendered as `btn("Box", "Draw a box (drag)")`
  (`editor.js:527`) reads **`"Rectangle"`** as its label and **`"Draw a rectangle (drag)"`** as its
  `title`. Plain text only — **no emoji, no symbol-glyph char, no inline `<svg>`** (matches the
  existing plain-text "Box" treatment and the w0/w1 toolbar rule). Do NOT add a leading glyph even
  though the sibling Arrow/Text/Select buttons happen to ship leading symbol chars — those are
  released and out of scope here.
- **Committed rectangle:** `renderBox()` draws a `Konva.Rect` with `stroke: "#e53935"`,
  `strokeWidth: 2` (unchanged), and the **near-transparent interior fill `"rgba(0,0,0,0.001)"`
  unchanged** (keeps the interior a hit target for click-select — a true no-fill Rect is not
  interior-clickable and would break select mode).
- **Live draw-preview:** while dragging with the Rectangle tool, the `__boxdrawing` preview Rect
  strokes **`#e53935`** (was `#1e88e5`), `strokeWidth: 2`, `dash: [4,4]`, fill `"rgba(0,0,0,0.001)"`
  — all unchanged except the colour. The `__textdrawing` preview already strokes `#e53935`; leave it
  untouched.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:322-341` — `renderBox(item)` renders the box with
  `stroke: "#1e88e5"` (`:328`), `strokeWidth: 2`, `fill: "rgba(0,0,0,0.001)"` (`:329`); a
  non-finite / `≤0` geometry guard short-circuits at `:324-325`; click-select + `attachBoxTransformer`
  at `:332-340`.
- **Currently:** `extension/content/editor.js:403` — the draw-preview stroke is chosen by
  `var previewStroke = drawing.type === "text" ? "#e53935" : "#1e88e5";` (box branch is the blue
  `#1e88e5`); the preview Rect is built at `:406`.
- **Currently:** `extension/content/editor.js:527` — `var box = btn("Box", "Draw a box (drag)");`
  (plain-text label). The tool key is `"box"`: active-highlight toggle at `:541`
  (`["arrow",arrow],["text",text],["box",box],["select",select]`), click dispatch
  `box.onclick → api.onTool("box")` at `:555`.
- **Dispatch path (untouched by this story):** `render()` dispatches on `item.type === "box"`
  (`editor.js:182`) → `renderBox`; draw commit pushes `{type:"box", …}` at `editor.js:415-420`;
  `finish()` already calls `em.projectAnnotations(model)` (`editor.js:485`) — the projection content
  is STORY-fe-002's concern, not this story's.
- **No-regression assertion:** the model/wire item `type` literal stays **`"box"`** (renaming would
  break `render()` dispatch + round-trip of already-persisted `{type:"box"}` records); the tool key
  `"box"`, the `api.onTool("box")` dispatch, the `>4px` sub-threshold reject (`editor.js:417`), the
  `attachBoxTransformer` move/resize, `strokeWidth`, and the `rgba(0,0,0,0.001)` fill are all
  unchanged. Arrow, text-box, select/move/resize, undo/redo, and the visibility toggle behave
  exactly as before. No change to `editor-model.js` or any test file.
- **Explicitly changing:** three colour/copy literals in `editor.js` — committed-box stroke
  (`:328`), box draw-preview stroke (`:403`), and toolbar label + `title` (`:527`).
- **Verified:** 2026-06-20 — opened `editor.js` and confirmed all cited line numbers.

## How we're doing it

1. `editor.js:328` — change `stroke: "#1e88e5"` to `stroke: "#e53935"` inside `renderBox`. Leave
   `strokeWidth: 2` and `fill: "rgba(0,0,0,0.001)"` exactly as-is.
2. `editor.js:403` — change the box branch of the `previewStroke` ternary so the box preview strokes
   `"#e53935"`. Since both branches then resolve to `"#e53935"`, collapsing to
   `var previewStroke = "#e53935";` is acceptable (the `previewName` ternary on `:402` still needs
   `drawing.type`, so keep that one) — but the minimal, lowest-risk diff is to swap only the box
   literal. Engineer's tactical call; the only requirement is the box draw-preview strokes
   `#e53935`.
3. `editor.js:527` — change `btn("Box", "Draw a box (drag)")` to
   `btn("Rectangle", "Draw a rectangle (drag)")`. Keep it plain text; do NOT touch the `box`
   variable name, the tool key, `setTool`'s `["box", box]` tuple (`:541`), or `box.onclick`'s
   `api.onTool("box")` (`:555`).
4. Do NOT touch `renderBox`'s geometry guard, the draw/commit path, `attachBoxTransformer`, the
   model `type` literal, or any file other than `editor.js`.

**Verification is browser-driven — you cannot drive a browser yourself.** Delegate to the
`browser-tester` teammate via `SendMessage` (load the extension per `$RUNBOOK_PATH`, open the editor
on a capture, exercise Rectangle draw + select + the existing annotations, capture console +
screenshot). Do NOT start a long-lived dev/browser process under a backgrounded Bash call — it will
be killed mid-session. There is no node-test lane for toolbar/Konva-stroke output (DOM/Konva
dependent); the existing `node --test extension/*.test.mjs` suite must remain green (this story
touches no model/projection logic, so it cannot affect it).

## How we validate it was done correctly

- [ ] Toolbar button `textContent` is `"Rectangle"` and `title` is `"Draw a rectangle (drag)"`
  (`editor.js:527`); label is plain text — no emoji / symbol-glyph char / inline `<svg>`.
- [ ] Selecting the Rectangle tool toggles the `snapdeck-active` highlight onto its button (the tool
  key stays `"box"`: `setTool` `:541` + `box.onclick → onTool("box")` `:555` unchanged).
- [ ] `renderBox` strokes `"#e53935"` (was `#1e88e5`) at `editor.js:328`; `strokeWidth` stays `2`;
  fill stays `"rgba(0,0,0,0.001)"`.
- [ ] The live box draw-preview strokes `"#e53935"` (`editor.js:403`/`:406`); the `__textdrawing`
  red preview path is unchanged.
- [ ] The model item `type` literal is still `"box"` (no rename); `render()` dispatch (`:182`) and
  the box draw/commit branch (`:382-385`, `:415-420`) are untouched.
- [ ] No-regression (browser-tester smoke): arrow draw/edit (red), text-box draw/auto-fit/re-edit
  (white fill + red outline), select/move/resize of the rectangle via the shared transformer,
  undo/redo, and the visibility toggle all behave exactly as before; **no console errors**.
- [ ] Only `extension/content/editor.js` is modified.

## Motion contract

n/a — `frontend_lane: N/A`, vanilla-JS Konva content script. No project component-library /
design-system motion-token catalog exists on this surface; the only visible motion is instantaneous
canvas updates (consistent with the released w0/w1 features on this editor). Reduced-motion: n/a (no
animation introduced).

## Unit tests

- No node `--test` coverage is added: the toolbar label and the Konva stroke colour are DOM/Konva
  render-dependent and not exercisable in the pure-model `node --test` lane. Verification is via the
  `browser-tester` smoke (above) and the PO-authored E2E "Draw red rectangle" / "No-regression"
  specs.
- `extension/editor.model.test.mjs` — the existing suite (`node --test extension/*.test.mjs`,
  currently 121/121) **must stay green**; this story changes no model/projection logic, so it cannot
  affect those tests. (The projection-test flip is STORY-fe-002's responsibility.)

## Dependencies

none — standalone restyle/relabel on the released w0 editor surface; consumes no unreleased
contract. (The feature-level `depends_on: [w0-editor-foundation, w1-text-box-autofit]` already
records the released lineage; there is no in-feature producer this story waits on.)

## History

- 2026-06-20 — created by frontend-architect (effort=1, depends on none)
