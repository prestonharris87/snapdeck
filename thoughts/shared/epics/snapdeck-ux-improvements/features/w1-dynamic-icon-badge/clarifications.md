# Clarifications — w1-dynamic-icon-badge

> Exception-based clarification log. `auto-resolved` entries are recorded for
> audit only (the orchestrator does not pause). `needs-user-input` entries
> pause the run.

## CLAR-001 — Orange / gray icon-state color tokens (auto-resolved)

- **Status:** auto-resolved
- **Raised by:** frontend-architect (2026-06-19)
- **Context:** scope.md + AC13 say "anchor green to the existing `#1E8E3E` badge
  token; select an orange and a gray per `design.md`." `design.md` is a pointer
  doc and `design-baselines.md` pins **no** dedicated orange or gray brand token
  — the only concrete color tokens in the Snapdeck codebase are the in-code badge
  hexes `#1E8E3E` (green, `background.js:151`) and `#C0392B` (red error,
  `background.js:133/143`).
- **Decision:** Select two values consistent with the existing Material-family
  palette (the green `#1E8E3E` and red `#C0392B` are Material-700-family hues),
  anchored so the three states are clearly distinct at 16px:
  - **green** = `#1E8E3E` (existing badge token — REQUIRED anchor per AC13)
  - **orange** = `#E37400` (Material amber/orange 700-family; icon tint + badge
    background; pairs with Chrome's default light badge text for contrast)
  - **gray** = `#5F6368` (Material gray 700; reads as "inactive/not-a-target"
    while staying legible at 16px — distinct from green)
- **Rationale:** Unblocks shipping; honors the AC13 green anchor; avoids
  inventing a *named* token (these are inline state-color constants in
  `background.js`, mirroring how the released `runCaptureCommand()` flash already
  uses inline `#1E8E3E`/`#C0392B`). If a dedicated orange/gray design token is
  later added to the token reference, the engineer/validator may swap these
  constants to reference it — no behavior change.
- **Routing:** Recorded for audit; no pause required.
