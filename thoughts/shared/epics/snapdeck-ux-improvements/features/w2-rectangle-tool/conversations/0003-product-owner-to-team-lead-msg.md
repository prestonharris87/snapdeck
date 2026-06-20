---
sequence: 0003
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:28:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

✅ **feature.md updated — all four deltas folded in. Ready to spawn architects.** (Read `controller/snapdeck_controller/reports.py` to ground the new AC/E2E, not from memory.)

**1. Risk RESOLVED, not open.** Rewrote the old #1-risk note → ✅ RESOLVED (BOSS recon, scope commit d5fa5d3): controller is IN-REPO (`reports.py`), `save_report` stores `annotations` opaquely (`shot.get("annotations") or []` → report.json, no validation/rejection) → **projection contract safe to lock, no BOSS escalation.** Removed the "verify tolerance / escalate" framing and the dangling "#1 downstream-consumer risk" reference in the projection AC.

**2. Added the 3rd surface (controller report.md human summary):**
- **In-scope bullet** — render the rectangle in `_render_markdown` (~line 220). One accuracy note: it's not *silently absent* — a rectangle currently hits the catch-all `else` (`lines.append(f"- {a}")`) and dumps the **raw dict**. The branch adds a clean emoji + rounded `{x,y,width,height}` line in the arrow/text style.
- **AC** — "a saved report's report.md shows the rectangle in its human summary (not the raw-dict catch-all)."
- **E2E** — controller-level test (pytest on `_render_markdown`/`save_report`); noted the FE→projection half is browser-tester's lane. backend-architect owns the controller story + its unit test.
- **Coupling flagged:** the `_render_markdown` branch MUST case on the **same `type` string the projection emits** — kept the emitter↔renderer coupling explicit so they can't drift.

**3. Projection `type` string** — kept OPEN for the architect but reframed: it's now a **naming choice, not a compat risk** (tolerance confirmed). Model/wire `type` stays `"box"` (back-compat — unchanged).

**4. Frozen-test note** — left exactly as-is (`editor.model.test.mjs:88-101` update + test-file ownership to the projectAnnotations story).

Also bumped the Summary to "four deltas across three in-repo surfaces (editor.js · editor-model.js+test · controller reports.py)." `frontend_lane: N/A` stays correct (vanilla-JS Konva + Python controller; no UI-component-library lane). Story expectation for architects: **FE** (editor.js restyle/relabel) · **FE** (editor-model.js projection + frozen test) · **BE** (controller `_render_markdown` + pytest). Standing by for the Phase 5 standby transition.
