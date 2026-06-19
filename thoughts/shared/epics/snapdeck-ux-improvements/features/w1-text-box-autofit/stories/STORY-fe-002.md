---
type: story
id: STORY-fe-002
name: "Auto-fit wrap render + white/red/black visual + render guard"
domain: frontend
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 3
status: needs-work
depends_on: [STORY-fe-001]
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
  - "extension/content/editor.js:170-189 — renderBox(): the box-render-from-model + non-finite/≤0 geometry guard pattern to mirror (white-fill/red-outline instead of blue, plus the Text child + auto-fit)"
  - "extension/content/editor.js:147-167 — current renderText(): the Konva.Text + click→select (:156) + dblclick→editText (:157) handler wiring to PRESERVE through the rewrite"
  - "extension/content/editor.js:113-115 — RENDER_ITEM_CAP / RENDER_TEXT_CAP / isFiniteNum(): the render-boundary guard helpers (fe-004) to reuse and extend into the auto-fit path"
defects: []
---

# Story: Auto-fit wrap render + white/red/black visual + render guard

## What we're doing

Rewrite `renderText` so a `text` model item renders as a **Google-Slides-style auto-fit box**:
**black text on a white fill inside a red outline**, the text **wrapped to the box width** and the
**font auto-sized to fit the box height, capped at a configured maximum**. This replaces today's red
bold point-text render. The story adds a deterministic, bounded **auto-fit measurement helper** and
**extends the w0 render-boundary guard** into the auto-fit path so hostile/oversized text items skip
or stay bounded without throwing or hanging. It builds on STORY-fe-001's box-geometry text item
(`{x,y,width,height,text}`) and preserves the existing single-click→select / double-click→edit
handlers. **Select/move/resize via the shared transformer + re-fit on resize is STORY-fe-003.**

## What it should look like

- **Visual treatment (replaces `editor.js:147-167`):** a box-shaped text annotation —
  - **Background:** `Konva.Rect` at `{x,y,width,height}` — **white fill** (`#ffffff`) and **red
    outline** (`stroke:"#e53935"`, the feature/arrow red; `strokeWidth` ~2). Interior is hittable
    (the fill makes the body click-selectable, like renderBox's near-transparent fill but here a real
    white fill).
  - **Text:** `Konva.Text` — **black fill** (`#111111`/`#000`), `width = innerW` (the **clamped**
    inset — see below; never the raw `item.width - 2*PAD`), `wrap:"word"` so Konva wraps glyphs to the
    box width (no horizontal overflow past the outline), `padding`/inset `PAD` (~6px) from the outline,
    `lineHeight` default. `fontStyle` normal (not bold). Pin an explicit **web-safe `fontFamily`** (a
    fixed sans-serif stack, e.g. `"Arial, Helvetica, sans-serif"`) on the node — do **not** inherit
    Konva's default — so the canvas wrap/measurement is as stable as the platform allows across font
    environments (see **Inset clamp + font determinism** below; contrarian Finding 2 / Concern resolution).
  - Compose the Rect + Text in a **`Konva.Group`** at `{x,y}` with `width/height` set and
    **`clip:{x:0,y:0,width,height}`** so that if even the minimum font cannot fit (degenerate tiny
    box), glyphs are clipped to the box rather than spilling past the red outline.
- **Inset clamp + degenerate short-circuit (REQUIRED — Concern resolution, see Revisions):** the draw
  guard (`width>4 && height>4`, STORY-fe-001) admits **thin-but-valid** boxes (e.g. 8×200) whose raw
  inset `item.width - 2*PAD` (`PAD~6`, `2*PAD=12`) is **≤ 0**. A negative `Konva.Text` width is
  unspecified and can degrade to one-glyph-per-line on the length-capped text — the one fit path not
  provably cheap. So **both**: (1) **clamp** `innerW = Math.max(1, item.width - 2*PAD)` and
  `innerH = Math.max(1, item.height - 2*PAD)` so the fit never sees a non-positive inset; **and** (2)
  **short-circuit on the CLAMPED inset** — when `innerW < TEXT_AUTOFIT_MIN || innerH < TEXT_AUTOFIT_MIN`
  (i.e. the inset is below a usable-wrap width — this **supersedes** and subsumes the raw `dim < 2*PAD`
  test), skip the measurement loop entirely and use `TEXT_AUTOFIT_MIN`, relying on the Group `clip` to
  contain the glyphs. Keying the short-circuit on the **clamped inset** (not only the raw dimension)
  closes the residual ~12–18px raw-width band where the raw-dim test passes but `innerW` still floors near
  1px and a space-heavy ≤10 000-char text would wrap to thousands of lines per measurement (security LOW
  PROMOTE — bounded-but-worst-case-slow on a crafted re-opened model). Together these make auto-fit
  **bounded and cheap even on a thin finite box** (closes the "auto-fit must not throw or hang" contract
  that `w2-screenshot-gallery` relies on when re-opening arbitrary stored models). The render-time
  geometry guard (`if (item.width<=0||item.height<=0) return`) does **not** catch `width=8` (it is `>0`),
  so this clamp + clamped-inset short-circuit is the load-bearing protection, not the guard.
- **Auto-fit (new helper `fitTextFontSize(textNode, innerW, innerH, cap, min)`):** return the
  **largest integer font size in `[min, cap]`** such that the text — laid out at `width=innerW` (the
  **clamped** inset), `wrap:"word"` — has **wrapped height ≤ innerH**. Implementation is engineer
  judgment (decrement from `cap`, or binary search) but MUST be **bounded by `(cap - min)` iterations**
  and operate on the already-length-capped text, so it cannot hang. If even `min` overflows `innerH`,
  use `min` (the group `clip` contains the overflow). Module constants: **`TEXT_AUTOFIT_MAX = 48`** (the
  cap) and **`TEXT_AUTOFIT_MIN = 6`** (floor) — defined alongside the existing `RENDER_*` constants
  (`editor.js:113-114`).
- **Font determinism caveat (record explicitly):** recompute-on-render keeps the **model** round-trip
  byte-identical (geometry+text only — STORY-fe-001 §Decision), but the **rendered** wrap/line-count is
  a function of the canvas font metrics. Pinning an explicit `fontFamily` (above) maximizes stability,
  but **cross-font-environment pixel/line identity is NOT guaranteed** — only **model-byte identity** is.
  `w2-screenshot-gallery` re-opens arbitrary models possibly in a different browser/OS/font environment;
  it must rely on the model bytes, not on pixel-identical re-render. (Contrarian Finding 2.)
- **Determinism:** the fit is recomputed on **every** `render()` pass purely from
  `{width, height, text, cap}` + Konva's (frozen) canvas measurement — nothing is stored on the item
  (STORY-fe-001 §Decision). `render()` already `destroyChildren()`s and rebuilds nodes each pass
  (`editor.js:98`), so reload/resize re-fit is automatic: same geometry+text ⇒ same wrapped lines and
  same font, with zero drift.
- **Interaction handlers preserved:** the Group keeps `click/tap → if select-mode set selectedId;
  render()` (`editor.js:156`) and `dblclick/dbltap → editText(item, node)` (`editor.js:157`), and
  **`draggable: tool==="select" && selectedId===item.id`** — the **tight** gate, set here in `renderText`
  **from the start** (not the looser `tool==="select"`). This prevents an unselected box from being
  body-draggable with no `dragend` write-back (the geometry write-back lives only in
  `attachBoxTransformer`, attached when selected); fe-003 owns the contract rationale + the transformer
  attach + verification. Move/resize write-back is wired in fe-003 via the shared transformer. `editText`
  is already box-aware from STORY-fe-001, so double-click re-edit opens the textarea over the box with the
  existing text pre-filled.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:147-167` — `renderText` renders one `Konva.Text` at
  `{item.x,item.y}`, fixed `fontSize:18`, `fontStyle:"bold"`, red `fill:"#e53935"`, `padding:4`,
  `draggable: tool==="select"`; guards non-finite `x`/`y` (`:149`) and caps text to `RENDER_TEXT_CAP`
  (`:150`); wires `click→select` (`:156`), `dblclick→editText` (`:157`), `dragend→write x,y` (`:158`);
  draws a dashed blue **selection rect** from `getClientRect()` when selected (`:160-166`). There is
  **no** box fill/outline, **no** wrap, **no** auto-fit.
- **Currently:** `editor.js:170-189` — `renderBox` is the canonical box-render-with-guard pattern
  (skip non-finite or `≤0` geometry `:172-173`; blue outline; near-transparent hittable fill; click→select;
  transformer attach in the selected block `:185-188`).
- **Currently:** `editor.js:113-115` — `RENDER_ITEM_CAP=500`, `RENDER_TEXT_CAP=10000`, `isFiniteNum()`;
  `editor.js:97-110` — `render()` dispatches `text → renderText` (`:104`) after `destroyChildren()`.
- **Dispatch path / call graph:** `render()` (`:97-110`) → `renderText(item)` → `Konva.Group`(Rect+Text)
  on `annLayer`; fit recomputed each pass via the new helper. On Done, `projectAnnotations` (unchanged)
  still emits `{id,type:"text",x,y,text}` (width/height/fit never projected).
- **No-regression assertion:** the **lossy projection** stays byte-frozen (`projectAnnotations` is NOT
  touched — width/height/fit are model-only); **arrow** and **box** rendering, **undo/redo**, the
  **RENDER_ITEM_CAP/RENDER_TEXT_CAP** bounds, and the **single-click-selects / double-click-edits**
  interaction model are all unchanged. `editText` create/commit/empty-removal (fe-001) is unchanged.
- **Explicitly changing:** `renderText`'s node structure + styling (white fill/red outline/black text),
  add wrap + the bounded auto-fit helper, extend the geometry/text guard into the auto-fit path,
  replace the dashed point-text selection rect with the box body (transformer handles arrive in fe-003).
- **Verified:** 2026-06-19

## How we're doing it

- Single browser file: `extension/content/editor.js`. Rewrite `renderText` (`:147-167`) to the
  Group(Rect+Text) structure above; **mirror `renderBox`'s guard** (`:172-173`) at the top:
  `if (!isFiniteNum(item.x)||!isFiniteNum(item.y)||!isFiniteNum(item.width)||!isFiniteNum(item.height)) return;`
  and `if (item.width<=0 || item.height<=0) return;`. This makes wrong-type/non-finite geometry
  (`NaN`/`Infinity`/`"200"`/`null`-from-JSON) skip cleanly — the hostile-item E2E expects the bad text
  item to be skipped while the well-formed one renders.
- Keep `safeText = (typeof item.text==="string"?item.text:" ").slice(0,RENDER_TEXT_CAP) || " "`
  (`:150`) BEFORE measuring, so auto-fit never measures a multi-megabyte string.
- Add `fitTextFontSize(...)` near the `RENDER_*` constants; add `TEXT_AUTOFIT_MAX`/`TEXT_AUTOFIT_MIN`.
  The loop runs only after the geometry guard passes, so `innerW/innerH` are finite `>0` and the loop
  is bounded → **auto-fit cannot throw or hang** on hostile geometry/text.
- **Reuse, do not duplicate:** the auto-fit helper is the only new abstraction; everything else mirrors
  `renderBox`. Keep the render output a pure function of the item (no stored fit) so fe-003's
  resize→`render()` re-fits for free.
- **Do NOT** touch `editor-model.js` (no projection/serialize change — `projectAnnotations` already
  ignores width/height; do **not** add per-item validation to the pure module), `background.js`, or
  `manifest.json`.
- **Color/sizing:** the visual spec is fully prescribed by the epic (white fill / red `#e53935` outline
  / black text); no project design-token layer applies on this Konva surface (`frontend_lane: N/A`).
  No emoji/symbol-icon glyph, no inline `<svg>`.
- **Dev server / verification:** confirm the extension is loaded in a **user-owned** Chrome, then
  delegate the smoke to `bt` (the wrap/auto-fit/color assertions read live Konva nodes via in-page
  evaluation). Do **not** background-spawn a long-lived browser.

## How we validate it was done correctly

- [ ] A text box renders with **white fill, red `#e53935` outline, and black text** (no bold red
      point-text remains).
- [ ] Typing text longer than one line **wraps to ≥2 lines within the box width** (text node width ≈
      box inner width; no glyphs overflow past the red outline).
- [ ] The effective font size is **≤ `TEXT_AUTOFIT_MAX`** and the wrapped text **fits the box height**
      (no vertical overflow past the outline for non-degenerate boxes); a very small box clamps at
      `TEXT_AUTOFIT_MIN` and **clips** to the box rather than spilling.
- [ ] Auto-fit is **deterministic**: the same `{width,height,text}` yields the same line count + font
      on re-render (drives fe-003 resize re-fit and the round-trip identity).
- [ ] **Render-boundary robustness (extends w0 fe-004 into auto-fit):** hydrating a `version:1` model
      whose text item has non-finite/wrong-type geometry (`x:NaN`, `width:"200"`, `height:Infinity`) or
      multi-megabyte text renders **without throwing or emitting a console error** — the bad item is
      skipped, text is bounded by `RENDER_TEXT_CAP`, the fit loop is bounded (no hang), and a sibling
      well-formed text box renders normally. `deserializeModel` stays opaque (unchanged).
- [ ] **Thin-box inset clamp (no throw / no hang):** a thin-but-valid text box accepted by the draw
      guard but smaller than the inset (`item.width` or `item.height` in the `(4, 2*PAD)` range, e.g.
      8×200) renders **without throwing, hanging, or emitting a console error** — `innerW`/`innerH` are
      clamped to `≥1` and the degenerate case short-circuits to `TEXT_AUTOFIT_MIN` + Group `clip` rather
      than feeding a non-positive width into the fit loop.
- [ ] **Clamped-inset short-circuit covers the residual band (security LOW PROMOTE):** a text box in the
      `~12–18px` raw-width band (clamped `innerW < TEXT_AUTOFIT_MIN`, e.g. `width:15`) **short-circuits to
      `TEXT_AUTOFIT_MIN` + Group `clip` and does NOT run the measurement loop** — structurally asserted via
      the rendered font being `TEXT_AUTOFIT_MIN` (so the worst-case-slow band on a crafted re-opened model
      is closed, not merely bounded). The short-circuit keys on the clamped inset, not only `dim < 2*PAD`.
- [ ] **Font pinned + round-trip contract is model-byte (not pixel) identity:** the `Konva.Text` carries
      an explicit web-safe `fontFamily` (not Konva's default); the documented round-trip guarantee is
      `deepEquals(model.items)` (model-byte identity), with cross-font-environment pixel/line identity
      explicitly **not** guaranteed (recorded for the `w2-screenshot-gallery` hand-off).
- [ ] Single-click selects (sets `selectedId`) and double-click opens the box-aware editor with the
      existing text pre-filled (interaction model preserved); the lossy projection for the text item is
      still `{id,type:"text",x:round(x),y:round(y),text}`.

## Motion contract

`n/a` — vanilla-JS Konva canvas editor, `frontend_lane: N/A`; no project motion-token catalog applies.
Auto-fit font sizing and wrap re-flow are **instantaneous canvas updates** on render, not branded
animations/transitions, so there is no reduced-motion-affected motion. Consistent with feature.md
`Motion E2E: n/a`.

## Unit tests

> Auto-fit/wrap/visual are **Konva-canvas-measurement-dependent** (Konva wraps via canvas text metrics),
> so they cannot be faithfully reproduced in a pure `node --test` module — they live in the
> **browser-tester Playwright E2E** lane (consistent with w0's renderBox/renderArrow being E2E-tested,
> NOT node-tested). The pure projection/round-trip invariants for the geometry-bearing text item are
> covered by `extension/editor.textbox.test.mjs` (STORY-fe-001) — no change needed here.

**browser-tester E2E lane — `extension/e2e/w1-text-box-autofit.spec.ts` (authored by `bt`):**
- `text wraps to box width and auto-fits under the cap` — drag a ~200px box, type multi-word text →
  rendered text wraps to ≥2 lines within the box width, effective fontSize ≤ `TEXT_AUTOFIT_MAX`, no
  overflow past the outline.
- `text box renders white fill / red outline / black text` — assert the Rect fill `#ffffff`, stroke
  `#e53935`, and the Text fill is black (live Konva node read).
- `hostile/oversized text item hydrates without throwing` — ANNOTATE a `version:1` model with
  `{type:"text", x:NaN, width:"200", height:Infinity, text:<multi-MB>}` plus one well-formed text box →
  `render()` completes, no thrown exception, no console error; the well-formed box renders, the hostile
  item is skipped; text length bounded by `RENDER_TEXT_CAP`.
- `thin sub-2*PAD text box renders without throw/hang/clips` — draw (or ANNOTATE) a finite thin box
  (e.g. `width:8, height:200`, accepted by the `>4` draw guard) with a long string → `render()`
  completes promptly (no hang), no thrown exception, no console error; the box clips to its bounds at
  `TEXT_AUTOFIT_MIN` (the negative-inset path is closed by the clamp + short-circuit). _[Concern 1 — the
  finite small box the `NaN`/`Infinity`/`"200"` hostile-item case does NOT exercise.]_
- `residual-band box short-circuits to MIN (security LOW PROMOTE)` — ANNOTATE a `width:15` box (clamped
  `innerW < TEXT_AUTOFIT_MIN`) with a large space-heavy string → the rendered text font is exactly
  `TEXT_AUTOFIT_MIN` (the measurement loop was skipped via the clamped-inset short-circuit), `render()`
  completes promptly, no console error. _[Closes the ~12–18px worst-case-slow band on a crafted re-opened
  model; structural font-value assertion, not a flaky timing assertion.]_

## Dependencies

- STORY-fe-001 — provides the box-geometry text item `{x,y,width,height,text}` and the box-aware
  `editText` this render path draws and re-edits.

(Builds on the **released** w0-editor-foundation render boundary — `RENDER_ITEM_CAP`/`RENDER_TEXT_CAP`/
`isFiniteNum`/`renderBox` guard — at the feature level. No cross-domain dependency; see feature.md
§No-work domains.)

## History



- 2026-06-19T18:37:34Z — orchestrator — re-validation r1 needs-work: TEXT_FIT_SAMPLE=500 under-samples fit → over-large font / clipped overflow for 500+ char text in non-degenerate boxes (AC#3). Routing remediate r2.
- 2026-06-19T17:24:51Z — orchestrator — validate validated; honesty passed (BOSS-mode implement)
- 2026-06-19 — created by frontend-architect (effort=3, depends on STORY-fe-001)
- 2026-06-19T00:00:00Z — implemented (commit: 3cab947)
- 2026-06-19T20:10:00Z — DEFECT-001 fix applied (commit: 6a03abb) — bounded fit loop: binary search + TEXT_FIT_SAMPLE=500 [superseded by r2]
- 2026-06-19T20:28:00Z — DEFECT-001 r2 fix applied (commit: 37ed252) — drop TEXT_FIT_SAMPLE; min-overflow pre-check + full-text binary search; bt C+D smoke pass

## Engineer Notes

Implemented in the same commit as fe-001 and fe-003 (all three stories modify `extension/content/editor.js`).

**Key implementation details:**
- `renderText` fully rewritten: `Konva.Group({x,y,width,height,clip:{...}})` containing a white-fill
  `Konva.Rect` (stroke `#e53935`, strokeWidth 2) and a black `Konva.Text` (fill `#111111`,
  fontFamily `"Arial, Helvetica, sans-serif"`, wrap:"word", listening:false).
- `TEXT_AUTOFIT_MAX=48`, `TEXT_AUTOFIT_MIN=6`, `TEXT_PAD=6`, `TEXT_FONT_FAMILY` added as module
  constants near `RENDER_ITEM_CAP`/`RENDER_TEXT_CAP`.
- `fitTextFontSize(textNode, innerW, innerH, cap, min)`: linear decrement from cap, bounded by
  (cap-min)=42 iterations. Text measured via `textNode.height()` at each font size.
- **Inset clamp**: `innerW = Math.max(1, item.width - 2*TEXT_PAD)`, same for `innerH`.
- **Clamped-inset short-circuit (security LOW PROMOTE)**: when `innerW < TEXT_AUTOFIT_MIN ||
  innerH < TEXT_AUTOFIT_MIN`, short-circuit directly to `TEXT_AUTOFIT_MIN` — skips the measurement
  loop entirely, relying on Group `clip` to contain overflow. This closes the ~12–18px residual
  worst-case-slow band on crafted re-opened models.
- **DEFECT-001 r2 (commit 37ed252) — accurate bounded auto-fit (drop under-sampling):**
  `TEXT_FIT_SAMPLE=500` (6a03abb fix 2b) was measuring only 500 chars to pick the font size but
  displaying the full `safeText` — for 500–2000-char text in a non-degenerate box, the font was
  sized too large → full text wrapped to more lines than measured → overflowed Group clip → text
  cut off (AC#3 violation). Fixed by dropping the sample entirely. `fitTextFontSize()` now uses a
  two-phase strategy on the FULL `safeText` (already RENDER_TEXT_CAP-capped):
  - **Phase 1 (1 measurement):** check full text at `TEXT_AUTOFIT_MIN`. If it overflows `innerH`,
    return min immediately — pathological large text hits this in 1 measurement.
  - **Phase 2 (≤6 measurements):** binary search over `(min, cap]` for can-fit text.
  Total: 1 or ≤7 measurements; no sampling inaccuracy.
  bt re-smoke (2026-06-19T20:28Z):
  - **Scenario C** (220×220 box, 1500 chars): `fontSize=7`, text fits within box, 0 console errors ✓
    (old r1 would have returned ≈10–12 → clipped; r2 returns 7 → accurate full-text fit)
  - **Scenario D** (200×100 box, 20K chars): `fontSize=6` (Phase 1 short-circuit fired), render
    <2s, 0 console errors ✓. Screenshots: `bt-cd-C-long-text-220x220.png`, `bt-cd-D-large-text-200x100.png`.
- **Tight draggable gate** (`tool === "select" && selectedId === item.id`) set at group creation
  time — per the cross-story reconciliation, fe-002 owns the flag physically; fe-003 owns the rationale
  and transformer attach.
- **Geometry guard** mirrors renderBox: skips non-finite or wrong-type x/y/width/height; skips ≤0 dims.
- `safeText` capped before any measurement (RENDER_TEXT_CAP=10000 chars).
- `fontFamily` pinned for cross-font-environment stability; documented that rendered wrap is
  environment-dependent (only model-byte identity guaranteed).

**Smoke verification:** `dev-server.txt` empty — no dev server running. Canvas-dependent assertions
(auto-fit wrap, visual treatment, hostile-item render guard) deferred to browser-tester E2E gate.
Manual verification deferred — dev server not available at implementation time.

## Contrarian Findings

_Phase 5.5 stress-test (contrarian-architect). Claims verified against released
`extension/content/editor.js` (lines cited inline)._

### Finding 1 — `innerW`/`innerH` go negative for small-but-valid boxes; the fit helper's behavior there is unspecified and untested

**Severity:** concern
**Mechanism:** The draw guard accepts any box with `width>4 && height>4` (`editor.js:254`, mirrored by
STORY-fe-001), so a thin text box (e.g. 8px wide × 200px tall) is fully creatable by normal dragging.
This story then computes `innerW = item.width - 2*PAD` with `PAD~6`, giving `innerW ≤ 0` for **any box
≤ ~12px** in a dimension (8px → `innerW = -4`). The render-time geometry guard you specify
(`if (item.width<=0) return`) does **not** catch `width=8` (it is `>0`), so the negative inset flows
straight into `fitTextFontSize(...)`, which sets `Konva.Text.width(innerW)` to a negative value and tests
"wrapped height ≤ innerH (also negative)". Konva's wrap behavior at a negative width is **unspecified** —
it can degrade to one glyph per line, which on the length-capped-but-still-10 000-char `safeText` means
measuring up to ~10 000 lines, up to `(cap-min)=42` times, per item, up to `RENDER_ITEM_CAP=500` items.
That is the one path in the fit loop I could not prove stays cheap. The feature's load-bearing
robustness contract — "auto-fit does not throw or hang on hostile geometry/text," which **w2-screenshot-gallery
relies on when it re-opens arbitrary stored models through this exact path** — is exercised by the
hostile-item E2E using `NaN`/`Infinity`/`"200"`, none of which resemble a plain finite `width:8`. So the
test suite as specified would **not** catch this. I am not asserting it definitively hangs (I could not
run Konva here; lock-it-down rule), but the behavior is unverified and the inputs are reachable.
**Recommendation:** revise — clamp the inset to a positive floor in the fit helper
(`innerW = Math.max(1, item.width - 2*PAD)`, same for `innerH`), or short-circuit to `TEXT_AUTOFIT_MIN`
(and rely on the group `clip`) when `item.width < 2*PAD || item.height < 2*PAD`. Add one browser-tester
E2E case: a sub-`2*PAD` text box renders without throw/hang/console-error and clips. (Availability-adjacent;
if the negative-width wrap can hang, **security-architect Phase 7** may wish to confirm against the DoS-robustness contract.)

### Finding 2 — Recompute-on-render keeps the *model* round-trip identical but makes the *rendered* wrap/font font-environment-dependent

**Severity:** info
**Mechanism:** The "no stored `fontSize`" decision is correct for `deepEquals(model.items)` — geometry +
text are all that persist, so `model → persist → load → model` is identity regardless of environment.
But the acceptance criteria and stories *also* claim the reloaded box "reconstructs the same line count +
font on reload." That second claim only holds where Konva's canvas text measurement returns the same
metrics — i.e. the **same font is available and rendered identically**. This story does not pin a
`fontFamily` on the `Konva.Text`, so it inherits Konva's default. **w2-screenshot-gallery re-opens
arbitrary stored models** (scope) and could do so in a different browser/OS/font environment, where the
default sans-serif metrics differ → a different wrap → a different line count/effective font, even though
the model bytes are byte-identical. The round-trip *test* (deepEquals on model items) stays green; the
*visual* reconstruction is the silent variable. **Recommendation:** mitigate cheaply — set an explicit
web-safe `fontFamily` (e.g. a fixed `sans-serif` stack) on the text node so measurement is as stable as
the platform allows, and record in the story that pixel-identical re-render across font environments is
**not** guaranteed (only model-byte identity is). Prevents a future consumer from assuming cross-machine
visual identity the design does not provide.

## Revisions

### 2026-06-19 — product-owner arbitration (Phase 6)

**Finding 1 (concern — negative fit-inset on thin boxes): RESOLVED by revision.** This was the
highest-risk contrarian finding and a real availability gap, not a nitpick: the `>4` draw guard
(fe-001) admits a finite thin box (e.g. 8×200) whose raw inset `width − 2*PAD` is ≤ 0, and the
render-time geometry guard (`width<=0`) does not catch a positive `width:8`, so a non-positive width
reaches the fit loop — the one path the contrarian could not prove stays cheap. The feature's
load-bearing "auto-fit must not throw or hang" contract is depended on by `w2-screenshot-gallery`
(re-opens arbitrary stored models through this exact path), and the existing hostile-item E2E
(`NaN`/`Infinity`/`"200"`) does NOT exercise a finite small width. **Decision: REVISE (not accept).**
Required **both** the inset clamp (`innerW/innerH = Math.max(1, dim − 2*PAD)`) **and** the degenerate
short-circuit (`dim < 2*PAD` ⇒ `TEXT_AUTOFIT_MIN` + Group `clip`, skip the loop) — clamp closes the
*unspecified*-behavior risk, short-circuit closes the *expensive*-measurement risk; together they
guarantee bounded+cheap on any finite thin box. Added a dedicated browser-tester E2E case
(`thin sub-2*PAD text box renders without throw/hang/clips`) so the gap is no longer invisible to the
suite. Fix lives entirely in this story's new fit helper (scope-clean — no change to `editor-model.js`,
the draw threshold, or released code). Draw threshold deliberately **kept at `>4`** (per fe-001 Finding
2): raising it to `2*PAD` would silently reject legitimately small boxes — the clamp is the right home.

**Finding 2 (info — font-environment-dependent rendered wrap): FOLDED IN (mitigate).** Recompute-on-render
keeps the *model* round-trip byte-identical (the right call), but the *rendered* line-count depends on
canvas font metrics, and `w2-screenshot-gallery` may re-open models in a different font environment.
**Decision: pin an explicit web-safe `fontFamily`** on the `Konva.Text` (was inheriting Konva's default)
to maximize measurement stability, and **record explicitly** that the round-trip guarantee is
**model-byte identity** (`deepEquals(model.items)`), NOT cross-environment pixel/line identity. Added a
validate item; the w2 hand-off contract now states this in writing so a future consumer cannot assume
cross-machine visual identity the design does not provide.

**Cross-story reconciliation (draggable gate set tight HERE from the start).** The `draggable` flag
physically lives in this story's `renderText` node creation, but fe-003 owns the data-loss concern
(Concern 2) that requires the **tight** gate `tool==="select" && selectedId===item.id`. To avoid an
unsafe intermediate (fe-002 shipping the loose flag, then fe-003 re-tightening it) and a one-line
story-body contradiction, I set the **tight gate in fe-002 from the start** (the "Interaction handlers
preserved" bullet now reads the tight gate with a forward-ref); fe-003 retains ownership of the contract
rationale + the transformer attach + verification. (Surfaced by frontend-architect on confirm; the
divergence from the contrarian's "shared-path" wording is unchanged — released `renderBox` stays loose,
preserving fe-001's no-regression AC.)

Status promoted pending → approved. No cross-domain conflict (be/db/do sentinels verified correct);
both revisions are within this FE story's owned code. FE-architect confirmed both revisions implementable
as written (clamp+short-circuit is the load-bearing fix; pinned `fontFamily` is a render constant, not
stored on the model item, so round-trip stays model-byte identity).

## Security Review

_Phase 7 STRIDE pass (security-architect). This story carries the feature's only material threat surface
— the auto-fit fit loop running on hostile/oversized geometry+text via the **re-open-arbitrary-stored-
model** path that `w2-screenshot-gallery` will exercise. Claims grounded against released
`extension/content/editor.js` (lines cited inline)._

### Finding 1 — Auto-fit "no throw / no hang" DoS contract is MET; a narrow residual worst-case-slow band remains on re-opened crafted models

**Severity:** low (defense-in-depth)
**Threat (STRIDE — Denial of service, resource exhaustion):** The contrarian's concern that drove this
story's revision (negative `Konva.Text` width on a finite thin box → **unspecified** Konva wrap behavior,
unprovable cost) is closed: the required clamp `innerW/innerH = Math.max(1, dim − 2*PAD)` guarantees a
**positive (specified) wrap width**, the degenerate short-circuit (`dim < 2*PAD` ⇒ `TEXT_AUTOFIT_MIN`,
skip the loop) removes the cheapest-to-abuse case, and the loop is bounded by `(cap−min)=42` iterations
over `safeText` capped at `RENDER_TEXT_CAP=10000` (`editor.js:114,150`), across at most
`RENDER_ITEM_CAP=500` items (`editor.js:113,100`). So auto-fit **terminates** — the "does not throw or
hang" contract `w2-screenshot-gallery` relies on **holds**. **Residual (the reason this is recorded, not
just dismissed):** the short-circuit fires on the **raw** dimension (`item.width < 2*PAD`, i.e. `< 12`),
but the **clamped** `innerW` still lands at its `1` floor for a box width in the narrow band
`[2*PAD, ~2*PAD+a few px]` (≈ 12–18px) — there the loop **does** run, measuring a space-heavy ≤10 000-char
`text` wrapped at a 1–6px width (Konva `wrap:"word"` breaks at every space → up to a few-thousand wrapped
lines per measurement, ×42, ×≤500 items). That is **bounded but worst-case-slow** (a sub-second to
low-seconds main-thread stall), and it is only reachable via a **crafted/corrupted** model — the `model`
arrives from the extension's **own IndexedDB** per-screenshot record (isolated-world, **not** page-
writable, **not** network; grounded at `editor.js:86`, `manifest.json:39-44` no-`world` + no
`externally_connectable`). So this is a **defense-in-depth resilience** property against the extension's
own corruption / a future bug / devtools-planted data — **not an externally-reachable DoS**.
**Recommendation (optional, cheap, NON-BLOCKING):** extend the degenerate short-circuit to key on the
**clamped inset** rather than only the raw dimension — i.e. when `Math.max(1, item.width − 2*PAD)` (or the
`innerH` equivalent) hits the `1` floor, route to `TEXT_AUTOFIT_MIN` + the Group `clip` and skip the
measurement loop, exactly as the existing `dim < 2*PAD` branch does. One comparison change in the fit
helper, no new abstraction, no change to `editor-model.js`/the draw threshold/released code. The existing
clamp + caps already satisfy the contract; this only removes the residual slow band. **Forward-flag to
`w2-screenshot-gallery`:** that feature is the one that actually re-opens arbitrary stored models through
this render boundary — its STRIDE pass should confirm re-open of a maliciously-crafted/corrupted model is
bounded, with the inherited `RENDER_TEXT_CAP`/`RENDER_ITEM_CAP` + this clamp/short-circuit as the
load-bearing protection (this feature establishes that path; it does not yet expose it to a re-open UI).

### Finding 2 — `renderText` rewrite renders via `Konva.Text` (canvas), not an HTML sink — no DOM-XSS

**Severity:** info
**Threat (STRIDE — Information disclosure / Tampering, rendering sink):** The rewritten `renderText`
composes a `Konva.Group(Rect+Text)` on `annLayer` (canvas), with `safeText` length-capped before
measuring (`editor.js:150`). No `innerHTML`/raw-HTML path exists; the white-fill/red-outline/black-text
styling and the pinned `fontFamily` are Konva node attributes, not interpolated markup or a `style`
string. A hostile `text` field is rendered as literal canvas glyphs.
**Recommendation:** none (record-only). Keep the render on `Konva.Text` and the geometry guard mirroring
`renderBox` (`editor.js:171-173`); the explicit `fontFamily` constant is a render-only value (not stored
on the model item), so it does not affect the model-byte round-trip or add an injection surface.

**PO disposition (Finding 1 — LOW, residual worst-case-slow band):** PROMOTE_TO_AC — fold the
clamped-inset short-circuit tweak into fe-002 now, do NOT defer. Rationale: the fix is a single
comparison inside fe-002's *already-existing* short-circuit (extend it to fire when the **clamped**
`innerW`/`innerH` hits its `1` floor, not only when the raw `dim < 2*PAD`), so it is free and lives
exactly where the code is — while a known dependent, **w2-screenshot-gallery**, drives *arbitrary stored
models* through this exact fit boundary, so the residual ~12–18px slow band is on a path that consumer
weaponizes. Deferring is strictly worse: w2 doesn't own the fit helper, so it would have to cross-edit
released fe-002 or file a defect back. (Same precedent as w0-editor-foundation fe-004: promote when the
guard is free + in-scope + a dependent exercises the path.) The contract was already MET; this trims the
worst-case latency. **The w2 forward-flag still stands** — w2's STRIDE must re-confirm bounded re-open
with the inherited `RENDER_TEXT_CAP`/`RENDER_ITEM_CAP` + this clamp/short-circuit as the protection.
Wiring: AC checkbox + extended thin-box E2E added below; render-guard test stays in the browser-tester
lane (Konva-dependent), not `node --test`.

**PO disposition (Finding 2 — no DOM-XSS):** ACCEPT_AS_RECOMMENDATION — confirmed; `renderText` composes
a `Konva.Group(Rect+Text)` on canvas with length-capped `safeText`, no HTML sink, and the pinned
`fontFamily` is a render-only constant (not stored → model-byte round-trip unaffected). **Standing
guardrail:** keep `renderText` on `Konva.Text` + the `renderBox`-mirrored geometry guard; never route box
text/labels through a raw-HTML or `style`-string path. Non-gating.

## Validation

- 2026-06-19T17:24:51Z — result: **validated** (honesty: passed)
- frontend-validator: all 9 ACs met — Konva.Group white/red/black, bounded auto-fit (recompute-on-render), inset clamp + clamped-inset short-circuit closing the 12-18px slow band [security PROMOTE], render guard, pinned fontFamily, tight draggable gate. projectAnnotations untouched.
