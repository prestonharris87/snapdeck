---
type: story
id: STORY-fe-003
name: "Annotation visibility toggle — non-destructive layer flip"
domain: frontend
parent_feature: w1-draggable-toolbar-toggle
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: pending
depends_on: [STORY-do-001, STORY-fe-002]
greenfield: false
diff_estimate: substantive
created_at: 2026-06-19T15:55:00Z
last_run_id: run-20260619-042600-10898
frontend_lane: N/A
visual_references: []
defects: []
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/content/overlay.css
  - extension/content/editor-model.js
  - extension/content/editor-chrome.js
  - extension/manifest.json
  - extension/background.js
reuse_patterns:
  - extension/content/editor.js:336-364 (btn() + onclick wiring + bar api callbacks — add toggle the same way)
  - extension/content/editor.js:46-53 (annLayer/selectLayer/transformer setup — the layers the toggle flips)
  - extension/content/editor.js:97-110 (render(); note it never touches layer.visible())
---

# Story: Annotation visibility toggle (non-destructive layer flip)

## What we're doing

Add a **visibility toggle** button to the editor toolbar that hides/shows the
annotation layer so the user can inspect the raw captured screenshot underneath.
Hiding flips `annLayer.visible(false)` **and** hides the selection chrome
(`selectLayer.visible(false)`, where the shared `Konva.Transformer` lives) so no
resize handles float over the hidden layer; showing restores both. The toggle is
a **pure view-state flip**: it never mutates `model`, never destroys/recreates
nodes, and never calls `snapshot()` (no undo/redo step). Toggle state is **not
persisted** — every `openEditor()` starts with annotations shown. It is wired
through a new `bar.onToggleVisibility` callback and consumes the pure
`window.__snapdeckEditorChrome` visibility helpers (`nextVisibility`,
`layerVisibility`) registered by STORY-do-001.

## What it should look like

- A new toolbar button via the existing `btn()` pattern (`editor.js:336`), placed
  as a view control (suggest after the Select button with a `snapdeck-sep`
  separator, before the Undo/Redo group — engineer's judgment).
  - **Plain-text label that flips: `"Hide"` when annotations are shown, `"Show"`
    when hidden** (mirrors the released Box button's "plain-text label …
    (no emoji/inline SVG)" precedent at `editor.js:339`). `title` = "Hide the
    annotation layer" / "Show the annotation layer". **No emoji, no symbol-icon
    char, no inline `<svg>`.** Button text gives it its accessible name.
  - When hidden, give the button the existing `.snapdeck-active` pressed look
    (`overlay.css:38`) — reuse the class; **no new CSS** (that's why overlay.css
    is in `files_not_modified`).
- New `bar` API surface (extend the object at `editor.js:346-354`):
  - `onToggleVisibility: null` (callback, set in `openEditor`).
  - `setVisibility: function (shown) { … }` — updates the button label/title +
    toggles `.snapdeck-active` (mirrors `setTool`/`setUndo` at `:348-353`).
- Toggle handler (wired in `openEditor`, alongside `bar.onTool` etc. at
  `editor.js:283-287`): maintain a local `var annShown = true;` view-state flag
  (NOT in `model`, NOT in `past`/`future`). On click:
  `annShown = __snapdeckEditorChrome.nextVisibility(annShown)` →
  `var v = __snapdeckEditorChrome.layerVisibility(annShown)` →
  `annLayer.visible(v.annVisible); selectLayer.visible(v.selectVisible);
  annLayer.batchDraw(); selectLayer.batchDraw(); bar.setVisibility(annShown);`
  — **no `snapshot()`, no `model` mutation, no `render()`**.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:45-49` — `bgLayer/annLayer/
  selectLayer/cursorLayer` created and added to the stage; `annLayer` and
  `selectLayer` are **visible by default**.
- **Currently:** `extension/content/editor.js:52-53` — the shared
  `Konva.Transformer` is added to `selectLayer` (NOT `annLayer`), so hiding only
  `annLayer` would leave resize handles floating.
- **Currently:** `extension/content/editor.js:97-110` — `render()` does
  `annLayer.destroyChildren()` + rebuild, `transformer.nodes([])` when nothing is
  selected (`:107`), `annLayer.draw()` (`:108`), `selectLayer.batchDraw()`
  (`:109`). **`render()` never touches `layer.visible()`** — so a hidden state
  persists across re-renders (composes cleanly with draw/undo/redo).
- **Currently:** `extension/content/editor.js:90` — `snapshot()` is the only
  undo-push path; `:91-92` undo/redo.
- **Currently:** `extension/content/editor.js:290-321` — `finish()`; the
  non-cancel branch sets `selectedId = null; render();` (`:300`) then
  `stage.toDataURL({pixelRatio: dpr})` (`:301`) — **the exported raster reflects
  current layer visibility**, then projects/serializes the model (`:302-305`) and
  resolves (`:308-320`).
- **Currently:** `extension/content/editor.js:333-365` — `buildToolbar()` has **no
  visibility toggle**; the `bar` API (`:346-354`) has no `onToggleVisibility` /
  `setVisibility`.
- **Dispatch / call graph:** toolbar button onclick (`:355-362`) → `bar.onX` (set
  in `openEditor` `:283-287`) → editor fn. `snapshot()` (`:90`) is the sole undo
  push.
- **No-regression assertion:** `annLayer`/`selectLayer` stay visible by default;
  `render()` continues to never mutate `layer.visible()`; the `model`, the lossless
  serialize + lossy projection (`__snapdeckEditorModel` at `:302-305`), and the
  resolve payload (`:308-320`) are byte-unchanged; undo/redo history is unaffected
  by the toggle; existing draw/select/transform behavior is unchanged.
  `editor-model.js`, `manifest.json`, `background.js`, and `overlay.css` are NOT
  touched.
- **Explicitly changing:** add the toggle button + `bar.onToggleVisibility` +
  `bar.setVisibility`; flip `annLayer.visible()`/`selectLayer.visible()` via
  `__snapdeckEditorChrome.layerVisibility`; **restore `annLayer.visible(true)` in
  `finish()` before `toDataURL` (`:301`)** so the exported PNG always includes
  annotations regardless of the current toggle state.
- **Verified:** 2026-06-19 (opened editor.js at HEAD 6e42464).

## How we're doing it

- Edit `buildToolbar()` (`editor.js:333`): add the toggle button via `btn()`,
  add `onToggleVisibility`/`setVisibility` to the api, wire `toggle.onclick`
  (mirroring `:355-362`).
- Edit `openEditor()` (`editor.js:24`): add `var annShown = true;` view-state
  flag; wire `bar.onToggleVisibility` (the flip handler above) near the other
  `bar.onX` assignments (`:283-287`); call `bar.setVisibility(true)` once at init.
- Consume `window.__snapdeckEditorChrome.nextVisibility` / `.layerVisibility`
  (authored by STORY-fe-001, registered by STORY-do-001). Do NOT inline the
  visibility-state logic.
- **Export guard (required):** in `finish()`'s non-cancel branch, before
  `stage.toDataURL` (`editor.js:301`), set `annLayer.visible(true)` (and
  `selectLayer.visible(true)` for symmetry — the transformer is already detached
  by the `selectedId = null; render()` at `:300`). This ensures a user who clicks
  **Done while annotations are hidden** still saves a screenshot WITH annotations.
  This guard ONLY sets `layer.visible(true)` — it does not touch `model`,
  `projectAnnotations`, `serializeModel`, or the resolve payload shape.
- **Do NOT disable drawing tools while hidden** — out of scope. The toggle only
  flips layer visibility; a new annotation drawn while hidden renders into the
  hidden layer and appears on re-show (acceptable, and the export guard keeps Done
  correct). Keep the change to the visibility flip + the toolbar button + the
  finish() export guard.

## How we validate it was done correctly

- [ ] A toggle button (plain-text `Hide`/`Show`, no emoji/symbol-icon/inline
      `<svg>`) is wired through `bar.onToggleVisibility`; it shows the
      `.snapdeck-active` pressed look when annotations are hidden.
- [ ] Clicking it hides the annotation layer (`annLayer.visible() === false`) and
      the raw screenshot (`bgLayer`) is visible with **zero annotations** drawn
      over it.
- [ ] The selection chrome is also hidden — no `Konva.Transformer` resize handles
      float over the hidden layer (`selectLayer.visible() === false`); it is
      restored on show.
- [ ] Clicking again restores **all** annotations unchanged (same `model` items,
      same node geometry — nothing destroyed/recreated).
- [ ] Toggling does NOT add an undo/redo step — `snapshot()` is not called; undo
      history depth is identical before and after a toggle.
- [ ] The toggle state is not persisted — a fresh `openEditor()` starts with
      annotations shown.
- [ ] **Export guard:** with annotations hidden, clicking **Done** still produces
      an annotated PNG that includes the annotations (the layer is restored to
      visible before `toDataURL`); the lossless `model` payload is unchanged either
      way.
- [ ] Clicking the toggle never starts an annotation and never changes the
      current selection; no regression to existing draw/select/transform/undo/redo.

## Motion contract

`n/a` — `frontend_lane: N/A`; vanilla-JS Konva editor chrome, no project
component-library motion tokens (consistent with `Motion E2E: n/a` in feature.md).
Visibility is an **instant** `layer.visible()` flip + `batchDraw` — no fade, no
transition, no stagger. No animation is introduced, so `prefers-reduced-motion`
has nothing to gate. **Do NOT add a CSS/Konva opacity transition** to the layer
flip.

## Unit tests

The node-testable logic this story consumes — `nextVisibility`, `layerVisibility`
— is covered by the **one feature-distinct test file** shipped in STORY-fe-001
(`extension/editor.chrome.test.mjs`). This story adds NO new test file. The Konva
visibility flip, non-destructive restore, no-undo guarantee, and the finish()
export guard are Konva-render-dependent and verified via **browser-tester E2E**
(feature.md § "Test: visibility toggle hides annotations + selection chrome
non-destructively, with no undo impact" and § "Test: pointer isolation…").

## Smoke test (hand off to browser-tester `bt`)

First confirm the extension is loaded and a localhost dev page is available — do
NOT start a long-lived dev server from a backgrounded shell. Then:

> Open the in-page editor on a captured localhost screenshot, draw two
> annotations, and select one (so the transformer handles show). Note the undo
> depth. Click the visibility toggle once. Tell me: is `annLayer.visible()` false,
> are zero annotations + zero transformer handles visible (raw screenshot showing
> through)? Click the toggle again: are all annotations restored unchanged and is
> the undo depth identical to before? Separately: hide annotations, click Done,
> and tell me whether the saved annotated PNG still contains the annotations. Any
> console errors? Screenshot the hidden state and the restored state at 1440x900.

## Dependencies

- STORY-do-001 — registers `content/editor-chrome.js` so
  `window.__snapdeckEditorChrome` (the visibility helpers) is live at runtime.
- STORY-fe-002 — intra-file ordering: both edit `buildToolbar()` + `openEditor()`
  in `editor.js`; implement the grab-handle/drag story first so this story's diff
  builds on the post-fe-002 toolbar (clean, conflict-free, separately reviewable).

## Cross-domain contract

Established via peer messaging this run (mirrored to
`thoughts/shared/epics/snapdeck-ux-improvements/conversations/`):

- **devops-architect (STORY-do-001):** registers `content/editor-chrome.js`
  (ordered before editor.js). This story consumes
  `window.__snapdeckEditorChrome.nextVisibility`/`.layerVisibility` at runtime.
- **backend-architect (STORY-be-001, sentinel):** the visibility toggle is
  non-persisted Konva view state — nothing for BE; the `ANNOTATE` resolve payload
  is untouched.
- **database-architect (STORY-db-001, sentinel):** the toggle persists nothing —
  no IndexedDB / report-store / `model` involvement.

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on STORY-do-001 + STORY-fe-002; consumes window.__snapdeckEditorChrome)

## Contrarian Findings

> Phase 5.5 stress-test (contrarian-architect). The export guard and cancel-path
> were independently verified against RELEASED `editor.js` and found **sound** —
> see note at the end of this block. Two `info`-level observations follow; neither
> blocks arbitration.

### Finding 1 — "Raw screenshot underneath" omits `cursorLayer`: the toggle hides 2 of 4 layers

**Severity:** info
**Mechanism:** The feature's mental model — restated in `feature.md` AC ("the raw
captured screenshot (`bgLayer`) is visible with **zero annotations drawn over it**")
and this story's handler — is "hide `annLayer` + `selectLayer` ⇒ raw capture
underneath." But the editor stacks **four** Konva layers (verified `editor.js:45-49`):
`bgLayer` (screenshot), `annLayer`, `selectLayer`, and **`cursorLayer`**. The toggle
flips only `annLayer`/`selectLayer`. `cursorLayer` carries a synthetic arrow-pointer
polygon drawn **once at open** at the last mouse position (`drawCursor(...)`,
verified `editor.js:48,82`, `listening:false`), and the toggle never hides it — so
when the dev hides annotations "to inspect the raw screenshot," a small static cursor
glyph **remains painted over the capture**. The E2E asserts "zero *annotations*"
(model-item / `annLayer`-children count), which still passes, so this is not an AC
failure — but the shared assumption that hiding the layer yields a pristine raw
capture is slightly false. This is the classic "everyone pictured two layers; there
are four" miss.
**Recommendation:** acknowledge. If pixel-perfect raw inspection is ever a real
need, hide `cursorLayer` alongside `annLayer`/`selectLayer` in the flip (and restore
in the export guard for symmetry). Not required by the current ACs — record as a
known, conscious scope boundary.

### Finding 2 — Draw/undo-while-hidden is a quiet footgun (acknowledged, surfaced for PO visibility)

**Severity:** info
**Mechanism:** This story explicitly keeps drawing tools live while annotations are
hidden ("a new annotation drawn while hidden renders into the hidden layer and
appears on re-show (acceptable)"). Verified that the consequence is real and slightly
larger than the story's one-liner: the stage draw handlers write to `model` and call
`snapshot()` (the sole undo push, `editor.js:90`) regardless of `annLayer.visible()`,
and `render()` never gates on visibility (verified `editor.js:97-110`). So a dev who
hid annotations to inspect the capture and then drags/clicks **creates an invisible
annotation AND a new undo step** — both surfacing unexpectedly on re-show. Logically
consistent (visibility is orthogonal to model/history — the architect reasoned about
this correctly), but a mild surprise for a "view-only inspect" affordance.
**Recommendation:** acknowledge as the conscious team position (the story already
calls disabling-tools-while-hidden out of scope). Surfaced only so PO arbitrates the
footgun knowingly, not as an unflagged assumption. No story change required.

> **Verified sound (no finding) — export guard + cancel path.** The candidate
> "Done-while-hidden ⇒ blank-annotation PNG" risk is correctly mitigated:
> `finish()`'s **cancel branch returns before any rasterize** (verified
> `editor.js:295-298` — no `toDataURL` on cancel/Escape), so the guard is needed on
> the **Done path only**, which is exactly where this story places it (set
> `annLayer.visible(true)` before `stage.toDataURL` at `editor.js:301`). In the
> never-toggled common path the guard is a no-op (layer already visible) ⇒
> non-regressive to released w0 `finish()`. The `annotated` gate at `editor.js:310`
> (`losslessModel.items.length ? annotated : null`) is untouched. Confirmed
> correct.
