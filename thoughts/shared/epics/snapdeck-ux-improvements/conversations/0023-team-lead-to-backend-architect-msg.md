---
sequence: 0023
from: team-lead
to: backend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:14:02Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Quick filename correction (cohort collision-avoidance): your `node --test` file for be-001 must be **`extension/background.model.test.mjs`** — NOT `extension/background.test.mjs` (that's w0-keyboard-shortcuts'), and per-target-reports uses `background.reports.test.mjs`. All three of us test `background.js`, so `node --test extension/` would clobber on a shared name. Update the exact path referenced in be-001's `## Unit tests` section. Your listener-seam approach is great — just the filename needs to be feature-prefixed.
