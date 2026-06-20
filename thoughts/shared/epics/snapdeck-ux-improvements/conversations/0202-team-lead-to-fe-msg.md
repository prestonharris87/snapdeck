---
sequence: 0202
from: team-lead
to: fe
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:37:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Re-validation of your DEFECT-001 fix (6a03abb) flagged a correctness regression in **fix 2b** — needs one more round (fe-002, remediate r2). The dblclick fix (fix 1) and binary search (fix 2a) are confirmed good; honesty passed; fe-003 re-validated; bt e2e 5/5. Only the fit-sampling needs work:

**Problem:** `TEXT_FIT_SAMPLE=500` measures only the first 500 chars to choose the font size, then displays the full text. For text ≥~500 chars in a **non-degenerate** box, the font is sized from the 500-char sample → too large for the full text → the full text wraps to more lines than measured → **overflows the box height (hidden by the Group clip → text cut off)**. That violates fe-002 AC#3 ("auto-fit to fit the box; no overflow for non-degenerate boxes") and the determinism AC. It's invisible to the current E2E (no normal-box-long-text case).

**Constraint to satisfy (both must hold):**
1. **Accurate fit for realistic annotation text** — a non-degenerate box with a 500–2000-char comment must auto-fit so the full text fits (font sized from the FULL text, not a 500-char sample), OR if it genuinely can't fit even at `TEXT_AUTOFIT_MIN`, return MIN (least overflow) — never an over-large font.
2. **Still bounded (no 20s hang)** on the pathological re-open path (w2-screenshot-gallery).

**Suggested approach (your call):** drop the 500-char sample for the fit decision; measure the FULL `safeText` (already RENDER_TEXT_CAP-capped) inside the binary search (6 iters). To keep the pathological case cheap, short-circuit: if the full text doesn't fit at `TEXT_AUTOFIT_MIN` (one measurement), return MIN immediately (box can't fit it → MIN is correct + clip is honest); otherwise binary-search up. That's accurate for can-fit text and ~1-2 measurements for can't-fit long text — bounded without sampling inaccuracy. (If you keep any sample, it must be large enough that realistic annotations fit accurately.)

Commit atomically (`git commit -- extension/content/editor.js`, msg `fix(w1-text-box-autofit): DEFECT-001 r2 — accurate bounded auto-fit (drop under-sampling)`), `node --test` green. Then ping `bt` to **add + run a normal-box-long-text case** (e.g. 220×220 box with ~1500 chars → asserts the text fits within the box, not over-large/clipped) plus re-confirm the no-hang on a large item. Append `## Engineer Notes` (cite DEFECT-001 r2). Reply to me with the SHA + what you changed. Do NOT push.
