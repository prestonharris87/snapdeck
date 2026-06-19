---
type: story
id: STORY-fe-001
name: "Box annotation primitive — model item, render, draw tool"
domain: frontend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
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
  - extension/content/capture.js
  - extension/lib/konva.min.js
  - extension/manifest.json
reuse_patterns:
  - "extension/content/editor.js:83-109 — renderArrow(): canonical render-from-model-item pattern to mirror for renderBox()"
  - "extension/content/editor.js:155-178 — arrow drag-out draw (mousedown/mousemove/mouseup): the drag-to-create pattern to mirror for box, adding top-left normalization"
  - "extension/content/editor.js:250-280 — buildToolbar() + setTool active-toggle: the toolbar button pattern to extend for the Box tool"
defects: []
---

# Story: Box annotation primitive — model item, render, draw tool

## What we're doing

Introduce a **box-shaped annotation primitive** into the editor's internal `model`: a new item
`{ id, type: "box", x, y, width, height }` (top-left origin, stage/CSS px in the `meta.viewport`
coordinate space), drawn by dragging a marquee with a new **Box** tool, rendered as a `Konva.Rect`.
This is the concrete box subtype the foundation ships to *exercise* the select/resize/round-trip
machinery (the subtype-decision rationale is in **Decision** below). This story delivers only the
primitive (model item + render + draw-to-create + tool button). Select/resize/move via the shared
transformer is **STORY-fe-002**; lossless persistence is **STORY-fe-003**; hydration is
**STORY-fe-004**. No change to arrows, point-anchored text, the lossy projection, or persistence here.

## Decision — generic `box` subtype (not migrating `text`)

The scope's open design decision (`scope.md` §"Contract surfaces", item 3) asks which concrete box the
foundation ships. **We ship a minimal generic `type: "box"`**, not a migration of the existing
point-anchored `text` item. Rationale (least rework for w1/w2, lowest regression risk):

- **Keeps the frozen projection truly frozen.** A generic box is **model-only** — it is never added to
  the lossy `annotations` projection (handled in STORY-fe-003), so the byte-frozen arrow/text projection
  and the `/report/save` payload are untouched. Migrating `text` to a box would force a careful
  box→`{x,y,text}` re-projection and risk drifting the frozen text bytes.
- **Zero regression to existing `text`.** The point-anchored `text` item (click-to-place, dbl-click
  edit, line 111-128/179-187) stays exactly as today. Text auto-fit/wrap/styling and the text→box
  conversion are explicitly **w1-text-box-autofit's** job (scope "Out of scope"); we do not pre-empt it.
- **Direct seed for w2.** The generic box's `{x,y,width,height}` geometry is exactly what
  **w2-rectangle-tool** promotes into the user-facing red-outline rectangle — w2's rework is restyle +
  downstream projection, not a geometry rebuild. **w1-text-box-autofit** adds its own `text-box` subtype
  on the same `{x,y,width,height}` base + the STORY-fe-002 transformer. Both reuse, neither reworks.

## What it should look like

- **Model item:** `{ id: uid(), type: "box", x, y, width, height }`. `x,y` = top-left; `width,height` ≥ 0
  (normalized regardless of drag direction). Plain JSON-serializable data, like the existing arrow/text
  items (`editor.js:63`).
- **Render (`renderBox(item)`):** a `Konva.Rect` at `item.{x,y,width,height}` with a **thin neutral
  stroke** (e.g. a 2px neutral/blue outline — NOT the red `#e53935` used by arrows/text, and NOT w2's
  red rectangle styling, which is deferred) and an **interior-hittable fill** so the box can be clicked
  in select mode (a near-transparent fill such as `rgba(0,0,0,0.001)` or an explicit low-opacity fill —
  the box must register interior hits; a Rect with no fill is not interior-clickable). Final box styling
  is owned downstream (w1/w2); ship functional-minimal chrome only.
- **Draw interaction (Box tool active):** drag-out marquee mirroring the arrow draw (`editor.js:155-178`)
  — `mousedown` sets the origin, `mousemove` updates a live preview rect, `mouseup` commits. On commit,
  **normalize to top-left origin**: `x = min(x0,x1)`, `y = min(y0,y1)`, `width = abs(x1-x0)`,
  `height = abs(y1-y0)`. Reject sub-threshold drags (mirror the arrow's `Math.hypot(dx,dy) > 8` guard at
  `editor.js:176`; e.g. require `width > 4 && height > 4`) so a stray click never creates a zero-size box.
  On commit: `model.push(item); snapshot();` then `render()`.
- **Toolbar:** a new **Box** tool button added in `buildToolbar()` (`editor.js:250-280`), wired through
  `api.onTool("box")`, registered in the `setTool` active-toggle array (`editor.js:264-268`), placed
  after the Text button. **Plain-text label `"Box"`** with `title="Draw a box (drag)"`.
- **render() dispatch:** `editor.js:74-81` gains `else if (item.type === "box") renderBox(item);`.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:63` — `model` holds only `{id,type:'arrow',x1,y1,x2,y2}`
  and `{id,type:'text',x,y,text}` items; there is no box type.
- **Currently:** `editor.js:74-81` — `render()` dispatches `arrow`→`renderArrow`, `text`→`renderText`
  only.
- **Currently:** `editor.js:155-178` — arrow drag-to-create (mousedown/mousemove/mouseup, sub-threshold
  reject at `:176`); `editor.js:179-187` — text click-to-place; there is no box draw path.
- **Currently:** `editor.js:250-280` — `buildToolbar()` builds Arrow/Text/Select/Undo/Redo/Done/Cancel;
  `setTool` toggles the `snapdeck-active` class over `[["arrow",…],["text",…],["select",…]]` (`:264-268`).
- **Dispatch path / call graph:** draw interaction → `model.push(item)` → `snapshot()` (`:67`) →
  `render()` (`:74-81`) → Konva nodes on `annLayer`.
- **No-regression assertion:** arrow draw/move/endpoint-edit (`:83-109`,`:155-178`), text click-place &
  edit (`:111-128`,`:179-187`), Select-mode behavior for arrow/text, undo/redo (`:67-69`), and the lossy
  projection (`:220-223`) MUST be unchanged. The Box tool and box type are strictly additive.
- **Explicitly changing:** add the `box` model item, `renderBox()`, the box drag-to-create interaction,
  the render() dispatch arm, and the Box toolbar button.
- **Verified:** 2026-06-19

## How we're doing it

- All changes are in `extension/content/editor.js` (vanilla-JS Konva content script; `frontend_lane: N/A`,
  no project component library on this surface).
- Add `renderBox(item)` next to `renderArrow`/`renderText` (`editor.js:83-128`); mirror `renderArrow`'s
  structure. Do **not** make the box draggable or click-selectable here — select/move/resize is
  STORY-fe-002. (`draggable` stays default-false for now.)
- Add a `tool === "box"` branch to the `mousedown`/`mousemove`/`mouseup` handlers (`editor.js:156-178`),
  mirroring the arrow branch, with the top-left normalization + sub-threshold reject described above. Use
  a uniquely-named preview node (cf. the arrow's `name: "__drawing"` at `:170`) so the live preview is
  found/cleared correctly.
- Extend `buildToolbar()` and `setTool` for the Box tool (see "What it should look like").
- **Icons/labels:** this extension has **no icon component library** (`frontend_lane: N/A`). Use a
  **plain-text** button label `"Box"`. Do **NOT** add emoji or symbol-icon glyphs — the existing
  toolbar's legacy glyphs (`➤`, `⤢`, `✓`, …) are not a precedent to extend. No inline `<svg>`.
- **Dev server / verification:** you cannot self-drive the browser. Confirm the extension is loaded in a
  user-owned Chrome (the user runs it; do not background-spawn a long-lived browser), then delegate the
  smoke to `bt` (browser-tester) per the protocol in `.claude/onboarding/frontend.md` §"Mandatory
  smoke-test protocol".

## How we validate it was done correctly

- [ ] With the **Box** tool active, dragging a marquee creates exactly one `Konva.Rect` and pushes one
      `{type:"box"}` item to `model` with top-left-normalized `{x,y,width,height}` (all ≥ 0), regardless
      of drag direction (up-left, down-right, etc.).
- [ ] A sub-threshold drag/click with the Box tool creates **no** box (mirrors arrow's `>8` guard).
- [ ] `render()` draws the box; the rect is **interior-clickable** (non-empty hit region) for later
      select-mode use.
- [ ] The Box button shows the active state when selected and clears it when another tool is chosen;
      label is plain text `"Box"` (no emoji/symbol-icon glyph, no inline `<svg>`).
- [ ] Undo immediately after drawing a box removes it (`snapshot()` was committed); Redo restores it.
- [ ] **No regression:** arrow draw, text click-place + edit, arrow/text select & move, and undo/redo all
      behave exactly as before; the lossy projection (`:220-223`) is untouched by this story.

## Motion contract

`n/a` — vanilla-JS Konva canvas editor, `frontend_lane: N/A`; no project motion-token catalog applies on
this surface. The box appears immediately on commit with no enter/exit transition, so there is no
reduced-motion-affected animation. (Consistent with feature.md `Motion E2E: n/a`.)

## Unit tests

> The repo ships **no JS unit-test runner** for the extension content script (no `package.json`,
> Jest/Vitest, or test dir — verified 2026-06-19). Per `.claude/onboarding/testing.md`, behavioral
> verification for this surface is the **browser-tester Playwright E2E harness** (feature.md E2E spec).
> Standing up a JS unit runner is devops infra and is out of scope for this story. The checks below are
> authored by `bt` as Playwright assertions (driving the content script, inspecting `model` via a page
> evaluate / the resolve payload). See `clarifications.md` (auto-resolved: no-unit-runner).

- `extension/e2e/w0-editor-foundation.spec.ts` — `box draw normalizes to top-left geometry` — drawing a
  marquee bottom-right→top-left yields a box whose `{x,y}` is the top-left corner and `width/height` are
  positive.
- `extension/e2e/w0-editor-foundation.spec.ts` — `sub-threshold box draw is rejected` — a near-zero drag
  with the Box tool adds no item to `model`.
- `extension/e2e/w0-editor-foundation.spec.ts` — `undo removes a freshly drawn box` — Undo after a box
  draw empties the box from `model`; Redo restores it.
- `extension/e2e/w0-editor-foundation.spec.ts` — `arrow + text flows unaffected by box tool` — arrow draw
  and text place/edit behave identically with the Box tool present.

## Dependencies

none — pure additive extension of the editor's model/render/draw/toolbar; no API surface consumed.

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified the generic `type:"box"` subtype decision against
  `scope.md` §"Contract surfaces" (the open design decision): a minimal, model-only box is the least-rework
  seed for w1 (text-box subtype on the same `{x,y,width,height}` base) and w2 (rectangle restyle), and
  keeps the lossy projection truly frozen (box is never projected). No story-content change required.
  **Promoted `pending → approved`.**

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on none)
