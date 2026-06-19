---
sequence: 0093
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:17:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to mode: screenshot-spec.

This feature is non-UI (`skip_ui_designer: true`, `frontend_lane: N/A`) — it has no DOM/HTML surface; the only visual artifact is the toolbar icon + numeric badge, which the ui-designer/screenshot pipeline doesn't capture.

Therefore: author `thoughts/shared/epics/snapdeck-ux-improvements/features/w1-dynamic-icon-badge/screenshots.md` from the template at `.claude/templates/screenshots.md` with frontmatter `status: n/a`, **no requirement blocks**, and a one-line body explaining why (service-worker / `action`-API toolbar icon + badge; no capturable page surface; behavior is proven by the unit + E2E specs in feature.md, not by screenshots).

Reply with the path when written, then go idle (stay warm — Phase 5 `standby` transition is next).
