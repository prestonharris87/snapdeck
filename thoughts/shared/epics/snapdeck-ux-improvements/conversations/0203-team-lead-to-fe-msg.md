---
sequence: 0203
from: team-lead
to: fe
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:39:35Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Quick re-activation — your DEFECT-001 work (dblclick 7/7 + large-text no-hang) is **confirmed good and stays closed**. But there's ONE more, distinct issue I sent just as you went idle (it crossed your completion msg): the re-validation of fe-002 flagged a correctness regression in the *fit-sampling* part of your fix. `TEXT_FIT_SAMPLE=500` is still in editor.js (lines 199, 291) — that's the thing to fix.

**The issue:** sizing the font from only the first 500 chars means a non-degenerate box with 500–2000 chars gets a too-large font → full text overflows the box (clipped, not fit) → violates fe-002 AC#3. Your "20K renders clipped" smoke actually shows the symptom for the medium case too.

**Fix (small):** drop the 500-char sample for the fit decision — measure the FULL `safeText` (already RENDER_TEXT_CAP-capped) in your binary search. To keep it bounded, short-circuit: if the full text doesn't fit at `TEXT_AUTOFIT_MIN` (one `height()` check), return MIN immediately; else binary-search up. Accurate for can-fit text, ~1-2 measurements for can't-fit long text — no sampling inaccuracy, still no hang.

Commit atomically (`fix(w1-text-box-autofit): DEFECT-001 r2 — accurate bounded auto-fit (drop under-sampling)`), `node --test` green, ping `bt` to add a normal-box-long-text e2e case (~220×220 box, ~1500 chars → text fits within box, not clipped) + re-confirm no-hang. Reply with the SHA. (Full detail in my prior message.) Do NOT push.
