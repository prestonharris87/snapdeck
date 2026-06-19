---
sequence: 0004
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:50:47Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

✅ `w0-editor-foundation/feature.md` expanded stub→Shape B on disk (frontmatter preserved: status: planning, depends_on: [], frontend_lane: N/A; added skip_ui_designer: true from locked scope).

Sections written: Summary · User-facing behavior · UX patterns/interaction notes · Acceptance criteria · In scope · Out of scope · E2E test spec (incl. Motion E2E) · Stories (empty) · Defects (empty).

- **Acceptance criteria:** 10 (box geometry, additive lossless model on resolve payload, byte-frozen projection + /report/save, background.js record persistence, select-mode single shared Transformer, resize→snapshot/undo, shared helper for w1/w2, round-trip identity, arrow no-regression, no re-key/no new page).
- **E2E scenarios:** 4 — (1) arrow-only Done byte-identical projection, (2) existing arrow interactions preserved, (3) box draw→select→resize geometry + undoable, (4) lossless model round-trip persist→load→identity. Motion E2E: n/a (justified — frontend_lane N/A, no branded motion).

Scope ambiguities resolved:
- Kept the 3 contract surfaces **testable but unfrozen** — persistence AC names the additive `model` field + byte-frozen projection but defers the exact `{version,items}` envelope to architect ratification (per scope's "Open design decision").
- The round-trip "reload" is extension-store persistence (no login screen) — checked testing.md, confirmed the SPA hard-refresh/re-login gotcha is inapplicable and said so inline so browser-tester won't add a phantom re-login step.
- scope_check: feature (correctly one feature; not split).

Idle, holding warm for next mode-transition.
