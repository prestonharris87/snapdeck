---
sequence: 0001
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:46:46Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

✅ `feature.md` written for **w0-keyboard-shortcuts** (Shape B, expanded from locked scope.md).

**H2 contract rendered verbatim, in order:**
- Summary
- User-facing behavior
- UX patterns / interaction notes (notes the non-UI nature: no new screens; only "UI" is the existing annotate overlay + the result signal)
- Acceptance criteria (`- [ ]` checklist)
- E2E test spec (written by Product Owner) — incl. Motion E2E
- In scope (rendered from scope.md)
- Out of scope (rendered from scope.md)
- Stories (populated by architects) — empty placeholder
- Defects (populated as found) — empty placeholder

**Counts:** 9 acceptance criteria · 5 E2E scenarios (Given/When/Then).

**E2E scenarios:** (1) shortcut captures on localhost target w/o popup → report N+1; (2) non-target tab → no capture, popup-independent visible signal, no silent failure; (3) shortcut re-binds after MV3 service-worker wake AND report persists across restart; (4) cancelled annotate → report unchanged, no false signal; (5) manifest binding is focus-only (`Ctrl+Shift+S`/`Command+Shift+S`, no `"global": true`).

**Motion E2E: n/a** — stated explicitly (manifest + background-worker feature, no animated surfaces of its own).

**Frontmatter:** `frontend_lane: N/A` · `status: planning` · `wave: 0` · `depends_on: []` · `last_run_id: run-20260619-023636-42973`.

**Contract honored:** ACs lock `addScreenshot()` as zero-arg / called-as-is, top-level `chrome.commands.onCommand` registration, and an explicit "no changes to report storage / IndexedDB / `report` record shape" criterion (caller-only; defers to sibling `w0-per-target-reports`). The popup-independent visible signal (badge/notification) is an AC + dedicated E2E, with exact mechanism left to the architect — only non-silence locked.

No stories or mockups written (downstream). Ready for architect Phase 5.
