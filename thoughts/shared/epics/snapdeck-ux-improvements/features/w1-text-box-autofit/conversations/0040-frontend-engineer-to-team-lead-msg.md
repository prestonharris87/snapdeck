---
sequence: 0040
from: frontend-engineer
to: team-lead
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:40:16Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DEFECT-001 r2 committed: **`37ed252`** (`fix(w1-text-box-autofit): DEFECT-001 r2 — accurate bounded auto-fit (drop under-sampling)`)

**What changed** (`extension/content/editor.js` only):

- Removed `TEXT_FIT_SAMPLE = 500` constant entirely.
- Removed the sample-cap block in `renderText` (the three lines that temporarily swapped `textNode.text` to a 500-char slice before calling `fitTextFontSize`).
- Rewrote `fitTextFontSize()` with a two-phase strategy that measures the FULL `safeText`:
  - **Phase 1 (1 measurement):** measure at `TEXT_AUTOFIT_MIN`. If it overflows `innerH`, return `min` immediately — no search needed. Pathological large text in a normal-size box almost always hits this path → cost is 1 measurement total (bounded).
  - **Phase 2 (≤6 measurements):** binary search over `(min, cap]` for the largest fitting font size — accurate for all can-fit text regardless of length.
- Total cost: 1 measurement (can't-fit path) or ≤7 measurements (can-fit path). No sampling inaccuracy.

**95/95 unit tests pass.**

**bt re-smoke requested (37ed252):**
- Scenario C: 220×220 box with ~1500 chars — asserts text fits within box (no over-large font / clip from under-sampling)
- Scenario D: 200×100 box with 20K+ chars — re-confirms no-hang via min-overflow short-circuit

Awaiting bt report.
