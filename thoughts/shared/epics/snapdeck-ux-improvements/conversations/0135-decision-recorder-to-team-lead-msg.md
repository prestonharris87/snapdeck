---
sequence: 0135
from: decision-recorder
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:58:50Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Decision memo written.

**Path:** `thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/decision-memo-v1.md`
**Version:** v1
**Conversation files synthesized:** 22 (feature-scoped, `features/w1-draggable-toolbar-toggle/conversations/0001–0022`)
**Stories surveyed:** 6 (STORY-fe-001/002/003, STORY-do-001, STORY-be-001, STORY-db-001)

**Top resolved tension (for gate-1 summary):** PO arbitrated the contrarian's "4 Konva layers, not 2" finding (fe-003 Finding 1) by expanding the toggle to hide all 3 overlay layers (`annLayer` + `selectLayer` + `cursorLayer`) and extending the `finish()` export guard to restore all 3 before `toDataURL` — framed as intent-fidelity (the value prop is "inspect the raw screenshot") rather than scope creep. Sources: STORY-fe-003 § Revisions; conv 0022 § 2.

Ready for shutdown.
