---
sequence: 0017
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:50:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

Contrarian stress-test of w1-text-box-autofit complete. All code claims verified against released `extension/content/editor.js` (line-cited), not from memory.

**Counts: 0 block / 2 concern / 4 info.** No `## Acknowledged Risk` + PO gate is *required* — both concerns are revise-or-acknowledge with a clear cheap fix. Blocks: none. Stories that got concerns: **fe-002** and **fe-003** (one each); fe-001 got 2 info; sentinels (db/be/do-001) are correct — no findings.

**Single highest-risk finding (concern, STORY-fe-002):** the inset math has no lower bound and the test suite won't catch it. fe-001's draw guard accepts boxes `>4px`; fe-002's fit inset is `width - 2*PAD` (PAD~6) → **negative for any box ≤~12px**, which is normally drawable (e.g. an 8×200 thin box). That negative width flows into `fitTextFontSize` → `Konva.Text.width(-4)`, whose wrap is unspecified and whose worst case (1 glyph/line on a ~10k-char string ×42 iters ×500 items) is the one fit path I couldn't prove stays cheap. The "auto-fit must not throw/hang" contract — which **w2-screenshot-gallery depends on when it re-opens arbitrary models through this exact path** — is E2E-tested only with NaN/Infinity/"200", none of which look like a finite `width:8`, so the gap is invisible to the specified tests. I did NOT assert it definitively hangs (couldn't run Konva; lock-it-down). Fix is a one-line clamp: `innerW = Math.max(1, width - 2*PAD)` (same for innerH) or short-circuit to TEXT_AUTOFIT_MIN when `width < 2*PAD`, plus one sub-2*PAD E2E case.

**Second concern (STORY-fe-003):** body-dragging an *unselected* text box silently loses the move — `draggable` is true while unselected but the geometry-writing `dragend` is only attached in the selected block (via `attachBoxTransformer`), so the move reverts on the next render(), including the render() inside finish() before serialize (can vanish from the saved screenshot). Inherited verbatim from released `renderBox`, BUT fe-003 promotes this into the "one shared select/move mechanism w2-rectangle reuses" — so a latent w0 quirk becomes the ratified contract for box+text+rect. Accept consciously (Acknowledged Risk) or fix once in the shared path (`draggable: select && selected`).

**Calibration flag for PO arbitration:** every non-FE domain correctly sentineled, which means the FE auto-fit design was authored + ratified entirely inside the FE lane with **zero adversarial review** — the "converged too easily" signal. All my concerns sit at the **seams between the three sibling FE stories** that no single story owned end-to-end (draw-threshold vs fit-inset; render `draggable` vs selected-only `dragend`). The design is fundamentally sound (recompute-on-render is the correct round-trip call; sentinels are right) — the gaps are at the cross-story seams.

Info findings: fe-001 re-edit→empty deletes the whole committed box (undoable; confirm intended vs Slides-parity retain); fe-002 recompute-on-render makes the *rendered* wrap font-environment-dependent though the *model* round-trip stays identity (pin a fontFamily, document the limit); fe-003 Group-vs-Rect transformer fallback has un-analyzed live-drag/hit-test behavior + non-uniform resize visibly distorts glyphs mid-drag (pre-empt a false-positive bt defect).

Full writeup: `features/w1-text-box-autofit/stress-test.md` (incl. a verified-and-dismissed section: sentinels, projection x,y shift, fe-001→002 intermediate, w2 factorability, fit-loop bound — all checked and cleared). Per-story `## Contrarian Findings` blocks appended to fe-001/002/003. Going idle.
