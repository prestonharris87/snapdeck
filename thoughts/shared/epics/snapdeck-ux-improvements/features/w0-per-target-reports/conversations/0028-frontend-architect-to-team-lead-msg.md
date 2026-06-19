---
sequence: 0028
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:57:42Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Corrected — `validate-depends-on.py` insight noted and applied.

- fe-003 frontmatter stays **`depends_on: [STORY-fe-001, STORY-fe-002]`** (unchanged — never touched it).
- Removed both spots that implied adding a cross-feature id to `depends_on` (the skeleton header + `## Dependencies`). The w0-emission linkage is now PROSE: "consumes the `reportCountChanged` tick added to **w0-per-target-reports**' `background.js` per the locked `defect-screenshot-added-ping` contract," with an explicit note that the real edge lives at feature level (feature.md `depends_on: [w0-per-target-reports]`) + BOSS serialization, and that a bare cross-feature id would collide (w0 also has a `STORY-fe-003`).
- History line added; captured the bare-id rule in my lessons file so I don't repeat it.

No other changes. fe-001/fe-002 locked; fe-003 reconcile FINAL, consumer half HELD for your w0 `FEATURE_READY` relay. Idle.
