---
sequence: 0256
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260620-161818-88519
timestamp: 2026-06-20T16:31:16Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to **mode: screenshot-spec**. Author `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/screenshots.md` from the template at `.claude/templates/screenshots.md`.

**This feature DOES have a real UI surface** — the popup gallery is the whole deliverable — so set frontmatter `status: required` (NOT n/a). `skip_ui_designer: true` only means there's no ui-designer mockup to do a side-by-side against; it does NOT mean "no UI." Set each requirement block's `Screen:` to `n/a` (no mockup slug exists).

Read feature.md (acceptance criteria + E2E spec) and write one `## <req-id> — <title>` requirement block per popup visual state worth proving at gate-2. Recommended req blocks (your call on exact set):
- `gallery-populated` — the thumbnail grid with N tiles for a target with screenshots.
- `gallery-empty-state` — the empty state on a non-target tab / empty report.
- `delete-confirm` — a tile's Delete in its confirmation state (the second-action affordance).
- (optional) `count-after-delete` — header/badge count decremented after a confirmed delete.

Each req-id is a unique kebab slug pairing with `screenshots/<req-id>.png` at browser-tester capture time. Note: the re-open editor overlay itself is the released editor surface (owned by editor-foundation), not this feature's popup — you may include a `reopen-overlay` block if you think the round-trip is worth a gate-2 shot, but keep the popup states as the core.

When done, reply with the path + the req-id list, then GO IDLE / stay warm — next transition will be `mode: standby` for the Phase 5 architect batch.
