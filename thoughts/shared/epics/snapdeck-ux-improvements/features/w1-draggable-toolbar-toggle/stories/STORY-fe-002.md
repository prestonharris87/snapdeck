---
type: story
id: STORY-fe-002
name: "Toolbar grab handle — DOM drag + persisted position"
domain: frontend
parent_feature: w1-draggable-toolbar-toggle
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 3
status: pending
depends_on: [STORY-do-001]
greenfield: false
diff_estimate: substantive
created_at: 2026-06-19T15:55:00Z
last_run_id: run-20260619-042600-10898
frontend_lane: N/A
visual_references: []
defects: []
files_modified:
  - extension/content/editor.js
  - extension/content/overlay.css
files_not_modified:
  - extension/content/editor-model.js
  - extension/content/editor-chrome.js
  - extension/manifest.json
  - extension/background.js
reuse_patterns:
  - extension/content/editor.js:333-365 (buildToolbar btn() + api object pattern — extend, don't replace)
  - extension/content/editor.js:24-49 (openEditor scaffold; W/H captured at :28; bar.el appended at :39)
  - extension/content/overlay.css:10-40 (.snapdeck-toolbar + button styling to match)
---

# Story: Toolbar grab handle + DOM drag + persisted position

## What we're doing

Add a **grab handle** to the editor toolbar (`.snapdeck-toolbar`) that lets the
user DOM-drag the whole `position:fixed` toolbar out of the way of the region
they want to annotate. On the first drag, convert the default centering
transform (`translateX(-50%)`) to explicit fixed-viewport `left/top` so the
position is unambiguous. Persist the final position to `chrome.storage.local`
under the dedicated key `snapdeckEditorToolbarPos: {left, top}`, and on each
`openEditor()` re-apply the stored position **clamped to the current viewport**
(using `window.__snapdeckEditorChrome.clampToViewport`, registered by
STORY-do-001) so a later capture restores the last position and a stale
off-screen value can't strand the toolbar. The handle uses DOM-level pointer
handling with pointer-capture + `stopPropagation` so a drag never leaks into the
Konva stage (never starts an annotation, never changes selection).

## What it should look like

- A new grab-handle element as the **first child of the toolbar**, e.g.
  `<div class="snapdeck-grip" aria-label="Drag to move toolbar" title="Drag to move the toolbar">`.
  - The grip is the **only** drag target; the existing buttons keep their click
    behavior.
  - **Affordance is CSS-drawn** (a small grip of dots/bars via a CSS
    `background` such as `repeating-linear-gradient` or `radial-gradient`),
    `cursor: grab` (and `:active { cursor: grabbing }`). **No emoji, no
    symbol-icon character (e.g. no `⋮`/`☰`), no inline `<svg>`** — it is a
    CSS-painted affordance with an `aria-label` for assistive tech (it is an
    interactive control with no text).
- `buildToolbar()` exposes the grip element on its returned `bar` API (e.g.
  `bar.grip`) so `openEditor()` can wire the drag (which needs `bar.el`,
  `chrome.storage`, and the pure clamp helper — all live in `openEditor`'s
  scope).
- Drag behavior:
  - On first `pointerdown` on the grip, if the toolbar is still centered
    (transform not yet converted), read `bar.el.getBoundingClientRect()`, set
    `bar.el.style.left/top` to the current rect's `left/top` (px) and
    `bar.el.style.transform = "none"`. Subsequent moves update `left/top` by the
    pointer delta.
  - `setPointerCapture` on the grip; `stopPropagation()` on the grip's
    pointer events.
  - On `pointerup` (drag end): persist the final clamped position:
    `chrome.storage.local.set({ snapdeckEditorToolbarPos: window.__snapdeckEditorChrome.serializeToolbarPos({left, top}) })`.
- Apply-on-open: in `openEditor()`, after `bar.el` is appended to `root`
  (editor.js:39), `chrome.storage.local.get("snapdeckEditorToolbarPos", cb)` →
  `parseStoredPos(raw)` → if valid, `clampToViewport({left, top}, {vw: W, vh: H,
  tw: bar.el.offsetWidth, th: bar.el.offsetHeight})` and apply
  `bar.el.style.left/top` + `transform:"none"`. (The `storage.get` is async;
  applying in its callback is fine — a brief default-position frame before the
  reposition is acceptable for this dev tool. Engineer's judgment on whether to
  pre-hide-until-positioned; not required by ACs.)

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:38-40` — `var bar = buildToolbar();
  root.appendChild(bar.el);` — toolbar is appended to `root` (`.snapdeck-overlay`)
  with **no drag handle**.
- **Currently:** `extension/content/overlay.css:10-25` — `.snapdeck-toolbar` is
  `position:fixed; top:12px; left:50%; transform:translateX(-50%)` — centered and
  immovable; button styling at `overlay.css:26-40`.
- **Currently:** `extension/content/editor.js:24-31` — `openEditor()` entry;
  captures `W = window.innerWidth, H = window.innerHeight` at `:28`. **No
  `chrome.storage` read/write anywhere in editor.js today** (confirmed with
  backend-architect + database-architect — editor.js has zero `chrome.storage`
  usage at HEAD).
- **Currently:** `extension/content/editor.js:333-365` — `buildToolbar()` builds
  buttons via `btn()` (`:336`) and returns the `bar` API object (`:346-354`,
  fields `el/onTool/onUndo/onRedo/onDone/onCancel/setTool/setUndo`). No grip.
- **Dispatch / call graph:** `ANNOTATE` message (`editor.js:14-18`) → `openEditor`
  (`:24`) → `buildToolbar` (`:333`) → `bar.el` appended (`:39`). Toolbar position
  is governed solely by the CSS rule above.
- **No-regression assertion:** all existing toolbar buttons + their onclick
  wiring (`editor.js:355-362`) behave unchanged; the Konva stage drawing/select
  interactions (`editor.js:217-269`) are untouched; with no stored position the
  toolbar still renders at its default centered position (the CSS default rule is
  unchanged). `editor-model.js`, `manifest.json`, and `background.js` are NOT
  touched by this story.
- **Explicitly changing:** add the grab-handle element + DOM-drag (pointer-capture
  + `stopPropagation`) + first-drag `translateX(-50%)`→explicit `left/top`
  conversion + `chrome.storage.local` persistence (write on drag end; read,
  clamp, apply on open).
- **Verified:** 2026-06-19 (opened editor.js + overlay.css at HEAD 6e42464).

## How we're doing it

- Edit `buildToolbar()` (`editor.js:333`): create the `.snapdeck-grip` element,
  insert it as the first child of `el` (before the Arrow button), and expose it
  on the returned api (`bar.grip = grip`). Give it `aria-label` + `title`.
- Edit `openEditor()` (`editor.js:24`): wire the pointer drag on `bar.grip`
  (pointerdown/move/up with `setPointerCapture` + `stopPropagation`), the
  first-drag transform conversion, the `chrome.storage.local.set` on drag end,
  and the `chrome.storage.local.get` + clamp + apply right after `bar.el` is
  appended (`:39`).
- Consume the pure helpers from `window.__snapdeckEditorChrome` (authored by
  STORY-fe-001, registered before editor.js by STORY-do-001) —
  `clampToViewport`, `serializeToolbarPos`, `parseStoredPos`. Do NOT re-implement
  clamp math inline (it lives in the node-tested pure module).
- Add `.snapdeck-grip` styling to `overlay.css` to match the toolbar
  (`#21232d`/`#3a3d4a` palette, `overlay.css:18-19`): the CSS-drawn grip,
  `cursor: grab`/`grabbing`, sized to the toolbar height (~22px tall like
  `.snapdeck-sep` at `overlay.css:41`).
- Persistence is content-script-side only — `chrome.storage.local` directly in
  editor.js (BE confirmed: no service-worker round-trip; the `storage` permission
  is granted at `manifest.json:6`). Do NOT route position through `background.js`,
  the IndexedDB report store, or the editor `model`.

## How we validate it was done correctly

- [ ] The toolbar has a grab handle (`.snapdeck-grip`) with an accessible label
      (`aria-label`/`title`), painted via CSS — **no emoji / symbol-icon char /
      inline `<svg>`**.
- [ ] Pressing + dragging the handle repositions `.snapdeck-toolbar` (DOM drag);
      on the first drag the computed style shows `transform: none` + explicit
      `left/top` (the `translateX(-50%)` centering is converted).
- [ ] The final position is written to `chrome.storage.local` under
      `snapdeckEditorToolbarPos: {left, top}` (verify via a storage read) — NOT to
      the IndexedDB report store and NOT to the editor `model`.
- [ ] On a later `openEditor()`, the toolbar re-applies the stored position,
      **clamped to the viewport** — a deliberately off-screen stored value
      (`left/top` beyond `W/H`) lands fully on-screen.
- [ ] Dragging the handle never starts an annotation (model item count unchanged)
      and never changes the current selection (pointer-capture + `stopPropagation`).
- [ ] No regression: arrow/text/box/select/undo/redo/done/cancel buttons and the
      Konva draw/select/transform/undo/redo behavior are exactly as before.

## Motion contract

`n/a` — `frontend_lane: N/A`; vanilla-JS Konva editor chrome, no project
component-library motion tokens (consistent with `Motion E2E: n/a` in feature.md).
The toolbar follows the pointer **1:1** during drag with no easing/transition.
**Do NOT add a CSS `transition` to the toolbar's `left/top`** — it would lag the
drag. No enter/exit animation, no stagger. No animation is introduced, so
`prefers-reduced-motion` has nothing to gate (the cursor affordance is the only
motion cue).

## Unit tests

The node-testable logic this story consumes — `clampToViewport`,
`serializeToolbarPos`, `parseStoredPos` — is covered by the **one feature-distinct
test file** shipped in STORY-fe-001 (`extension/editor.chrome.test.mjs`). This
story adds NO new test file. The DOM-drag, first-drag transform conversion, and
apply-on-open clamp are DOM/Konva-render-dependent and are verified via
**browser-tester E2E** (feature.md § "Test: dragging the grab handle…" and
"Test: toolbar position persists and is restored (clamped)…").

## Smoke test (hand off to browser-tester `bt`)

First confirm the extension is loaded and a localhost dev page is available — do
NOT start a long-lived dev server from a backgrounded shell (it will be killed).
Then:

> Open the in-page editor on a captured localhost screenshot and draw one arrow.
> Press the toolbar grab handle and drag the toolbar ~200px down-right, release.
> Tell me: did `.snapdeck-toolbar` move (report its computed `left/top` and
> `transform`)? Is `chrome.storage.local.snapdeckEditorToolbarPos` set? Did the
> arrow/model item count stay at 1 and the selection stay unchanged? Any console
> errors? Then re-open the editor on a fresh capture and tell me whether the
> toolbar restored the stored position (and, given a stored off-screen value,
> whether it clamped back into view). Screenshot the final state at 1440x900.

## Dependencies

- STORY-do-001 — registers `content/editor-chrome.js` in the manifest before
  `editor.js`, so `window.__snapdeckEditorChrome` (the clamp/serialize helpers
  this story consumes at runtime) is live. (Transitively: do-001 → fe-001, the
  module author.)

## Cross-domain contract

Established via peer messaging this run (mirrored to
`thoughts/shared/epics/snapdeck-ux-improvements/conversations/`):

- **devops-architect (STORY-do-001):** registers `content/editor-chrome.js` in
  `manifest.json` `content_scripts[1].js` ordered `editor-model.js →
  editor-chrome.js → editor.js`. This story consumes `window.__snapdeckEditorChrome`
  at runtime; the global only exists once do-001's registration loads the file
  before editor.js. `do-001 depends_on fe-001` (the file must exist to register).
- **backend-architect (STORY-be-001, sentinel):** confirmed toolbar-position
  persistence is content-script-side `chrome.storage.local` written/read directly
  in editor.js — no `background.js` message type, no SW mediation; the `ANNOTATE`
  resolve payload (`background.js:213-228`) is NOT touched.
- **database-architect (STORY-db-001, sentinel):** confirmed position lives in
  `chrome.storage.local` (key `snapdeckEditorToolbarPos`), NOT the IndexedDB
  `report` store and NOT the frozen `model` envelope.

## History

- 2026-06-19 — created by frontend-architect (effort=3, depends on STORY-do-001; consumes window.__snapdeckEditorChrome)
