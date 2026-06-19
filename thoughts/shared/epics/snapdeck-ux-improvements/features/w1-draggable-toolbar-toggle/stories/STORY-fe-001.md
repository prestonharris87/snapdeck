---
type: story
id: STORY-fe-001
name: "Pure editor-chrome module: clamp + pos serialize + visibility-state + node tests"
domain: frontend
parent_feature: w1-draggable-toolbar-toggle
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
greenfield: true
created_at: 2026-06-19T15:40:00Z
last_run_id: run-20260619-042600-10898
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: Pure editor-chrome module (`editor-chrome.js`) + node tests

## What we're doing

Author a NEW, side-effect-free, dual-consumable pure module
`extension/content/editor-chrome.js` that holds all the node-testable logic for
this feature: toolbar-position viewport-clamp math, toolbar-position
serialize/deserialize/guard helpers (for the `chrome.storage.local` round-trip),
and the annotation-visibility-state helpers. The module exposes NO chrome /
window / document / Konva references and runs NO top-level side effects, so it
is importable under `node --test`. It mirrors the released
`extension/content/editor-model.js` UMD pattern exactly (sets
`globalThis.__snapdeckEditorChrome` in-browser, `module.exports` under node).
This story ALSO ships the one feature-distinct test file
`extension/editor.chrome.test.mjs`. The two editor.js consumer stories
(fe-002 drag/persistence, fe-003 visibility toggle) consume this module at
runtime via `window.__snapdeckEditorChrome`.

## What it should look like

A new file `extension/content/editor-chrome.js`, structured identically to the
released `editor-model.js` UMD wrapper (`editor-model.js:14-21`). Exported API:

```
// --- toolbar position ---
clampToViewport(pos, dims) -> { left, top }
//   pos  = { left:Number, top:Number }            (desired toolbar top-left, fixed-viewport px)
//   dims = { vw, vh, tw, th }                      (viewport w/h, toolbar w/h)
//   Returns { left, top } clamped so the toolbar rect stays fully on-screen:
//     left in [0, max(0, vw - tw)], top in [0, max(0, vh - th)].
//   If the toolbar is wider/taller than the viewport, clamp the offending axis to 0.
//   Non-finite inputs on an axis fall back to 0 for that axis (never NaN out).

serializeToolbarPos(pos) -> { left, top } | null
//   Validates pos has finite numeric left/top; returns a plain {left, top}
//   object suitable for chrome.storage.local.set, or null when invalid.

parseStoredPos(raw) -> { left, top } | null
//   Guards a value read back from chrome.storage.local; returns {left, top}
//   when raw is an object with finite numeric left/top, else null (never throws).

// --- annotation visibility ---
nextVisibility(shown) -> Boolean          // pure toggle: !shown
layerVisibility(shown) -> { annVisible:Boolean, selectVisible:Boolean }
//   Derives the desired layer-visible booleans from one "annotations shown"
//   flag. Contract: selectVisible tracks annVisible (selection chrome is hidden
//   whenever annotations are hidden). When shown===false → both false.
```

The return shape and field names above are the contract fe-002/fe-003 consume —
do not rename.

## How we're doing it

- Copy the UMD wrapper boilerplate from `editor-model.js:14-21` verbatim (the
  `(function (root, factory) { ... })(...)` shape). Swap the browser global to
  `root.__snapdeckEditorChrome` and keep `module.exports = api` for node.
- Implement the five pure functions above. No `chrome.*`, no `window`, no
  `document`, no `Konva` — the module must `import` cleanly under node (that's
  the whole reason it lives outside `editor.js`, which runs
  `chrome.runtime.onMessage.addListener` at load and therefore cannot be
  imported by the test runner — see `editor-model.js:1-12` header note).
- `clampToViewport`: `Math.max(0, Math.min(left, Math.max(0, vw - tw)))` per
  axis; guard non-finite inputs to 0 before clamping.
- `parseStoredPos` / `serializeToolbarPos`: use a small finite-number check
  (`typeof v === "number" && isFinite(v)`), mirroring `editor.js:115`
  `isFiniteNum`. Return `null` on any invalid input — never throw.
- This story does NOT register the file in `manifest.json` — that is
  STORY-do-001 (devops). This story does NOT modify `editor.js` — that is
  fe-002/fe-003. Keep the file pure and standalone.
- **Icons / labels:** n/a — this module has no DOM/UI surface.

## How we validate it was done correctly

- [ ] `extension/content/editor-chrome.js` exists and contains NO references to
      `chrome`, `window`, `document`, or `Konva`, and no top-level side effects
      (importable under node).
- [ ] The UMD wrapper sets `globalThis.__snapdeckEditorChrome` when no
      `module.exports` is present and `module.exports` under node — same shape as
      `editor-model.js:14-21`.
- [ ] `clampToViewport` returns in-bounds positions unchanged and clamps
      off-screen positions back into the viewport on both axes (and clamps to 0
      when the toolbar exceeds the viewport on an axis).
- [ ] `serializeToolbarPos` / `parseStoredPos` round-trip a valid `{left, top}`
      and return `null` (no throw) for null / garbage / non-finite input.
- [ ] `nextVisibility` flips the boolean; `layerVisibility(false)` returns
      `{annVisible:false, selectVisible:false}` and `layerVisibility(true)`
      returns both `true` (selectVisible tracks annVisible).
- [ ] `node --test extension/editor.chrome.test.mjs` passes; the cumulative
      `node --test extension/*.test.mjs` run still passes (no filename collision
      with the existing `editor.model.test.mjs` / `background.*.test.mjs`).
- [ ] **Manifest load-order guard** (added at arbitration — see Revisions): the test
      file reads `extension/manifest.json` and asserts the `document_idle`
      content-script `js` array contains `content/editor-chrome.js` with
      `index(editor-model) < index(editor-chrome) < index(editor)`, and that every
      registered `js` path resolves to an existing file under `extension/`. Pure `fs`
      read **inside the test file only** — the `editor-chrome.js` module under test
      stays chrome/window/document/Konva-free.

## Motion contract

`n/a` — pure data-transform module, no UI surface, no animation.

## Unit tests

Ship one feature-distinct file `extension/editor.chrome.test.mjs` (mirror the
import + structure of `editor.model.test.mjs:17-21` — `node:test` +
`node:assert/strict`, ESM importing the CJS UMD module as the default export).
Filename is feature-distinct so the dir-level `node --test extension/*.test.mjs`
run does not collide with siblings.

- `extension/editor.chrome.test.mjs` — `clampToViewport returns in-bounds position unchanged` — a position fully inside the viewport is returned as-is.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps off-right / off-bottom back into view` — `left > vw-tw` clamps to `vw-tw`; `top > vh-th` clamps to `vh-th`.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps negative left/top to 0` — negative coords pull back to 0.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps to 0 when toolbar exceeds viewport on an axis` — `tw > vw` ⇒ left 0; `th > vh` ⇒ top 0.
- `extension/editor.chrome.test.mjs` — `clampToViewport coerces non-finite input to 0 per axis (never NaN)` — `{left: NaN}` ⇒ left 0, other axis preserved.
- `extension/editor.chrome.test.mjs` — `serializeToolbarPos round-trips valid pos, returns null on garbage` — `{left:10,top:20}` ⇒ `{left:10,top:20}`; `null`/`{}`/`{left:"x"}` ⇒ `null`, no throw.
- `extension/editor.chrome.test.mjs` — `parseStoredPos guards stored values` — valid object ⇒ `{left,top}`; null / non-object / non-finite ⇒ `null`, never throws.
- `extension/editor.chrome.test.mjs` — `nextVisibility flips boolean` — `true→false`, `false→true`.
- `extension/editor.chrome.test.mjs` — `layerVisibility derives both flags (selectVisible tracks annVisible)` — `true` ⇒ both true; `false` ⇒ both false.
- `extension/editor.chrome.test.mjs` — `manifest registers editor-chrome.js in correct load order` — reads `extension/manifest.json` via `fs`, finds the `document_idle` content-script entry, asserts its `js` array contains `content/editor-chrome.js` with `index(editor-model) < index(editor-chrome) < index(editor)`, and asserts every `js` path resolves to a file on disk under `extension/`. No network, no browser — pure file I/O in the test file (the module under test stays chrome/window-free). _[added at arbitration; owns the load-order regression net flagged by contrarian do-001 Finding 1 / fe-001 Finding 1.]_

## Dependencies

none — net-new standalone pure module (greenfield). It is the producer that
STORY-do-001 (manifest registration) and fe-002/fe-003 (runtime consumers)
depend on; it depends on nothing itself.

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on none; greenfield pure module + node test file)

## Contrarian Findings

### Finding 1 — This file owns the test suite that STORY-do-001's manifest-order guard wants to live in

**Severity:** concern (cross-ref STORY-do-001 Finding 1)
**Mechanism:** STORY-do-001 commits to a `node --test` assertion that
`index(editor-model) < index(editor-chrome) < index(editor)` in the manifest, and
states it "contributes the manifest-shape assertions" to **this story's**
`extension/editor.chrome.test.mjs`. But this story's `## Unit tests` enumerates nine
cases (clamp / serialize / parse / visibility) with **no manifest-order case**, and
do-001's `files_modified` does not declare the test file — so the load-order
regression guard (on a seam do-001 itself calls "load-bearing, not cosmetic") is
owned by neither story as written. See STORY-do-001 → Contrarian Findings → Finding
1 for the full mechanism and failure modes.
**Recommendation:** the cleanest resolution at arbitration is to add the
manifest-order + path-exists assertions to **this story's** test list (FE owns the
file), and have do-001 reference rather than "contribute to" it. Decide explicitly;
do not leave it implicit.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**CONCERN resolved — manifest load-order regression guard assigned to this story (FE
owns the test file).** Per team-lead arbitration direction and the contrarian
recommendation (do-001 Finding 1 / fe-001 Finding 1): the
`index(editor-model) < index(editor-chrome) < index(editor)` + path-exists assertion
is **owned here** because FE authors and owns `extension/editor.chrome.test.mjs`.
Added: (1) a `## How we validate` checklist item, and (2) a `## Unit tests` case
(`manifest registers editor-chrome.js in correct load order`). The assertion is a
pure `fs` read of `extension/manifest.json` **inside the test file** — it does NOT
add `chrome`/`window`/`document`/`Konva` to the `editor-chrome.js` module, which
stays side-effect-free and node-importable (the story's core constraint is intact).
STORY-do-001 now **references** this guard (it runs `node --test extension/*.test.mjs`
as a validate step) rather than "contributing to" a file it doesn't own/declare —
closing the no-owner gap without an undeclared cross-domain edit by the
devops-engineer. Status `pending → approved`.
