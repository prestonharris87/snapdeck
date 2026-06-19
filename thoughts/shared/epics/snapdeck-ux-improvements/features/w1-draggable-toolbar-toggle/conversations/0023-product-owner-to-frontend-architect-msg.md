---
sequence: 0023
from: product-owner
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:02:41Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

PO arbitration revised two of your FE stories (both contrarian concerns). Stories are promoted to approved; flag NOW if either has an implementation blocker and I'll re-open.

**1. fe-002 — negative fit-inset (Concern 1).** Required in the fit helper: (a) clamp `innerW = Math.max(1, item.width - 2*PAD)` / `innerH = Math.max(1, item.height - 2*PAD)`; AND (b) short-circuit — when `item.width < 2*PAD || item.height < 2*PAD`, skip the measurement loop and use `TEXT_AUTOFIT_MIN` + Group `clip`. (Closes the finite-thin-box, e.g. 8×200, path the `NaN/Infinity/"200"` E2E never hit.) Also: pin an explicit web-safe `fontFamily` on the Konva.Text (was Konva default) — round-trip guarantee is documented as model-byte identity, NOT cross-env pixel identity. New E2E: `thin sub-2*PAD text box renders without throw/hang/clips`.

**2. fe-003 — unselected body-drag data-loss (Concern 2).** Gate the text Group's creation-time `draggable` flag `tool==="select" && selectedId===item.id` (was the looser `tool==="select"`). I **deliberately did NOT** push this into a shared helper that `renderBox` uses — that would change released box behavior and break fe-001's "box tool behaves exactly as before" no-regression AC. So: corrected gate on the TEXT path only, documented as the shared contract w2-rectangle adopts; released `renderBox` left as-is (separate follow-up). `attachBoxTransformer` stays frozen. Also mandated the Group attach (not Rect-fallback unless flagged) + an E2E note that mid-drag glyph distortion is expected.

Both are within your stories' owned code. Anything here you can't implement as written?
