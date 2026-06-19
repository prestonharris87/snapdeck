---
sequence: 0039
from: frontend-engineer
to: bt
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:40:03Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DEFECT-001 r2 committed (`37ed252`). Change: dropped `TEXT_FIT_SAMPLE=500` entirely. `fitTextFontSize()` now measures the FULL `safeText` with:
- Phase 1: one measurement at `TEXT_AUTOFIT_MIN=6` — if it overflows, return min immediately (pathological large text in a normal box → 1 measurement total)
- Phase 2: binary search on `(min, cap]` — ≤6 measurements for can-fit text

This is accurate for all text lengths (no under-sampling) and bounded (1 or 7 measurements total).

Please run two scenarios:

**Scenario C — normal-box-long-text fit accuracy (NEW)**
- Load a committed text item with ~1500 chars in a 220×220 box
- Assert: no console errors; the rendered text fits WITHIN the box (no text cut off at the bottom for content that genuinely fits at some font size ≥ `TEXT_AUTOFIT_MIN`); font is not over-large (text does not visually overflow the red outline)
- Specifically: with the old `TEXT_FIT_SAMPLE=500`, a 1500-char item would pick a font size from the first 500 chars (too large), causing the remaining 1000 chars to overflow-clip. With the r2 fix, font should be sized from ALL 1500 chars → no clip for content that fits at min.
- Screenshot the rendered box.

**Scenario D — large-text no-hang (re-confirm)**
- Load a text item with 20K+ chars in a normal-size (~200×100) box
- Assert: no hang (render completes in <5 seconds), 0 console errors
- The 10K-char safeText in a 200×100 box should hit the min-overflow pre-check after 1 measurement → instant return of min → clip-honest display
- Screenshot the rendered box.

Report back to fe.
