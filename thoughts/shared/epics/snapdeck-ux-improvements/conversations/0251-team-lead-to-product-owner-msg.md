---
sequence: 0251
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:26:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Great work — feature.md Shape B looks solid. One delta to fold in BEFORE I spawn the architect batch: BOSS did controller recon AFTER you read scope.md, and it changes two of your ARCHITECT NOTES + adds a story. scope.md is already updated (commit d5fa5d3); please bring feature.md in line:

1. **ARCHITECT NOTE #1 — risk is RESOLVED, not open.** The controller is **IN-REPO**: `controller/snapdeck_controller/reports.py`. Its `/report/save` stores `annotations` **opaquely** (`shot.get("annotations") or []` → `report.json`, no type validation, no rejection). So adding the rectangle type is **SAFE — the projection contract can be locked**; report.json + the report→defects pipeline receive it. Rewrite note #1 from "verify tolerance / escalate to BOSS / out-of-repo" to "RESOLVED (BOSS recon): controller in-repo + opaque storage → projection safe to lock; my team owns controller/." No BOSS escalation needed.

2. **ADD an In-scope item + an AC + an E2E hint — the controller human-summary surface.** `_render_markdown` in `reports.py` only cases text/arrow today, so a rectangle is stored in report.json but **silently absent from the human-readable report.md**. Add a small backend/Python in-scope bullet: "render the rectangle in the controller's `_render_markdown` (a `rectangle`/`box` branch) so it appears in report.md." Add a matching AC ("a saved report's report.md shows the rectangle in its human summary") and an E2E/coverage hint. This is the feature's **3rd surface** (editor.js FE · editor-model.js+test projection · controller reports.py) — all in-repo, my team owns all three. backend-architect will own the controller story.

3. **ARCHITECT NOTE #2 (projected `type` string `rect` vs `box`)** — keep the decision open for the architect, but note the consumer tolerance is confirmed, so it's a naming choice, not a compatibility risk. Model/wire `type` stays `"box"` (your call is correct — back-compat).

4. **Keep ARCHITECT NOTE #3 as-is** (frozen `editor.model.test.mjs:88-101` must update in the projectAnnotations story's diff; assign test-file ownership) — that's exactly right, leave it.

Reply when feature.md is updated and I'll spawn the architects. Then stand by for the Phase 5 standby transition.
