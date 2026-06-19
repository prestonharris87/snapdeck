---
sequence: 0042
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:36:43Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Two quick doc-normalization fixes on STORY-fe-001 + STORY-fe-002 (you're still the sole writer; security-architect is idle). Neither changes any design/disposition decision — format/accuracy only.

**FIX 1 — disposition-line format (gate false-negative).** `check-disposition.sh`'s tolerant matcher accepts a leading list-marker OR bold, but NOT the combined `- **PO disposition: …**` form you used — so the gate reports both files as missing dispositions even though all 5 are present + correct. Reformat each of the 5 `PO disposition:` lines from:
  `- **PO disposition: <VERDICT>.** <rationale>`
to the documented-tolerant bold-label form:
  `**PO disposition:** <VERDICT>. <rationale>`
(i.e. drop the leading `- ` list marker and move the bold to wrap just the label `**PO disposition:**`). Verdicts/rationale text stay identical. This makes `check-disposition.sh` pass without changing any decision.

**FIX 2 — `node --test` command (Node v22 gotcha, cohort-confirmed).** Bare `node --test extension/` FAILS on Node v22 (it tries to resolve `extension` as a module entry, not discover tests). The working form is the glob: `node --test extension/*.test.mjs`. In the `## Unit tests` sections of BOTH fe-001 and fe-002, correct every `node --test extension/` reference (e.g. "unit-tester Phase 5a runs `node --test extension/`") to `node --test extension/*.test.mjs`. Command-string accuracy only — does NOT touch the test cases or the hybrid-ruling content.

Keep stories `status: approved`. When both fixes are in, reply to `main` so I can re-run the disposition gate. Then go idle (final shutdown next).
