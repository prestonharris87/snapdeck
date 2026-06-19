# Product-Owner arbitration decision — w1-text-box-autofit (Phase 6)

**Date:** 2026-06-19
**Author:** product-owner
**Inputs:** STORY-fe-001/002/003, STORY-be/db/do-001, `stress-test.md` (contrarian: 0 block / 2 concern / 4 info), each story's `## Contrarian Findings`.

## Cross-domain conflict scan

**None.** This is a 3-FE-story feature (fe-001 → fe-002 → fe-003, clean dependency chain) with **zero
cross-domain dependencies**. be/db/do-001 are no-work sentinels, each peer-confirmed with the
frontend-architect (and BE↔DB) via SendMessage before writing (mirrored to `conversations/` 0004–0016),
and the contrarian independently verified them correct (`addScreenshot()` stores `model` verbatim at
`background.js:225`; `projectAnnotations` is byte-frozen and box-blind; `deserializeModel` passes items
through opaquely; no server-side DB; nothing browser-loaded is extracted so no manifest delta). So there
was no inter-domain contract to arbitrate.

**Where the real risk lived (contrarian calibration flag, which I weighted heavily):** because every
non-FE domain correctly sentineled, the FE auto-fit design got **zero adversarial review** — it was
authored and ratified inside the FE lane. The "converged too easily" signal is genuine here, and the two
concerns cluster exactly at the **seams between the three FE stories that no single story owned
end-to-end**. That is where I focused.

## Concern 1 (highest-risk) — negative fit-inset on thin boxes → REVISE fe-002

- **Problem:** fe-001's draw guard accepts `width>4 && height>4`, so a finite thin box (e.g. 8×200) is
  creatable; fe-002's inset `width − 2*PAD` (PAD~6) is ≤ 0 for any dim ≤ ~12px. The render-time guard
  (`width<=0 return`) does NOT catch a positive `width:8`, so a non-positive width reaches the fit loop —
  the one path the contrarian could not prove stays cheap. The load-bearing "auto-fit must not throw or
  hang" contract is depended on by **w2-screenshot-gallery** (re-opens arbitrary stored models through
  this exact path), and the existing hostile-item E2E (`NaN`/`Infinity`/`"200"`) does not exercise a
  finite small width — so the gap was invisible to the suite.
- **Decision: REVISE (not accept).** Required **both** in fe-002's new fit helper: (1) clamp
  `innerW/innerH = Math.max(1, dim − 2*PAD)` (closes the *unspecified-negative-width* risk); (2)
  short-circuit `dim < 2*PAD ⇒ TEXT_AUTOFIT_MIN` + Group `clip`, skipping the measurement loop (closes
  the *expensive-degenerate-measurement* risk). Added a dedicated browser-tester E2E (`thin sub-2*PAD
  text box renders without throw/hang/clips`). Fix is scope-clean (fe-002's own new helper; no change to
  `editor-model.js`, the draw threshold, or released code). Draw threshold kept at `>4` (fe-001 Finding
  2 — raising it would silently reject legit small boxes).

## Concern 2 — unselected body-drag silently loses the move → REVISE fe-003 (scoped carefully)

- **Problem:** boxes are `draggable` while in select mode even when unselected, but the geometry-writing
  `dragend` lives only in `attachBoxTransformer` (attached only when selected). Body-dragging an
  unselected box moves the node, suppresses the click (no selection), fires no `dragend`, and reverts on
  the next `render()` — including the `render()` inside `finish()` before serialize, so the move can
  vanish from the saved screenshot. fe-003 promotes this path to the "one shared mechanism"
  w2-rectangle reuses, so the latent quirk would be enshrined for three shapes.
- **Decision: FIX on the new text path; diverged from the contrarian's "fix once in the shared path."**
  Gate the text Group's creation-time `draggable` flag `tool==="select" && selectedId===item.id` (was
  the looser `tool==="select"`) → an unselected box's mousedown selects it instead of doing a
  non-written-back drag; the selected box then drags with the helper's `dragend`. `attachBoxTransformer`
  stays frozen.
  - **Why not the shared path:** applying the gate to a shared helper that released `renderBox` also
    uses would change released box-drag behavior and **break fe-001's "box tool behaves exactly as
    before" no-regression AC** — a contradiction in the naive fix. So the corrected gate is applied to
    the text path only and **documented as the shared contract w2-rectangle adopts** (w2 follows the
    text pattern, not legacy `renderBox`). Aligning released `renderBox` is a recommended **separate**
    follow-up, not folded into a text-box feature.
  - This is a conscious fix (not an Acknowledged Risk): the data-loss is eliminated everywhere this
    feature owns code (text), and the contract w2 inherits is the correct one. Added an E2E case.

## Info dispositions

1. **fe-001 Finding 1 — re-edit→empty deletes the whole committed box: ACCEPT (intended) + fix AC
   wording.** Re-edit→empty removing the box is intended (consistent with the locked create-flow
   empty-removal; undoable; a Snapdeck text box carries only text, so an emptied box has no annotation
   value — Slides retention parity rejected). The contrarian correctly caught the *re-edit* AC framing
   ("only `text` changes") silently failed on the empty path — a **wording** bug, not behavior. Clarified
   in feature.md + fe-003 re-edit AC (non-empty preserves geometry / empty removes box) + an E2E note so
   the empty-delete is not filed as a regression.
2. **fe-002 Finding 2 — recompute-on-render is font-environment-dependent: FOLD IN (mitigate).** Pin an
   explicit web-safe `fontFamily` on the `Konva.Text` (was inheriting Konva's default) for measurement
   stability, and record explicitly that the round-trip guarantee is **model-byte identity**
   (`deepEquals(model.items)`), NOT cross-environment pixel/line identity. Recorded in fe-002 + feature.md
   round-trip AC/E2E for the w2-screenshot-gallery hand-off.
3. **fe-003 Finding 2 — Group-vs-Rect attach fallback + mid-drag glyph distortion: FOLD IN.** Promoted
   the Group attach from "preferred" to the **contract** (text+box move/resize as one unit); the Rect
   fallback is allowed only if the Group path blocks AND Text is a child/`listening:false`+resync, and
   must be flagged to the PO. Recorded that mid-drag glyph stretch/squash (Konva's live scale before the
   on-release re-fit) is **expected**, with an E2E note to pre-empt a false-positive defect.
4. **fe-001 Finding 2 — draw threshold admits thin boxes: reconciled via Concern 1's fe-002 clamp; no
   change to fe-001.** (See Concern 1.)

## Sentinel hygiene (recurring fix)

be-001 and do-001 shipped **without a `## How we validate` checklist** — a recurring gap in
architect-authored sentinels. Added one to each (empty-diff / byte-identical-upstream / no-new-IPC for
be; unmodified-manifest / no-browser-module / no-CI-surface for do). db-001 already had a 4-item
checklist. Added `last_run_id` to do-001 for frontmatter conformance. All three sentinel rationales were
verified correct by the contrarian; no rationale needed correction this time.

## depends_on validation

All accurate and YAML-valid (unquoted bracketed ids): fe-002 `[STORY-fe-001]`, fe-003 `[STORY-fe-001,
STORY-fe-002]`, fe-001/be/db/do `[]`. The producer→consumer chain is correctly declared; sentinels are
genuinely standalone. (Formal `validate-depends-on.py` runs at finalize.)

## Outcome

All 6 stories promoted **pending → approved**. FE-architect notified (SendMessage) of the exact
clamp/short-circuit + fontFamily wording (Concern 1) and the draggable-gate scoping decision (Concern 2)
for confirmation; revisions stand absent an implementation-blocker flag. Two contrarian concerns
resolved-by-revision (not accepted-as-risk), four info findings dispositioned, two feature.md AC
inaccuracies corrected. No `## Acknowledged Risk` block was warranted (both concerns had cheap in-scope
fixes). Plan ready for Phase 7 (security) / decision-recorder synthesis.
