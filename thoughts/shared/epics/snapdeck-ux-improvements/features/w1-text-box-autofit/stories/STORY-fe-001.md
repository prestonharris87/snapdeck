---
type: story
id: STORY-fe-001
name: "Drag-to-draw text-box tool — box-geometry model item + authoring"
domain: frontend
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
created_at: 2026-06-19T15:30:00Z
last_run_id: run-20260619-150554-36418
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
greenfield: false
files_modified:
  - extension/content/editor.js
  - extension/editor.textbox.test.mjs
files_not_modified:
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
  - extension/background.js
  - extension/manifest.json
  - extension/content/overlay.css
  - extension/content/capture.js
  - extension/lib/konva.min.js
reuse_patterns:
  - "extension/content/editor.js:221-260 — box drag-to-create (mousedown/mousemove/mouseup, top-left normalization, >4 sub-threshold reject): the canonical box-shaped draw path to generalize so text (now) and w2 rectangle (later) both flow through it"
  - "extension/content/editor.js:192-213 — editText(item, node): the positioned-textarea authoring + empty-removal-on-commit pattern to make box-aware"
  - "extension/content/editor.js:333-365 — buildToolbar()/setTool: the toolbar button + active-toggle pattern (Text button + title copy live here)"
  - "extension/editor.model.test.mjs:185-189 — 'opaque subtype fields survive round-trip': the existing pure-module test proving width/height ride opaquely (mirror its shape for the new text.test.mjs)"
defects: []
---

# Story: Drag-to-draw text-box tool — box-geometry model item + authoring

## What we're doing

Replace the editor's **click-to-place** text tool with a **drag-to-draw-a-box** text tool, and
extend the `text` model item to carry box geometry. With the **T Text** tool active the dev now
drags out a rectangle to define `{x, y, width, height}` (top-left origin, stage/CSS px in the
`meta.viewport.{w,h,dpr}` space) exactly like the foundation's Box tool, and on release a textarea
opens positioned over that box for authoring. The committed `model` item becomes
`{ id, type:"text", x, y, width, height, text }` — the new `width`/`height` fields ride **opaquely**
through the released w0 serialize/persist/deserialize path. This story delivers the **interaction +
model-item shape + authoring** only. The **auto-fit/wrap render + white-fill/red-outline/black-text
visual treatment + render-boundary guard** is **STORY-fe-002**; **select/move/resize + re-fit on
resize via the shared transformer** is **STORY-fe-003**. No change to arrows, boxes, the lossy
projection, or persistence here.

## What it should look like

- **Model item:** `{ id: uid(), type:"text", x, y, width, height, text }`. `x,y` = box top-left;
  `width,height` ≥ 0 (normalized regardless of drag direction). Plain JSON-serializable, like the
  existing arrow/box/text items. **No fit metadata field is stored** — the fitted font size is
  recomputed deterministically on every render from `{width, height, text, cap}` (STORY-fe-002), so
  the model item carries geometry + text only and the round-trip stays trivially lossless (see
  **Decision** below).
- **Draw interaction (Text tool active):** drag-out marquee mirroring the box draw
  (`editor.js:221-260`) — `mousedown` sets the origin (`_x0/_y0`), `mousemove` updates a live preview
  rect, `mouseup` commits. On commit, **normalize to top-left**: `x=min(x0,x1)`, `y=min(y0,y1)`,
  `width=abs(x1-x0)`, `height=abs(y1-y0)`. **Reject sub-threshold drags** (`width>4 && height>4`,
  mirroring the box guard at `editor.js:254`) so a stray click never creates a zero-area text box.
  On accept: `model.push(item)` then **open the textarea over the new box** (do NOT `snapshot()` yet —
  the snapshot is committed by `editText`'s commit, matching today's create→edit→commit ordering).
- **Authoring (`editText` made box-aware):** when the item carries `{x,y,width,height}`, position AND
  size the `.snapdeck-textedit` textarea to the box (`left:x, top:y, width, height`) instead of the
  node `getClientRect()`/fixed `160×28` fallback (`editor.js:195-198`). The existing commit semantics
  are preserved verbatim: **trim → empty removes the item** (`model.filter(...)`), non-empty sets
  `item.text`, then `snapshot(); render()`. Enter-without-Shift commits, Escape reverts, blur commits.
- **Toolbar:** the **T Text** button keeps its plain-text label; its `title` copy changes from
  `"Add a text comment (click)"` to `"Add a text comment (drag a box)"` (`editor.js:338`). No new
  button, no glyph/emoji, no inline `<svg>`.
- **Generalize for w2 reuse:** factor the box-shaped draw so the `box` and `text` tools share one
  parameterized branch (keyed by the item `type` the tool produces) rather than two copy-pasted
  blocks — so **w2-rectangle-tool** registers a third box-shaped tool without a third rewrite (this
  feature is sequenced ahead of it on the shared shape logic). Keep it a light in-file refactor; do
  **not** extract a new module (see **Decision**).

## Decision — geometry-only item, font recomputed on render (not stored)

`scope.md` §"Auto-fit determinism" leaves "store the fitted font size vs. recompute on render" to the
architect. **We recompute on render and store geometry + text only.** Rationale:

- **Trivially lossless round-trip.** The item is `{id,type:"text",x,y,width,height,text}` — all plain
  JSON, no derived/cached field that could drift between commit and reload. `serializeModel`/
  `deserializeModel` (w0, unchanged) deep-clone it, so `model → persist → load → model` is identity by
  construction (proved at the pure-module level by the node test this story adds).
- **No determinism trap.** A stored `fontSize` would have to be re-derived identically on reload to
  keep `deepEquals`; recompute-on-render removes that obligation — the fit is a pure function of
  `{width,height,text,cap}` + the (frozen) Konva measurement, recomputed every `render()` pass (and
  `render()` already `destroyChildren()`s and rebuilds nodes each pass, so there is no stale node to
  reconcile). STORY-fe-002 owns the fit loop.
- **Auto-fit cannot be a pure node module.** Konva wraps text using canvas text metrics; a node module
  cannot faithfully replicate the wrap, so the fit loop must live **inline in `editor.js`** and is
  verified in the browser-tester E2E lane (consistent with w0's renderBox/renderArrow being E2E-tested,
  not node-tested). This is why this feature adds **no** new browser-loaded module and **no** manifest
  entry — the opposite of the w0 hybrid-ruling seam that forced `editor-model.js` registration.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:261-269` — text is **click-to-place**: a
  `stage.on("click tap")` handler creates `{id,type:"text",x,y,text:""}` at the pointer and opens
  `editText` on the just-pushed node. There is **no** box geometry on text and **no** drag path.
- **Currently:** `editor.js:147-167` — `renderText` renders a single `Konva.Text` at `{x,y}`, fixed
  `fontSize:18`, bold red `#e53935`, with `click→select` (`:156`) and `dblclick→editText` (`:157`)
  handlers; **no** box/wrap/auto-fit.
- **Currently:** `editor.js:192-213` — `editText` positions the textarea from `node.getClientRect()`
  or a fixed `{160×28}` fallback (`:196`); commit trims, **empty removes the item** (`:204`), else sets
  `item.text`, then `snapshot(); render()`.
- **Currently:** `editor.js:221-260` — the `box` tool's drag-to-create (origin `_x0/_y0`, top-left
  normalize on move `:239-240`, `width>4 && height>4` reject on mouseup `:254`) — the pattern to mirror.
- **Dispatch path / call graph:** Text tool → (new) `mousedown/mousemove/mouseup` drag → `model.push`
  → `editText` (textarea) → commit `snapshot()` (`:90`) → `render()` (`:97-110`) → Konva nodes on
  `annLayer`. On Done, `projectAnnotations`/`serializeModel` (`editor-model.js`) emit the lossy + lossless
  payloads (`editor.js:304-305`).
- **No-regression assertion:** arrow draw/move/endpoint-edit (`:117-145`,`:217-260`), the **box** tool
  (`:221-260`,`:170-189`), select-mode deselect (`:225-227`), undo/redo (`:90-92`), and the byte-frozen
  lossy projection (`editor-model.js` `projectAnnotations`, which reads only id/type/x/y/text for text)
  MUST be unchanged. The only behavior change is **how text is created** (drag, not click) and the
  **addition** of `width/height` to the text item.
- **Explicitly changing:** remove the click-to-place text handler; add the text drag-to-create path
  (generalized with the box branch); add `width/height` to the text item; make `editText` box-aware;
  update the Text button `title`. Add the pure node test file.
- **Verified:** 2026-06-19

## How we're doing it

- Single browser file: `extension/content/editor.js` (vanilla-JS Konva content script,
  `frontend_lane: N/A` — no project component library on this surface), plus one new pure node test
  file. Auto-fit/render (fe-002) and select/resize (fe-003) are separate stories on the same file —
  coordinate sequencing with the warm engineer; **BOSS serializes the `editor.js` implement window**
  against `w1-draggable-toolbar-toggle` (orthogonal toolbar/`annLayer`-visibility region).
- **Remove** the `stage.on("click tap")` text-placement handler (`:261-269`). **Add** a `tool==="text"`
  branch to the `mousedown`/`mousemove`/`mouseup` handlers mirroring the `box` branch
  (`:221-260`), producing a `type:"text"` drawing object with a uniquely-named preview node (cf. the
  box's `name:"__boxdrawing"` at `:243`). On `mouseup` accept (`width>4 && height>4`), push the item
  and call `editText(item)` (no node yet — see box-aware editText below). Prefer a **single
  parameterized box-shaped draw branch** keyed by the produced `type` so `box` and `text` share it and
  w2's rectangle slots in cleanly.
- **`editText` box-awareness:** derive the textarea rect from `item.{x,y,width,height}` when present
  (the new text box always has them); fall back to the existing `getClientRect()`/`160×28` path only
  for any legacy `{x,y}`-only text. Set `width`/`height` on the textarea so authoring matches the box.
  Keep commit semantics byte-identical (`:201-212`).
- **Do NOT** rewrite `renderText` here — fe-002 owns the box render + auto-fit. After this story, a
  committed text box renders via the **current** point-style `renderText` (text at `{x,y}`, fixed font)
  until fe-002 lands; that intermediate is functional, not broken.
- **Do NOT** touch `editor-model.js` (no projection/serialize change needed — `width/height` ride
  opaquely), `background.js`, or `manifest.json` (all `files_not_modified`).
- **Icons/labels:** plain-text Text button label unchanged; **no** emoji/symbol-icon glyph, **no**
  inline `<svg>`. The toolbar's pre-existing legacy glyphs are not a precedent to extend (per w0).
- **Dev server / verification:** you cannot self-drive the browser. Confirm the extension is loaded in
  a **user-owned** Chrome (the user runs it; do **not** background-spawn a long-lived browser), then
  delegate the smoke to `bt` per `.claude/onboarding/frontend.md` §"Mandatory smoke-test protocol".

## How we validate it was done correctly

- [ ] With the **T Text** tool active, **dragging** a marquee creates exactly one text item with
      top-left-normalized `{x,y,width,height}` (all ≥ 0) regardless of drag direction; a single
      **click** (sub-threshold drag) with the Text tool creates **no** item.
- [ ] On drag-release the `.snapdeck-textedit` textarea opens **positioned and sized over the drawn
      box** (`left=x, top=y, width, height`), focused for typing.
- [ ] Committing **empty** text (trim → "") removes the item (no orphan empty box); committing
      non-empty sets `item.text` and commits a `snapshot()` (undoable) — matching current `editText`.
- [ ] The committed `model` text item has keys `{id,type,x,y,width,height,text}` (no stored `fontSize`
      / fit field).
- [ ] The **T Text** button title reads `"Add a text comment (drag a box)"`; label is plain text, no
      glyph/emoji, no inline `<svg>`.
- [ ] **No regression:** arrow draw/move/endpoint-edit, the **box** tool draw, select-mode deselect,
      and undo/redo behave exactly as before; the lossy projection for any text item is still
      `{id,type:"text",x:round(x),y:round(y),text}` (width/height never appear — `projectAnnotations`
      unchanged).
- [ ] The box-shaped draw is factored so `box` and `text` share one parameterized branch (a third
      box-shaped tool can be added without a third copy).

## Motion contract

`n/a` — vanilla-JS Konva canvas editor, `frontend_lane: N/A`; no project motion-token catalog applies
on this surface. The text box and its textarea appear immediately on draw/commit with no enter/exit
transition, so there is no reduced-motion-affected animation. Consistent with feature.md
`Motion E2E: n/a` and the released w0 stories.

## Unit tests

> **Lane split (per w0 precedent + onboarding/testing.md):** the editor's *interaction* (drag, textarea,
> empty-removal) is Konva/DOM-dependent → **browser-tester Playwright E2E** lane
> (`extension/e2e/w1-text-box-autofit.spec.ts`, authored by `bt` against the feature.md E2E spec). The
> *pure data invariants* of the new geometry-bearing text item go in a **new zero-dep `node --test`
> file** that imports the **unmodified** `editor-model.js` (no manifest impact; the pure module is NOT
> changed). Filename is feature-prefixed to avoid collision in the shared `node --test extension/*.test.mjs`
> run (the `editor.model.test.mjs` name is owned by w0).

**Pure node lane — new file `extension/editor.textbox.test.mjs` (imports `./content/editor-model.js`):**
- `projection strips width/height from a box-geometry text item` — `projectAnnotations([{id,type:"text",x:50.7,y:60.3,width:200,height:90,text:"hi"}])` deep-equals `[{id,type:"text",x:51,y:60,text:"hi"}]` — `Object.keys(result[0]).sort()` equals `["id","text","type","x","y"]` (no `width`/`height` leak; byte-frozen shape holds for the new field combo).
- `box-geometry text item round-trips identically` — `deserializeModel(serializeModel([{id,type:"text",x:50,y:60,width:200,height:90,text:"hi"}]))` deep-equals the input (lossless model round-trip of the opaque geometry).
- `(reference)` the existing `extension/editor.model.test.mjs:185 — "opaque subtype fields survive round-trip"` already proves arbitrary extra fields (incl. width/height) survive serialize→deserialize; this file adds the **text-item-specific** projection-strip + round-trip assertions.

**browser-tester E2E lane — `extension/e2e/w1-text-box-autofit.spec.ts` (authored by `bt`):**
- `text tool draws a box and opens the editor over it` — drag a marquee, textarea opens at the box rect; the committed item carries `{x,y,width,height,text}` with `width≈` drawn width.
- `sub-threshold text drag creates no item` — a near-zero drag adds nothing to `model`.
- `empty text box is removed on commit` — opening then committing empty removes the item.

## Dependencies

none — builds on the **released** w0-editor-foundation contracts (feature-level `depends_on:
[w0-editor-foundation]`): the box drag pattern, `editText`, and the opaque `serializeModel`/
`deserializeModel`/`projectAnnotations` pure module. No sibling-story or cross-domain dependency
(see the cross-domain confirmation in feature.md §No-work domains).

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on none)

## Contrarian Findings

_Phase 5.5 stress-test (contrarian-architect). Verified against released `extension/content/editor.js`
lines cited inline. The FE auto-fit design was not peer-challenged in this feature's `conversations/`
(all non-FE domains correctly sentineled), so these shared assumptions went unscrutinized._

### Finding 1 — Re-editing a committed box to empty text DELETES the whole box (geometry + all)

**Severity:** info
**Mechanism:** This story makes `editText` box-aware but preserves its commit semantics "verbatim"
(`editor.js:201-212`): `commit()` does `if (!v) { model = model.filter(m => m.id !== item.id) }`.
That removal path is shared between **create** (intended: no orphan empty boxes) and **re-edit**
(double-click, STORY-fe-003). So double-clicking an already-committed text box, clearing its text, and
committing (Enter/blur) **destroys the committed box and its `{x,y,width,height}`** — not just the text.
The re-edit acceptance criterion is framed as "Re-committing preserves the box geometry (only `text`
changes)" (feature.md), which silently does not hold on the empty path. feature.md does consciously
choose "committing an empty text box removes the item," but it frames that against the *create* flow;
the *re-edit→empty→delete-committed-box* interaction is unstated and contradicts Google-Slides parity
(Slides retains an emptied box). It is undoable (a `snapshot()` follows), so blast radius is one undo.
**Recommendation:** acknowledge — confirm in arbitration that re-edit→empty SHOULD delete a committed
box (current plan, consistent with create) vs. retain it (Slides parity). If "delete" is intended,
add a one-line note to the fe-003 re-edit AC so the browser-tester does not file it as a regression.

### Finding 2 — Draw threshold (`>4`) admits boxes thinner than the fit inset; feeds the fe-002 negative-inner edge

**Severity:** info (cross-reference — primary finding is on STORY-fe-002)
**Mechanism:** This story mirrors the box draw's sub-threshold reject `width>4 && height>4`
(`editor.js:254`), so a box as thin as ~5px in either dimension is accepted and pushed to the model.
STORY-fe-002 then computes the text inset `innerW = item.width - 2*PAD` (`PAD~6`), which goes **negative**
for any accepted box ≤ ~12px wide/tall. The draw guard and the fit-inset math were specified in separate
stories and never reconciled, so a normally-drawable thin box lands in an unspecified region of the fit
helper (see STORY-fe-002 Finding 1). **Recommendation:** no change required here if fe-002 clamps the
inset to a positive floor; flagged only so the two thresholds are reconciled consciously rather than by
accident. Do **not** raise the draw threshold to `2*PAD` (that would silently reject legitimately small
boxes) — fix the clamp in the fit helper.

## Revisions

### 2026-06-19 — product-owner arbitration (Phase 6)

**Finding 1 (info — re-edit→empty deletes the whole committed box): ACCEPTED as intended; AC wording
clarified (no code change here).** This story makes `editText` box-aware but preserves its commit
semantics verbatim — the shared empty-removal (`if (!v) model = model.filter(...)`) applies to **both**
the create flow (intended: no orphan empty boxes — already locked in scope) **and** the re-edit flow
(double-click, fe-003). **Decision: keep the unified behavior** — re-edit→empty removes the committed box
(geometry + all), undoable. Rationale: consistency with the locked create-flow empty-removal; a Snapdeck
text box carries only text, so an emptied box has no annotation value (Google-Slides "retain emptied box"
parity rejected — Slides boxes hold formatting/other content; ours don't). The contrarian correctly
caught that the *re-edit* AC framing ("only `text` changes") silently failed on the empty path; that
contradiction is a wording fix, not a behavior change — clarified in feature.md + the fe-003 re-edit AC
to distinguish non-empty (geometry preserved) vs empty (box removed), with an E2E note so the
empty-delete is not filed as a regression. No change to this story's code or its (correct, create-flow)
empty-removal validate item.

**Finding 2 (info — draw threshold `>4` admits boxes thinner than the fit inset): no change here;
reconciled in fe-002.** The draw threshold stays `>4` deliberately — raising it to `2*PAD` would
silently reject legitimately small boxes. The thin-box / negative-inset reconciliation is fixed at the
fit-helper **clamp + short-circuit** in fe-002 (see fe-002 Revisions, Concern 1). Flagged here only so
the two thresholds are reconciled consciously rather than by accident.

Status promoted pending → approved. No cross-domain conflict; this story needs no code revision.
