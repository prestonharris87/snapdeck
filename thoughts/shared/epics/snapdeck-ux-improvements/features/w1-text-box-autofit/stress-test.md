---
type: stress-test
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
written_at: 2026-06-19T00:30:00Z
contrarian_run_id: run-20260619-150554-36418
findings_count:
  info: 4
  concern: 2
  block: 0
---

# Phase 5.5 stress-test — Text-box auto-fit rework (Google-Slides style)

**Verdict: 0 block, 2 concern, 4 info. No finding requires an `## Acknowledged Risk` + PO approval gate
to pass arbitration; both concerns are revise-or-acknowledge, and a clear cheap mitigation exists for
each.** All code claims were verified against the released `extension/content/editor.js` (line citations
inline in each finding), not asserted from memory.

**Calibration note for the PO.** This feature's `conversations/` log shows the DB / BE / DevOps architects
each correctly sentineling and confirming with the FE architect — solid cross-domain hygiene. But it also
means the **FE auto-fit design itself was never peer-challenged**: every substantive decision (recompute-on-render,
the `Konva.Group` + clip, the bounded fit loop, the inset math, the shared transformer reuse) was authored
and ratified inside the FE lane with no adversarial review. That is exactly the "converged too easily"
signal — so the concerns below are not nitpicks against an over-debated design; they are the first
adversarial pass over a single-author design. The design is fundamentally sound (recompute-on-render is the
right call for round-trip identity; the sentinels are correct); the gaps are at the **seams between the
three FE stories**, which no single story owned end-to-end.

## Top three cross-cutting challenges

1. **The inset math has no lower bound, and the test suite won't catch it.** [concern]
   STORY-fe-001's draw guard accepts any box `>4px` per dimension; STORY-fe-002's fit inset is
   `width - 2*PAD` (`PAD~6`), which is **negative for any box ≤ ~12px**. These two thresholds live in
   separate stories and were never reconciled. A thin-but-normal text box (e.g. 8×200) therefore reaches
   `fitTextFontSize` with a negative `Konva.Text` width, whose wrap behavior is unspecified and whose
   worst case (one glyph per line on a ~10 000-char string, ×42 iterations, ×500 items) is the one fit
   path I could not prove stays cheap. The load-bearing "auto-fit does not throw or hang" contract —
   which **w2-screenshot-gallery depends on when it re-opens arbitrary stored models through this path** —
   is tested only with `NaN`/`Infinity`/`"200"`, none of which look like a finite `width:8`, so the gap
   is invisible to the specified E2E. **One-line clamp fixes it.** Touches: STORY-fe-002 (Finding 1,
   primary), STORY-fe-001 (Finding 2, cross-ref).

2. **The shared select/move/resize mechanism enshrines a silent move-loss into a contract three shapes
   will inherit.** [concern] Boxes/text are `draggable` while in select mode even when **unselected**,
   but the `dragend` that writes geometry back to the model is attached only in the *selected* block (via
   `attachBoxTransformer`). So body-dragging an unselected box moves the Konva node, suppresses the click
   (no selection), fires no `dragend`, and reverts on the next `render()` — including the `render()` inside
   `finish()` right before serialize, so the move can vanish from the saved screenshot. This is inherited
   verbatim from released `renderBox`, but STORY-fe-003 explicitly promotes this path to the "one shared
   mechanism" that **w2-rectangle-tool reuses** — so a latent w0 quirk is about to become the ratified
   contract for box + text + rectangle. The team should accept it consciously (Acknowledged Risk) or fix
   it once in the shared path (`draggable: select && selected`). Touches: STORY-fe-003 (Finding 1).

3. **Recompute-on-render moves the determinism risk from the model to the font environment — silently.**
   [info, but cross-cutting] The decision to store geometry+text only (no `fontSize`) makes
   `deepEquals(model.items)` trivially robust — the right call. But the ACs *also* promise "same line count
   + font on reload," which only holds where Konva's canvas measurement sees the same font. No `fontFamily`
   is pinned, and **w2-screenshot-gallery re-opens arbitrary models in arbitrary environments**. The model
   round-trip test stays green while the *visual* reconstruction is the unstated variable. Cheap mitigation:
   pin an explicit web-safe `fontFamily` and record that only model-byte identity (not cross-environment
   pixel identity) is guaranteed. Touches: STORY-fe-002 (Finding 2), and the w2 hand-off contract generally.

## Detailed findings (per-story `## Contrarian Findings` blocks)

- **STORY-fe-001** — *Finding 1 (info):* re-edit→empty deletes the whole committed box (geometry + all), not
  just the text; contradicts the "only `text` changes" re-edit framing; undoable. *Finding 2 (info):* draw
  threshold `>4` admits boxes thinner than the fit inset → feeds fe-002's negative-inner edge; reconcile
  consciously, fix in the fit clamp (not the draw threshold).
- **STORY-fe-002** — *Finding 1 (concern):* `innerW`/`innerH` negative for small-but-valid boxes; fit-helper
  behavior unspecified/untested; specified hostile-item E2E won't catch a finite small box; clamp the inset.
  *Finding 2 (info):* recompute-on-render is font-environment-dependent for the *rendered* result though the
  *model* round-trip stays identity; pin a `fontFamily`, document the limit.
- **STORY-fe-003** — *Finding 1 (concern):* unselected-body-drag silently loses the move (no `dragend`);
  inherited from `renderBox` but this story enshrines it into the w2-reused shared mechanism; accept or fix
  in the shared path. *Finding 2 (info):* the Group-vs-Rect transformer-attach fallback has un-analyzed
  live-drag/hit-test behavior, and non-uniform resize visibly distorts glyphs mid-drag before the on-release
  re-fit (pre-empt a false-positive defect from the browser-tester).

## Verified-and-dismissed (recorded so the PO can trust the pass)

These plausible stress areas dissolved on opening the released code — no finding warranted:

- **Sentinels (db/be/do-001) are correct.** `addScreenshot()` stores `model: resp.model ?? null` verbatim
  (`background.js:225` per the sentinels), `projectAnnotations` is byte-frozen and box-geometry-blind
  (`editor-model.js:54-58`), and `deserializeModel` passes items through opaquely (`editor-model.js:72-81`).
  New `width`/`height`/fit fields genuinely ride opaque; no DB/BE/DevOps work. No finding.
- **Projection x,y semantic shift is benign.** x,y moving from "click point" to "box top-left" is a sub-`PAD`
  shift; the lossy projection already dropped the box (text-only), the downstream report→defects consumer is
  future/unbuilt (scope), and width/height never leave the model. Conscious, accepted design. No finding.
- **fe-001→fe-002 intermediate (point-text render before the box render lands) never ships** — the three FE
  stories are one sequenced implement unit validated together; the flatten-looking intermediate is internal,
  not a released state. No finding.
- **w2-rectangle reuse is genuinely factorable.** Auto-fit is isolated to `renderText`; the shared draw branch
  and `attachBoxTransformer` carry no text-specific coupling, so a `renderRect` + tool registration slots in
  without a second rewrite. The only reuse caveat is that the shared mechanism also inherits cross-cutting
  challenge #2's move-loss. No finding beyond #2.
- **The fit loop is bounded** for non-degenerate boxes — `(cap-min)=42` iterations on length-capped text,
  `RENDER_ITEM_CAP=500` items. Worst-case-slow but finite; the only unbounded-risk path is the negative-inner
  edge (challenge #1), which the clamp closes.
