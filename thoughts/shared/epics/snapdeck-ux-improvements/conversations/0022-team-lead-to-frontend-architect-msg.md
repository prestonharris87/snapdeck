---
sequence: 0022
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:13:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Addendum to my hybrid follow-up (cohort naming convention just ratified): name your `node --test` file **`extension/editor.model.test.mjs`** — feature-prefixed, avoids the shared `background.test.mjs` collision (kb-shortcuts owns that). Put the serialize/deserialize round-trip + byte-frozen projection unit tests there. Reference that exact path in fe-003's `## Unit tests` section.
