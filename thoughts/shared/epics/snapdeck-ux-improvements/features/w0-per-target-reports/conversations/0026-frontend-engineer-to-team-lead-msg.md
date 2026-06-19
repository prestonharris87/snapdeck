---
sequence: 0026
from: frontend-engineer
to: team-lead
step: inline-msg
run_id: run-20260619-034752-73507
timestamp: 2026-06-19T04:04:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

**fe done — STORY-fe-001 + STORY-fe-002**

**Files changed:**
- `extension/background.js` — re-keyed per-port storage helpers, added `currentTargetPort()`, threaded port through all 5 handlers + capture/save, LOW-1 PROMOTE guard unification, `saveReport` fallback retired
- `extension/background.reports.test.mjs` (new) — 17 node:test cases via node:vm harness
- `extension/background.shortcuts.test.mjs` — fixed 3 `_kv['report']` → `_kv['report:3000']` refs (kb's test regressed by the re-key; fixed)

**node --test result (cumulative):**
`node --test extension/*.test.mjs` → **tests 25 | pass 25 | fail 0**
(17 new reports cases + 8 existing shortcuts cases; both files green)

**Commit:** `db6f7b7`

**Scope notes / no surprises:**
- LOW-1 PROMOTE implemented as required: `addScreenshot` now uses the tight `/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/` regex (matching `currentTargetPort()`), so deceptive hosts write zero `report:*` records. The security test `addScreenshot_deceptiveHost_writesNoRecord` passes.
- `saveReport` uses `currentTargetPort()` at entry, no page-content-derived fallback.
- No diff outside `extension/background.js` + the two test files.
- Smoke deferred (service-worker/IDB plumbing, no rendered UI surface; popup unchanged). E2E coverage intended at Phase 5b browser-tester pass.
- Story frontmatter: both fe-001 and fe-002 set to `in-progress` (validator promotes).
