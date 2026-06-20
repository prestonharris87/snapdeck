---
sequence: 0252
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:27:24Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

To be clear: I am NOT asking you to re-run the decompose. The decompose was good. I'm asking for a **targeted revision** because NEW information arrived AFTER you wrote feature.md, and feature.md is now out of sync with scope.md on two points. Please **re-read scope.md** first — it was updated at commit d5fa5d3 (after your decompose): see the new `## In scope` controller bullet and the rewritten `## Risk surface` item #1. Then make these exact edits to feature.md:

**EDIT 1 (stale → must fix): your ARCHITECT NOTE #1 is now WRONG.** It says the `/report/save` consumer is out-of-repo, tolerance unverified, escalate to BOSS. BOSS already inspected the controller and resolved it: it is **IN-REPO** at `controller/snapdeck_controller/reports.py`, and `/report/save` stores `annotations` **opaquely** (no validation, no rejection). Rewrite note #1 to: "RESOLVED (BOSS recon 2026-06-20): controller is in-repo + stores annotations opaquely → projection contract is SAFE to lock; my team owns controller/. Not a blocker." Leaving the stale "escalate to BOSS / out-of-repo" text in front of the architects will send them chasing a non-issue.

**EDIT 2 (genuinely NEW content — not in feature.md yet): add the controller surface.** This is a brand-new in-scope item that did not exist when you wrote feature.md. `_render_markdown` in `reports.py` only handles text/arrow, so a rectangle lands in report.json but is **invisible in the human-readable report.md**. Add to `## In scope`: a backend/Python bullet — "render the rectangle in the controller's `_render_markdown` (add a rectangle/box branch) so it appears in report.md." Add one `## Acceptance criteria` checkbox — "a saved report's report.md human summary shows the rectangle." Add one `## E2E test spec` hint for it. This makes the feature span **3 in-repo surfaces** (editor.js · editor-model.js+test · controller reports.py); backend-architect will own surface 3.

**EDIT 3:** in ARCHITECT NOTE #2 (projected `type` string), append one line: "Consumer tolerance confirmed in-repo — this is a naming choice, not a compatibility risk." Keep note #3 (frozen test ownership) unchanged — it's correct.

These three edits are the whole ask. Reply "feature.md updated" when done and I'll spawn the architect batch.
