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
status: in-progress
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
- [ ] **Corrupt-value fallback (security — PROMOTE_TO_AC, §Security Review Finding 1):**
      the apply-on-open path routes the stored value through `parseStoredPos` →
      `clampToViewport`; a corrupt / non-finite / absent value (`parseStoredPos`
      returns `null`) falls back to the CSS default-centered position with **no throw
      and no partial apply** — never write a partially-parsed object to
      `style.left/top`.
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

## Contrarian Findings

> Phase 5.5 stress-test (contrarian-architect). The first-drag
> `translateX(-50%)→left/top` conversion and the viewport clamp were independently
> verified and found correct — see note. One `info`-level observation follows.

### Finding 1 — Async apply-on-open paints centered → jumps to stored position (acknowledged; also an E2E-flake seam)

**Severity:** info
**Mechanism:** `openEditor()` appends `bar.el` synchronously (verified
`editor.js:38-40`), so the toolbar **paints at its CSS default centered position**
first; the stored position is only applied later, inside the **async**
`chrome.storage.local.get` callback. On every editor open with a saved non-center
position the dev sees a one-frame center→stored "jump." The story acknowledges this
("a brief default-position frame … is acceptable for this dev tool"), so it is not a
defect. Two things worth surfacing for conscious sign-off: (a) the jump is *every*
open, not a one-time cost — if it reads as jarring, the `pre-hide-until-positioned`
mitigation the story mentions (start `bar.el` hidden, reveal in the get-callback) is
the cheap fix; (b) the dependent E2E ("toolbar position persists and is restored
(clamped)") **must await the async apply** before asserting computed `left/top` —
asserting on the synchronous post-append frame would read the default-center value
and flake. That sequencing is the browser-tester's to own, but it originates in this
story's async design.
**Recommendation:** acknowledge the per-open flicker as accepted; flag the
await-the-storage-read requirement to the browser-tester so the persistence E2E
isn't timing-flaky. No story change required.

> **Verified sound (no finding) — transform conversion + clamp.** First-drag
> conversion reads `bar.el.getBoundingClientRect()` and writes that `left/top` with
> `transform:"none"`; for a `position:fixed` element the rect is already in
> viewport coordinates, so the element does **not** jump on grab — correct. Clamp on
> open uses `W/H` captured at `editor.js:28` + live `offsetWidth/offsetHeight`
> (valid post-append) and routes through the node-tested
> `clampToViewport` — a stored off-screen value lands on-screen per AC. Pointer
> isolation is structurally guaranteed regardless of `stopPropagation`: the toolbar
> is a **DOM sibling** of `.snapdeck-stage` (verified `editor.js:33-40`), so grip
> pointer events bubble to `root`/`document`, never *across* into the Konva stage
> container. The `stopPropagation`/pointer-capture is harmless belt-and-suspenders,
> not the load-bearing isolation. Confirmed correct.

## Security Review

### Finding 1 — Stored-position apply path must route through the fe-001 guards (the live trust boundary)

**Severity:** low (defense-in-depth)
**Threat (STRIDE: Tampering).** This is the consumer that reads
`snapdeckEditorToolbarPos` from `chrome.storage.local` and applies it to
`bar.el.style.left/top` + writes the position back on drag end. It is the *live*
side of the trust boundary whose guards are specified in fe-001 (the full
disposition lives there — see STORY-fe-001 § Security Review Finding 1, rated LOW
because the store is extension-owned and lives in the **isolated content-script
world**, not page-reachable).
**Assessment — story already specifies the safe path; confirming it:**
- Read/apply path is correct: the story routes `raw → parseStoredPos(raw) →
  clampToViewport(...) → bar.el.style.left/top` (lines 78-84) and explicitly says
  "Do NOT re-implement clamp math inline." Keep it exactly that way — the node-tested
  guards are only protective if they're on the live path. ✓
- Write path is correct: drag-end persists via
  `serializeToolbarPos({left, top})`, which returns `null` on non-finite input, so a
  garbage value can't be written. Numeric-only round-trip is preserved end to end. ✓
- **Style-sink is type-safe:** `editor.js` has no `innerHTML` sink (verified, HEAD);
  the only style writes are numeric `.style.X = <n> + "px"` (e.g. `editor.js:197-198`).
  Since the applied `left/top` are guaranteed finite numbers by the fe-001 guards,
  the `bar.el.style.left = left + "px"` write cannot carry an injected CSS string.
  No XSS / CSS-injection vector. ✓
**Recommendation:** no change. Disposition: **accept.** Implementation guardrail for
the engineer: if `parseStoredPos` returns `null` (corrupt/absent value), fall back to
the CSS default-centered position and do **not** apply any `left/top` — never apply a
partially-parsed object.

### Finding 2 — Drag-end persistence write is bounded; no DoS / unbounded-growth concern

**Severity:** info (FYI, no action)
**Threat (STRIDE: DoS).** `chrome.storage.local.set` fires on `pointerup` (drag
end), driven 1:1 by user pointer gestures — there is no programmatic loop and no
async capture stacking (unlike the MV3 fire-and-forget listener pattern in the
lessons file). It writes a **single fixed key** that is overwritten in place, so
there is no per-key accumulation / unbounded-growth concern (contrast the
per-`prefix:<id>` IndexedDB re-keying lesson — N/A here). Pointer-capture +
`stopPropagation` keep the drag off the Konva stage (and, per the contrarian's
verified note, the toolbar is a DOM sibling of the stage so isolation is structural
regardless). No re-entrancy, no rate-limit need.
**Recommendation:** none — recorded as FYI that the DoS axis was considered and is N/A.

**PO disposition:** PROMOTE_TO_AC — Finding 1 (LOW) is the **consumer/live side of the same trust boundary** promoted on fe-001 §SR Finding 1. The story already routes `raw → parseStoredPos → clampToViewport` (never re-implementing clamp math inline) and writes back via `serializeToolbarPos`; I made the live-path safety enforceable by adding a `## How we validate` item ("Corrupt-value fallback") that pins the security-architect's guardrail — on `parseStoredPos` → `null`, fall back to the CSS default-centered position with no throw and **no partial apply**. The matching feature.md AC + PO E2E (corrupt stored value → safe fallback) prove the guards are on the live apply-on-open path.
**PO disposition:** ACCEPT_AS_RECOMMENDATION — Finding 2 (INFO): the drag-end `chrome.storage.local.set` writes a single fixed key overwritten in place, driven 1:1 by user pointer gestures (no programmatic loop, no async stacking), so the DoS / unbounded-growth axis is genuinely N/A. No action.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**INFO disposition (Finding 1) — async apply-on-open flicker ACCEPTED as-is; E2E
await requirement wired.** The per-open one-frame center→stored "jump" is accepted
for this developer tool exactly as the story states (no story change; the
`pre-hide-until-positioned` mitigation stays the engineer's optional judgment call,
not an AC). The *second* half of the finding — the dependent persistence E2E must
**await the async `chrome.storage.local` read settling** before asserting computed
`left/top`, or it flakes on the synchronous default-center frame — is now wired into
**feature.md § "Test: toolbar position persists and is restored (clamped)"** as an
explicit implementation note to the browser-tester. No change to this story.

**INFO note (cross-cutting) — `buildToolbar()` is the real cross-feature
serialization seam with `w1-text-box-autofit`, not `finish()`.** Both features add
toolbar buttons + extend the `bar` API object inside the **same `buildToolbar()`
body** (`editor.js:333-365`); the new `bar` fields do **not** name-collide
(`grip`/`onToggleVisibility`/`setVisibility` vs. the text-box additions). This is a
textual-region overlap resolved by **BOSS's implement serialization** — surfaced to
the team-lead for BOSS so the second-to-merge engineer deliberately rebases on the
first's `buildToolbar()` additions. No story change; flagged at STORIES_LOCKED.

Status `pending → approved`.
