---
type: stress-test
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
written_at: 2026-06-19T15:50:00Z
contrarian_run_id: run-20260619-042600-10898
findings_count:
  info: 4
  concern: 1
  block: 0
---

# Phase 5.5 stress-test — Draggable toolbar + annotation visibility toggle

**Verdict: no `block` findings.** This feature was planned tightly — the
conversations log shows substantive cross-domain negotiation (FE↔DevOps load order,
FE↔BE persistence boundary, FE↔DB sentinel), every story carries a verified seam, and
the two genuinely tricky paths (the Done-while-hidden export guard, the
`translateX(-50%)→left/top` conversion) were reasoned about correctly. I
independently re-verified the load-bearing claims against RELEASED `editor.js` /
`editor-model.js` (HEAD 6e42464) and **confirmed** them — see "Claims verified"
below. One `concern` (a missing-owner regression-test gap) and four `info`
observations span the stories; none require a story rewrite, and the one `concern` is
a cheap, explicit assignment at arbitration.

## Top three cross-cutting challenges

1. **Manifest load-order regression guard has no owner** [concern] — STORY-do-001
   declares the `editor-model < editor-chrome < editor` ordering "load-bearing, not
   cosmetic" and promises a `node --test` assertion of it, but places that assertion
   in the FE-owned `editor.chrome.test.mjs` while declaring only `manifest.json` in
   its `files_modified`; STORY-fe-001's test list contains no manifest-order case. So
   the guard is owned by neither story. If dropped, a future content-script reorder
   silently makes `window.__snapdeckEditorChrome` `undefined` and the drag/toggle
   handlers throw at `openEditor()`-time with no test catching it. The feature still
   ships correctly today; the gap is the missing net. **Touches: STORY-do-001
   (Finding 1), STORY-fe-001 (Finding 1, cross-ref).** Cheapest fix: add the
   order/path-exists case to fe-001's test list and have do-001 reference it.

2. **`buildToolbar()` — not `finish()` — is the real cross-feature serialization
   seam with `w1-text-box-autofit`** [info] — `scope.md` frames the two features as
   touching `editor.js` in "distinct regions" (this feature: toolbar chrome +
   `annLayer` visibility; them: annotation-shape). Verification refines that:
   `w1-text-box-autofit` references `editor.js` **only** at `buildToolbar()`
   (`:333-365`, its sole cited reuse pattern) and does **not** touch `finish()` — so
   the export-guard edit fe-003 makes in `finish()` is genuinely conflict-free, but
   **both features add buttons + extend the `bar` API object inside the same
   `buildToolbar()` body**. The serialization seam is the toolbar builder, not the
   export path. New `bar` fields don't name-collide (`grip` / `onToggleVisibility` /
   `setVisibility` vs. the text-box additions), so this is a textual-region overlap
   resolved by BOSS's implement serialization — acknowledged, surfaced so the
   second-to-merge engineer rebases on the first's toolbar additions deliberately.
   **Touches: STORY-fe-002, STORY-fe-003 (and `w1-text-box-autofit`).**

3. **The "raw screenshot underneath" model is 2-of-4 layers, plus live tools while
   hidden** [info] — the toggle's shared mental model ("hide the annotations ⇒ pristine
   raw capture") quietly omits that the editor stacks **four** Konva layers: the
   synthetic `cursorLayer` (a static pointer glyph) is never hidden by the toggle, and
   drawing tools stay live while hidden (an invisible new annotation + undo step can
   accrue and surface on re-show). Both are logically consistent and acknowledged
   out-of-scope in fe-003 — surfaced so PO accepts the scope boundary consciously
   rather than by omission. **Touches: STORY-fe-003 (Findings 1 & 2).**

## Detailed findings (per-story `## Contrarian Findings` blocks)

- **STORY-do-001** — Finding 1 [concern]: manifest load-order regression guard has no
  clear owner / may be silently dropped; assign one owner at arbitration.
- **STORY-fe-001** — Finding 1 [concern, cross-ref do-001]: this file owns the test
  suite the manifest-order guard should live in; cleanest fix is to add the
  order/path-exists case here.
- **STORY-fe-002** — Finding 1 [info]: async apply-on-open paints centered → jumps to
  stored position every open (acknowledged); also flags the await-the-storage-read
  requirement to keep the persistence E2E from flaking. (Transform conversion + clamp
  + pointer isolation verified sound.)
- **STORY-fe-003** — Finding 1 [info]: toggle hides 2 of 4 layers; `cursorLayer`'s
  synthetic cursor remains over the "raw" capture. Finding 2 [info]:
  draw/undo-while-hidden footgun (acknowledged out-of-scope, surfaced for PO).
  (Export guard + cancel-path verified sound and non-regressive to released w0
  `finish()`.)

## Claims verified against RELEASED code (HEAD 6e42464)

- `editor.js:24,28,38-40` — `openEditor()` entry; `W/H` captured at `:28`;
  `bar = buildToolbar()` appended synchronously at `:38-40`. **Confirms** the
  async-apply flicker (fe-002 Finding 1) and that clamp inputs are valid post-append.
- `editor.js:45-49` — four layers `bgLayer / annLayer / selectLayer / cursorLayer`;
  `cursorLayer` `listening:false`. **Confirms** fe-003 Finding 1 (2-of-4 layers).
- `editor.js:48,82` — `cursorLayer` carries a synthetic cursor drawn once at open.
  **Confirms** the cursor persists through the toggle.
- `editor.js:52-53` — shared `Konva.Transformer` lives on `selectLayer`, not
  `annLayer`. **Confirms** the toggle must hide `selectLayer` (fe-003 does).
- `editor.js:90,97-110` — `snapshot()` is the sole undo push; `render()` never touches
  `layer.visible()`. **Confirms** draw-while-hidden accrues an undo step (fe-003
  Finding 2) AND that the visibility flip composes cleanly with draw/undo/redo.
- `editor.js:290-321` — `finish()`: cancel branch returns at `:295-298` **before**
  any `toDataURL`; only the Done path rasterizes at `:301`; `annotated` gate at
  `:310` untouched. **Confirms** fe-003's export guard targets the only export path
  and is non-regressive (dismisses the candidate "Done-while-hidden ⇒ blank PNG"
  risk as correctly mitigated).
- `editor.js:33-40` — `.snapdeck-toolbar` is a DOM **sibling** of `.snapdeck-stage`.
  **Confirms** pointer isolation is structural (events bubble up, not across), so the
  `stopPropagation` claim is harmless-but-redundant, not load-bearing (dismisses the
  candidate pointer-leak risk).
- `editor.js:86` — `__snapdeckEditorModel` consumed **inside** `openEditor()` (call
  time, not module-load). **Confirms** fe-002/fe-003's call-time consumption of
  `__snapdeckEditorChrome` is safe regardless of parse-time ordering (load order
  still correct via do-001).
- `editor-model.js:14-21` — UMD wrapper sets `root.__snapdeckEditorModel` in the
  browser branch / `module.exports` under node, invoked with `globalThis`.
  **Confirms** fe-001's "copy verbatim" plan will correctly register
  `window.__snapdeckEditorChrome`.
- `w1-text-box-autofit/stories/STORY-fe-001.md:33` — references `editor.js` only at
  `buildToolbar()` (`:333-365`); no `finish()` / `toDataURL` / `annLayer.visible`
  reference. **Confirms** the cross-feature seam is `buildToolbar()`, not `finish()`
  (cross-cutting challenge #2).

## Claims accepted unverified (low-stakes)

- BE/DB sentinel claims about `background.js` message switch contents
  (`background.js:165-190`), the IndexedDB `idb()` helpers, and the `ANNOTATE`
  resolve payload (`background.js:213-228`) — accepted without re-opening
  `background.js`. Rationale: both are **sentinel (no-work) stories**; this feature
  is verified content-script-side only (`chrome.storage.local`, no `background.js`
  edit in any FE story's `files_modified`), so the sentinels' premise ("nothing for
  us") does not gate any of my findings. No `block`/`concern` rests on them.
- `overlay.css:10-40` toolbar/button styling line numbers (fe-002 reuse) — accepted;
  cosmetic, informs no finding.

## Security note (for PO → security-architect, Phase 7)

Nothing surfaced that I'd escalate. Persistence is `chrome.storage.local` (a
browser-local key→value store, no new permission — `storage` already granted at
`manifest.json:6`), no wire-contract / `/report/save` change, no `host_permissions`
or `web_accessible_resources` delta (do-001 adds exactly one `js` array element). The
one thing worth security's glance during its own pass: `parseStoredPos` guards a
value read back from `chrome.storage.local` before applying it as toolbar geometry —
fe-001 specs it to coerce non-finite/garbage to a safe clamp and never throw, which
is the right posture for untrusted-storage input. No action requested; noted for
completeness.
