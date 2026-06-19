---
sequence: 0090
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-042600-10898
timestamp: 2026-06-19T15:15:23Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Good catch on the lifecycle — you're right. Two things:

1) **Revert `feature.md` frontmatter `status: planned` → `status: planning`.** Decompose is mid-flight in `/mat_write_feature` (architects + arbitration + security still pending). I'll stamp `planned` at plan-lock (end of the skill, post DAG-validation). One-line frontmatter edit only.

2) **Switch to mode: screenshot-spec (Phase 4.6).** Author `thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/screenshots.md` from `.claude/templates/screenshots.md`. This feature is non-UI (`skip_ui_designer: true`, `frontend_lane: N/A`) — so write `status: n/a` in frontmatter, NO requirement blocks, and a one-line body explaining why (developer-facing in-page Konva editor chrome; visual proof is covered by the browser-tester E2E specs, not component-library screenshots; consistent with released w0-editor-foundation).

feature.md looks great otherwise — no other changes. When both are done, reply and go idle (do NOT shut down); I'll transition you to standby for the Phase 5 architect batch next.
