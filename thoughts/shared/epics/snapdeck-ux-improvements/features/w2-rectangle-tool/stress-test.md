---
type: stress-test
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
written_at: 2026-06-20T00:35:00Z
contrarian_run_id: run-20260620-161821-90174
findings_count:
  info: 2
  concern: 1
  block: 0
---

# Phase 5.5 stress-test — Rectangle (red-outline box) tool

The lead's #1 stated risk — that a test beyond `editor.model.test.mjs:88-101` still asserts the box
is excluded from the projection (or asserts the blue `#1e88e5` stroke) — was **verified clean**
(see Dismissed below). The real residual risk is not a present flaw but a **contract that decays
under change**: the `type:"box"` identifier is now load-bearing across two languages and two
independently-tested surfaces, coupled only by prose. This is a well-negotiated feature (the
`"box"` literal was bidirectionally ratified, db/do correctly sentineled with peer confirmations),
so calibration is 1 concern + 2 info, **0 block**.

## Top three cross-cutting challenges

1. **`type:"box"` literal coupling is test-unenforced across the JS↔Python seam.** [concern] —
   STORY-fe-002 emits `type:"box"` from `projectAnnotations`; STORY-be-001's `_render_markdown`
   cases on `a.get("type") == "box"`. The architects consciously chose `"box"` end-to-end and
   documented "must move in lockstep" on both sides — but each side's unit suite hard-codes its own
   copy of the literal, and no test runs the real emitter output through the real renderer. A future
   single-sided rename leaves both suites green while the rectangle silently falls through the
   controller's raw-dict catch-all `else` (`reports.py:227-228`) into a `- {...}` dump in
   `report.md`. Verified that `_render_markdown` is the *only* annotation-`type`-discriminating
   consumer in the repo, so that `else` is the single silent-decay point. The room is treating
   prose-documentation as the mitigation; the actionable fix is a shared contract fixture both suites
   load, or one true end-to-end test. Touches: STORY-fe-002, STORY-be-001.

2. **Projection-guard asymmetry: `renderBox` guards non-finite/`≤0` geometry, `projectAnnotations`
   does not.** [info] — The feature's own render-guard AC contemplates a malformed box in a hydrated
   model; `renderBox` (`editor.js:324-325`) skips it, but the new box branch in `projectAnnotations`
   `Math.round`s its coordinates unconditionally, so the same malformed box is skipped at render yet
   still projected (as JSON-safe null/coerced garbage) on ✓ Done — a path that did not exist while
   the box was projection-excluded. Reachability low (hostile hydrated model only), impact cosmetic
   (no throw). Same renderBox-guards-X-but-sibling-path-doesn't pattern seen in w1-text-box-autofit.
   Touches: STORY-fe-002.

3. **Client/controller version skew degrades `report.md`.** [info] — The extension and the in-repo
   controller deploy independently; a newer extension emitting `box` to an older controller (no box
   branch) renders the raw-dict dump in `report.md`. Graceful degradation, not a crash —
   `report.json` is opaque and correct regardless — but the human-summary regression is invisible
   until eyeballed. Touches: STORY-be-001.

## Detailed findings

- **STORY-fe-002 `## Contrarian Findings`** — Finding 1 (concern): literal coupling, producer side.
  Finding 2 (info): projection has no finite/positive geometry guard.
- **STORY-be-001 `## Contrarian Findings`** — Finding 1 (concern): literal coupling, consumer side
  (the raw-dict `else` is the silent-decay point). Finding 2 (info): client/controller version skew.
- STORY-fe-001, STORY-db-001, STORY-do-001 — no findings (see Dismissed).

## Verified-clean (dismissed — recorded so the room can trust the pass)

- **No other test asserts box-EXCLUDED from the projection** (lead's #1 risk). The only
  box-exclusion assertions are `editor.model.test.mjs:88-96` and `:98-101`, which STORY-fe-002 owns
  and flips. `background.editormodel.test.mjs:188` and `editor.textbox.test.mjs:117` carry `box`
  fixtures but exercise only verbatim **storage** / serialize-deserialize **round-trip** — neither
  calls `projectAnnotations` (`background.editormodel.test.mjs` feeds `annotations` directly into the
  resolve payload). The round-trip/opaque-subtype/render-precondition tests in
  `editor.model.test.mjs:157-232` use `box` but are untouched by the projection change.
- **No test asserts the blue `#1e88e5` stroke.** `#1e88e5` appears only in `editor.js:328` and
  `:403` (source) — never in a test or `.spec.ts`. STORY-fe-001's restyle has no test coupling.
- **The box projection is purely additive.** `projectAnnotations` is per-item `if/else if`
  (`editor-model.js:45-63`); a `box` branch cannot perturb the arrow `{from,to}` / text `{x,y,text}`
  entries, field order, or `Math.round`. The byte-frozen arrow/text tests stay valid.
- **No JS or Python consumer (beyond `_render_markdown`) discriminates annotation `type`.**
  `background.js` whitelists/stores `annotations` opaquely (proven by
  `background.editormodel.test.mjs` byte-identity tests); the MCP server is a generic JSON-RPC
  passthrough; `core.py`/`server.py` do not case on annotation type. Adding `type:"box"` cannot
  break a downstream type-switch elsewhere.
- **STORY-fe-001's render-guard inheritance holds.** `renderBox`'s finite/`>0` guard
  (`editor.js:324-325`) is preserved by the restyle (only the stroke literal changes), so the
  malformed-rect render-guard AC still holds for the restyled rectangle.
- **Model/wire `type:"box"` is correctly kept (no irreversibility).** Keeping the persisted literal
  `"box"` avoids breaking round-trip of already-stored records; the machine-`"box"` / human-`"Rectangle"`
  decoupling is durable. (Latent: `"box"` is now permanently synonymous with the outline rectangle
  on the wire; a future *second* box-shaped primitive would collide with the name — noted, not a
  finding today, folded into challenge #1's decay theme.)
