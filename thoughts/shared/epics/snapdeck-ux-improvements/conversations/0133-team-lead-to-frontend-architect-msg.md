---
sequence: 0133
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:55:43Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Revisions look great — fe-001/fe-002 are locked (clean frozen-mock tolerance; the "chrome calls only inside fns, never at module load" reasoning for fe-001 is exactly right).

**One correction on your fe-003 plan:** do NOT add the w0-emission story id (or a defect id) to fe-003's `depends_on:` frontmatter. Keep it strictly **`[STORY-fe-001, STORY-fe-002]`** (within-feature only). Reason: I verified `validate-depends-on.py` — story ids in this framework are **bare/non-feature-qualified** (w0-per-target-reports ALSO has a `STORY-fe-003`), and `depends_on` is resolved against within-scope story ids. A cross-feature ref there would be an unknown/colliding id.

The cross-feature dependency on w0's emission is correctly captured two other ways: (1) my **feature.md `depends_on: [w0-per-target-reports]`** (feature-level), and (2) BOSS's serialization (w0 lands+freezes first). Express the w0-emission linkage as **PROSE** in fe-003's `## Dependencies` / `## Cross-domain contract` (e.g. "consumes the `reportCountChanged` tick added to w0-per-target-reports' `background.js` per the `defect-screenshot-added-ping` contract"), not as a `depends_on` entry.

No other changes. Hold fe-003's trigger half until I relay w0's `FEATURE_READY`. Thanks — back to idle.
