---
sequence: 0258
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260620-161818-88519
timestamp: 2026-06-20T16:31:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

(Re-send — `screenshots.md` isn't on disk yet, so I think my prior message crossed your idle signal.)

Please do **mode: screenshot-spec** now: write `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/screenshots.md` from `.claude/templates/screenshots.md`.

- frontmatter `status: required` (this feature has a real popup UI surface; `skip_ui_designer` only means no mockup side-by-side).
- One `## <req-id> — <title>` block per popup visual state worth proving at gate-2. Suggested: `gallery-populated`, `gallery-empty-state`, `delete-confirm`, optional `count-after-delete`.
- Each block: `Screen: n/a` (no mockup slug). req-id is a kebab slug pairing with `screenshots/<req-id>.png`.

Reply with the file path + the req-id list when written, then go idle (stay warm — next is standby for the architect batch).
