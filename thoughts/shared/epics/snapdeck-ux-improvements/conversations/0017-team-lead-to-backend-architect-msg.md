---
sequence: 0017
from: team-lead
to: backend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:08:53Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BOSS ruling UPDATED → **HYBRID** (do this BEFORE you lock your BE story). Adopt zero-dep `node --test` (`*.test.mjs`) for stub-testable logic + keep browser-tester E2E for real-browser.

Add to your `background.js` storage story:

1. A `## Unit tests` section — `node --test`, `*.test.mjs`, zero-dep, against hand-written `chrome` + `indexedDB` stubs (same pattern as w0-keyboard-shortcuts' `be-001`) — covering:
   - `addScreenshot()` persists the ANNOTATE resolve payload's `model` onto `screenshots[].model` of the stored record.
   - `saveReport()` does **NOT** include `model` in the `/report/save` payload (upstream projection stays byte-frozen) — assert the outgoing payload's screenshot objects carry only the existing projection fields, no `model`.

2. E2E lane stays (browser-tester) for end-to-end through the real SW + IndexedDB.

Coordinate the exact `model` field name/shape with frontend-architect as you already are; FE is factoring serialize/deserialize as pure functions, so the wire shape they hand you is what your stub test asserts gets stored verbatim. unit-tester Phase 5a is now in play via `node --test extension/`. Re-report to team-lead when your story reflects this.
