---
sequence: 0019
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:38:49Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

✅ Both doc-normalization fixes in on STORY-fe-001 + STORY-fe-002. Stories stay `status: approved`. No design/disposition change.

**FIX 1 — disposition-line format (gate false-negative):** reformatted all 5 `PO disposition:` lines from the combined `- **PO disposition: <VERDICT>.** …` form to the tolerant bold-label form `**PO disposition:** <VERDICT>. …` (dropped the leading `- `, bold now wraps just the label). Verdicts + rationale text byte-identical. Locations: fe-001:428 (PROMOTE_TO_AC), fe-001:469 / :492 / :515 (3× ACCEPT), fe-002:217 (ACCEPT). `check-disposition.sh` should now see all 5.

**FIX 2 — `node --test` command (Node v22 glob):** corrected all 3 references from `node --test extension/` to `node --test extension/*.test.mjs` — fe-001:248 (the Phase-5a run line) + fe-001:252 (the shared-run collision note) + fe-002:145. Test cases and hybrid-ruling content untouched.

Verified by grep: zero remaining `- **PO disposition:` combined forms; zero bare `node --test extension/` (non-glob) references.

Re-run the disposition gate when ready. Going idle — final shutdown next.
