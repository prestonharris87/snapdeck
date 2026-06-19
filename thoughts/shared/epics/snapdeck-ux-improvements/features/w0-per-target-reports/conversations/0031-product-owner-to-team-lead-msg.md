---
sequence: 0031
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:10:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

✅ **ADD-STORY ARBITRATE complete — STORY-fe-003 promoted `pending → approved`.** No arbitration block; locked `storage.session` mechanism + `{port,count,ts}` payload NOT re-litigated.

**1. Citations — all accurate, NO spot-fix.** Re-verified every `## Existing behavior baseline` file:line against `extension/background.js`: site 1 `addScreenshot :192-229` (port `:200`, gate `:197`, `setReport :227`, return `:228`); site 2 `saveReport :231-262` (`browserPort :236`, success `if :257`, `clearReport :258`, return `:259`, no-emit paths `:237/:239/:242-244/:261`); site 3 `CLEAR_REPORT :184-186`; helpers `getReport :40-43`, `setReport :44-47` (null-guard `:45`), `clearReport :48`, `currentTargetPort :70-75`, `portOfUrl :51-57`; single `onMessage :104-107`; `SET_NOTE :173-179`. All correct.

**2. depends_on `[STORY-fe-001]` confirmed.** fe-003 reads exactly the fe-001-released per-port store + localhost-gated resolution; contract intact. **No peer `## Revisions` block** — no in-feature cross-domain contract change (the cross-FEATURE w1 seam is channel-locked, not a depends_on edge), as you predicted.

**3. Contrarian dispositions** (format `**PO disposition:** VERDICT. rationale`, no dash):
- **Finding 1 (saveReport no-emit gap, concern) → PROMOTE_TO_AC.** Took your fuller recommendation: added BOTH `saveReport_noController_noEmit` AND `saveReport_emptyReport_noEmit` to `## Unit tests` (a) + a matching `## How we validate` checklist line. Now covers 3 of 4 non-emit branches (failed-POST already had a case). Hardens "only the success branch emits."
- **Finding 2 (best-effort/lossy stream, concern) → ACCEPT_AS_RECOMMENDATION.** Recorded in a new `## Consumer note`. **Action for you:** relay to `w1-dynamic-icon-badge` over the channel — consumer MUST reconcile via released `GET_STATE {count,port}` on a wake point, NOT treat `onChanged` as a complete log.
- **Finding 3 (non-exclusive area + ms-`ts`, note) → ACCEPT_AS_RECOMMENDATION.** Folded into the same `## Consumer note`; no code/contract change (ms-collision absorbed by Finding 2's reconciliation; `ts` not swapped for a counter).

**4. Tests added** (both to `## Unit tests` (a), + 1 validate checklist line):
- `saveReport_noController_noEmit` — every `/resolve` probe fails → `findController` null → early return `:243`; assert record NOT cleared + NO tick.
- `saveReport_emptyReport_noEmit` — empty `report:5101`, returns at `:239` before any probe; assert NO tick.

**5. Promoted:** `status: pending → approved` (only status hop; no validated/released). PO arbitration entry appended to `## Revisions`.

**6. feature.md** — created `## Stories added (post-release)` H2 (placed after `## Stories`, before `## Defects`); appended exactly:
> - 2026-06-19 — STORY-fe-003: emit chrome.storage.session report-count tick at 3 sites (clarification C1; see decision-memo-v2.md)

No other feature.md section touched (released prose frozen).
