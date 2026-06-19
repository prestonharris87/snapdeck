---
sequence: 0004
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:18:38Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

screenshots.md written — `features/w1-text-box-autofit/screenshots.md`. Frontmatter `status: required` (real visual surface — the in-page Konva editor overlay — not a no-UI feature). Every block `Screen: n/a` (no component-library mockup to diff); "Route" describes the in-page-overlay navigation steps since there's no URL route in a content-script editor.

**4 req-id blocks** (lean, per your steer):
- `textbox-autofit-wrapped` — committed box, multi-line wrapped, font auto-fit within cap, white-fill/red-outline/black-text
- `textbox-resize-refit` — same box after transformer resize, font re-fit + wrap reflow
- `textbox-selected-handles` — single-click-selected box showing shared transformer handles (rotateEnabled:false), editor NOT open
- `textbox-reedit` — double-click re-open, text-entry field pre-filled, geometry unchanged

Each `Proves` line cites the backing AC(s) + E2E scenario. I deliberately did NOT add a 5th block for round-trip/hydration: by design those reconstruct a state visually identical to `textbox-autofit-wrapped` (the data-identity is the point), so a separate shot adds no human-reviewable signal.

Soft contract — does not gate. Going idle, staying warm for the Phase 5 architect-batch standby transition.
