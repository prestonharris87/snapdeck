---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
version: 1
written_at: 2026-06-19T15:25:00Z
run_id: run-20260619-150554-36418
sources:
  - feature.md
  - stories/STORY-fe-001.md
  - stories/STORY-fe-002.md
  - stories/STORY-fe-003.md
  - stories/STORY-be-001.md
  - stories/STORY-db-001.md
  - stories/STORY-do-001.md
  - stress-test.md
  - clarifications.md
  - conversations/0005-0016 (cross-domain peer messages)
  - conversations/0017-contrarian-architect-to-team-lead-msg.md
  - conversations/0018-product-owner-arbitration-decision.md
---

# Decision memo — Text-box auto-fit rework (Google-Slides style)

## Summary

`w1-text-box-autofit` replaces the Snapdeck Konva canvas editor's broken click-to-place red-bold
point-text tool with a drag-to-draw box annotation that wraps text to box width and auto-sizes the
font (capped at `TEXT_AUTOFIT_MAX=48`), styled as white fill / red outline / black text — the first
annotation-shape rewrite built on the released `w0-editor-foundation` contracts. What was non-obvious:
because every non-FE domain correctly sentineled, the FE auto-fit design (three sequential stories:
draw, render, select/resize) received **zero adversarial review** before the contrarian pass (stress-test.md
calibration note). The contrarian identified two real gaps at the cross-story seams — the thin-box inset
math having no lower bound (invisible to the specified E2E), and the unselected-drag geometry-write-back
silently reverting — both resolved by revision in PO arbitration (conv 0018), with the drag fix
deliberately scoped to the text path only to avoid breaking the released `renderBox` no-regression AC.

## Positions held during planning

### frontend-architect

- **Advocated for:** recompute-on-render (no stored `fontSize`) as the lossless round-trip strategy,
  and keeping auto-fit **inline in `editor.js`** rather than extracting a registered pure module —
  "auto-fit cannot be a pure node module" because Konva wraps via canvas text metrics
  (clarifications.md Q1, Q2; STORY-fe-001 §Decision).
- **Conceded:** nothing in the peer-message record; the non-FE architects all reached sentinel
  conclusions independently and the FE architect confirmed their reads (convs 0010, 0016). The
  contrarian's Group-attach preference was already the architect's preference; the Group-vs-Rect
  contract tightening was accepted as "fold in" (STORY-fe-003 §Revisions).
- **Persona alignment:** consistent with DEFAULT_STANCE; the FE lane ran as a single-author design
  with no internal challenge until the contrarian pass (stress-test.md).

### backend-architect

- **Advocated for:** sentinel — `addScreenshot()` stores `model: resp.model ?? null` verbatim at
  `background.js:225` and the `saveReport()` `/report/save` field whitelist (lines 248-252) never
  exposes the new text-box fields upstream (conv 0005; STORY-be-001 §History).
- **Conceded:** nothing; the released opaque model-persistence contract fully covered the new
  text-item geometry fields with zero backend change.
- **Persona alignment:** consistent; sentinel independently verified by the contrarian
  (stress-test.md §Verified-and-dismissed).

### database-architect

- **Advocated for:** sentinel; confirmed the new fields are a structured-clone value-shape change —
  no `kv` store/index/version change, no `report` record-shape change; initiated the 4-message peer
  coordination floor with BE and FE (convs 0005, 0010; STORY-db-001 §Cross-domain contract).
- **Conceded:** nothing; the w0-per-target-reports per-port re-key and the IndexedDB `kv` store
  (v1) were confirmed unchanged by both peers.
- **Persona alignment:** consistent; the standing team-lead "IndexedDB is FE/extension domain"
  ruling was the load-bearing precedent (STORY-db-001 §Why sentinel).

### devops-architect

- **Advocated for:** sentinel; confirmed the rework stays inside the already-registered `editor.js`
  + unchanged `editor-model.js`, the only new file (`editor.textbox.test.mjs`) is a `node --test`
  file not injected into a page, and no manifest/CI/permission delta is warranted — explicitly the
  inverse of the w0 `editor-model.js` extraction that forced a registration (convs 0007, 0016;
  STORY-do-001 §Why sentinel).
- **Conceded:** nothing; the key discriminator (inline vs extracted-module, clarifications.md Q2)
  made the sentinel unambiguous.
- **Persona alignment:** consistent; cited the w0 STORY-do-001 precedent to calibrate sentinel vs
  substantive (STORY-do-001 §How we validate).

### contrarian-architect

- **Advocated for:** (a) a one-line clamp on the fit inset to prevent unspecified negative-width
  Konva behavior on thin-but-valid boxes; (b) gating `draggable` once in the **shared** helper path
  (conv 0017); (c) pinning an explicit `fontFamily` and recording that only model-byte identity is
  guaranteed; (d) tightening the Group-vs-Rect attach contract and documenting mid-drag glyph
  distortion as expected.
- **Conceded:** the "fix once in the shared path" preference for the drag gate was overridden by PO
  because it would have changed released box-drag behavior and broken the fe-001 no-regression AC
  (conv 0018 Concern 2; STORY-fe-003 §Revisions).
- **Persona alignment:** consistent with DEFAULT_STANCE; every claim verified against released
  `editor.js` line-by-line; the "converged too easily" calibration flag proved correct
  (stress-test.md).

### product-owner

- **Arbitration decisions:** (1) Revised fe-002 — clamp + short-circuit on thin-box inset (Concern 1,
  conv 0018); (2) Revised fe-003 — gated text Group `draggable` on `tool==="select" &&
  selectedId===item.id`, scoped to text path only, documented as the w2 contract (Concern 2, conv 0018);
  (3) Accepted re-edit→empty deletion as intended, corrected AC wording (Info 1, conv 0018);
  (4) Pinned `fontFamily`, recorded model-byte-only round-trip guarantee (Info 2, conv 0018);
  (5) Promoted Group attach from preferred to contract, tightened Rect fallback conditions (Info 3,
  conv 0018); (6) Added `## How we validate` checklists to be-001 and do-001 to close a recurring
  sentinel-hygiene gap (conv 0018 §Sentinel hygiene).

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Store fitted `fontSize` on model vs recompute on render | FE-arch: recompute — trivially lossless; no determinism trap | (no challenger; Q1 auto-resolved) | Recompute-on-render; item carries `{x,y,width,height,text}` only | (clarifications.md Q1; STORY-fe-001 §Decision) |
| Auto-fit inline in `editor.js` vs extract to a registered pure module | FE-arch: inline — Konva canvas-measurement-dependent; extracted module is a fake abstraction | (no challenger; Q2 auto-resolved) | Inline; pure data invariants only in `node --test`; no manifest entry | (clarifications.md Q2; STORY-do-001) |
| Thin-box negative inset: as-written (no lower bound) vs clamp+short-circuit | Contrarian: revise — clamp `innerW/innerH = Math.max(1, …)` AND short-circuit `dim < 2*PAD ⇒ TEXT_AUTOFIT_MIN` | (fe-002 had no lower bound; gap invisible to E2E) | REVISED in fe-002: both clamp and short-circuit required; dedicated sub-2*PAD E2E case added | (conv 0017; STORY-fe-002 §Revisions; conv 0018 Concern 1) |
| Unselected drag move-loss: accept / fix on shared path / fix on text path only | Contrarian: fix once in shared path (all shapes) | PO: shared fix breaks released `renderBox` no-regression AC; text path only | REVISED in fe-003: text Group gated `select && selectedId`; `renderBox` left unchanged; w2 inherits the corrected text pattern as its contract | (conv 0017; STORY-fe-003 §Revisions; conv 0018 Concern 2) |
| re-edit→empty: retain box (Slides parity) vs remove box (create-flow consistency) | Contrarian: AC framing "only `text` changes" was silently false on the empty path | FE-arch: unified empty-removal locked in scope | ACCEPTED as intended; AC wording corrected in feature.md + fe-003 to distinguish non-empty (geometry preserved) vs empty (box removed, undoable) | (STORY-fe-001 §Contrarian Findings; STORY-fe-003 §Revisions; conv 0018 Info 1) |
| Round-trip guarantee: pixel/line identity vs model-byte identity | Contrarian: recompute-on-render ties rendered wrap to font environment; `w2-screenshot-gallery` may open in a different env | FE-arch: model round-trip is `deepEquals`-identity regardless | FOLDED IN: explicit web-safe `fontFamily` pinned; guarantee recorded as **model-byte identity only** — cross-environment pixel/line identity NOT guaranteed | (STORY-fe-002 §Contrarian Findings Finding 2; STORY-fe-002 §Revisions; conv 0018 Info 2) |

## Tensions accepted as known risk

- **Released `renderBox` legacy drag gate inconsistency:** `renderBox`'s `draggable: tool==="select"`
  (the loose gate, without the `selectedId` check) remains in the released codebase, inconsistent
  with the corrected text-path contract and what w2 will inherit. Risk owner: PO/FE-arch. Accepted
  because aligning it would change released box-drag behavior and break fe-001's "box tool behaves
  exactly as before" no-regression AC. Recommended as a **separate follow-up** not folded into this
  feature. (STORY-fe-003 §Revisions; conv 0018 Concern 2)

- **Cross-font-environment pixel/line identity not guaranteed:** the rendered wrap/line-count is a
  function of canvas font metrics; pinning `fontFamily` maximizes stability but cross-browser/OS
  pixel identity is not achievable. `w2-screenshot-gallery` must rely on model bytes, not visual
  re-render. Risk owner: FE-arch; documented in fe-002 + feature.md round-trip AC.
  (STORY-fe-002 §Revisions; conv 0018 Info 2)

## Alternatives rejected

- **Store `fontSize` on the model item** (clarifications.md Q1, Option A): rejected because any
  stored derived field would have to be re-derived identically on reload to keep
  `deepEquals(model.items)` green — the determinism trap. The fit is a pure function of
  `{width,height,text,cap}` + Konva measurement; recompute-on-render makes the round-trip trivially
  lossless by construction. (clarifications.md Q1; STORY-fe-001 §Decision)

- **Extract auto-fit to a registered pure node module** (clarifications.md Q2, Option A): rejected
  because Konva wraps via canvas text metrics, which a `node --test` module cannot faithfully
  replicate — extracting would create a fake abstraction. It would also require a new
  `manifest.json` content-script registration (devops story + dependency), repeating the w0
  `editor-model.js` extraction overhead for no real benefit. (clarifications.md Q2; STORY-do-001
  §Cross-domain coordination)

- **Raise the draw threshold to `2*PAD` (~12px)** to prevent thin boxes from reaching the fit
  helper: rejected because it would silently reject legitimately small boxes. The correct fix is
  clamping the inset in the fit helper. (STORY-fe-001 §Revisions Finding 2; conv 0018 Concern 1)

- **Fix the draggable gate in `attachBoxTransformer` or a shared render path** (contrarian's
  preference, conv 0017): rejected because `attachBoxTransformer` is a frozen released helper and
  applying the gate in the shared path would change released box-drag behavior, breaking fe-001's
  "box tool behaves exactly as before" no-regression AC. The tighter gate is applied to the new
  text path only and documented as the w2 contract. (STORY-fe-003 §Revisions; conv 0018 Concern 2)

- **Google-Slides "retain an emptied box on re-edit" parity**: rejected because Snapdeck text boxes
  carry only text (no formatting or other content) — an emptied box has no annotation value. The
  unified `editText` empty-removal, locked in scope for the create flow, is kept consistent.
  (STORY-fe-001 §Revisions Finding 1; conv 0018 Info 1)

## Next actions

Mirrors `feature.md` §Acceptance criteria (all 6 stories approved 2026-06-19, conv 0018):

- [ ] The Text tool is **draw-a-box**: dragging defines `{x,y,width,height}`; a sub-threshold drag (`width≤4 || height≤4`) creates no item.
- [ ] Committing empty text removes the box (no orphan empty boxes); committing non-empty persists it.
- [ ] Text **wraps to the box width** and the font **auto-sizes** within `[TEXT_AUTOFIT_MIN=6, TEXT_AUTOFIT_MAX=48]`; thin boxes `< 2*PAD` are short-circuited + clamped + clipped at the Group boundary.
- [ ] On ✓ Done, geometry + text preserved in `model` as `{x,y,width,height,text}` — no stored fit field.
- [ ] Renders with **white fill, red `#e53935` outline, black text** — replacing red bold point-text.
- [ ] **Select mode:** single-click selects + attaches one shared `Konva.Transformer` (`rotateEnabled:false`); text Group's `draggable` gated `tool==="select" && selectedId===item.id`.
- [ ] **Resize re-fit:** `transformend` bakes geometry back via frozen `attachBoxTransformer`; `render()` re-fits automatically within the cap.
- [ ] **Re-edit:** double-click re-opens box pre-filled; non-empty commit preserves geometry; empty commit removes box (intended, undoable).
- [ ] **Lossless round-trip:** `deepEquals(model.items)` identity; cross-environment pixel/line identity NOT guaranteed — model bytes only.
- [ ] Lossy `annotations` projection stays byte-frozen `{id,type:"text",x,y,text}` — no width/height in projection or upstream `/report/save`.
- [ ] `editor-model.js` gains **no per-item validation**; `attachBoxTransformer` reused unchanged.
- [ ] Render-boundary robustness extended into auto-fit (non-finite/wrong-type geometry skipped; fit loop bounded; cannot hang).
- [ ] Box-shape logic factored for `w2-rectangle-tool` reuse without a second `editor.js` rewrite.

## Open questions deferred to implementation

None — all three `clarifications.md` entries have `Status: auto-resolved`; no `needs-user-input`
entries remain.
