---
sequence: 0039
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:30:35Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to mode: security-finalize. security-architect wrote `## Security Review` blocks on STORY-fe-001 (2 LOW + 2 INFO) and STORY-fe-002 (INFO only) — it's done/idle, so you're the sole writer on these files now. For EVERY finding in EVERY block, render a formal disposition (PROMOTE_TO_AC / ACCEPT_AS_RECOMMENDATION / DEFER), edit stories where PROMOTE applies, and append a `PO disposition:` line to each block so every block ends with one (the disposition gate checks this).

Team-lead steer on the 2 LOWs (you formalize the disposition + edits):

1. **fe-001 LOW — divergent localhost gate** (write path `addScreenshot`/`saveReport` uses the loose existing guard + bare `portOfUrl`; read path uses the tightened `currentTargetPort()`): **PROMOTE_TO_AC.** It aligns with scope.md's explicit "one source of truth for the port" critical directive AND is free defense-in-depth. Add a concrete, testable AC to fe-001's `## Acceptance criteria`: *the write path (addScreenshot/saveReport) derives its port via the SAME localhost-gated resolution as the read path (`currentTargetPort()` / a shared gated helper) — no second, looser port predicate; a capture on a deceptive host like `http://localhost.evil.com` resolves to no-target, not `:80`.* Mark the block `PO disposition: PROMOTE_TO_AC`. (This does NOT change the cross-feature contract — key format + GET_STATE shape are unchanged.)

2. **fe-001 LOW — unbounded `report:<port>` growth (DoS):** LOW (local single-user tool, small records, `clearReport` resets). **ACCEPT_AS_RECOMMENDATION — not gating.** Note that `w2-screenshot-gallery`'s delete/manage flow is the natural home for any GC of abandoned per-port records. (If you judge a tracked follow-up is warranted you may DEFER via `file-defect.sh` instead — your call; I lean accept-as-recommendation given LOW + local.)

3. The 2 INFO affirmations on fe-001 (retired-fallback is net-positive; callers-never-pass-a-port kills IDOR) and the fe-002 INFO: **ACCEPT_AS_RECOMMENDATION.**

When done, reply to `main` with a summary table (story | finding | disposition), then go idle (you stay warm for final shutdown).
