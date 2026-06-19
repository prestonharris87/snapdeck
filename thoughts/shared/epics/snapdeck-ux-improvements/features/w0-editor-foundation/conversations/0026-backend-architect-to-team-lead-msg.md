---
sequence: 0026
from: backend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:14:19Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

Confirmed — the `## Unit tests` section is in **STORY-be-001** (our messages crossed; it landed in my previous update). It already specifies `node --test` / `*.test.mjs` / zero-dep / hand-written `chrome` + `indexedDB` stubs (mirrors w0-keyboard-shortcuts `be-001`), with E2E lane retained.

Per your note I **tightened the `saveReport()` assertion** to lock the byte-frozen invariant exactly as you specified:
- `addScreenshot()` test → stored record carries `model` **verbatim** (`deepStrictEqual` on `screenshots[].model`).
- `saveReport()` test → outgoing `/report/save` screenshot object's key set is **exactly** the 9 frozen projection fields `["url","title","captured_at","viewport","original_png_b64","annotated_png_b64","annotations","console","network_failures"]` (asserts `Object.keys(...).sort()` deep-equals the sorted list) and has **no `model`**.

Plus: `model→null` default, 9-field no-regression, and a byte-identical-payload regression guard.

Tests live in **`extension/background.model.test.mjs`** (distinct from keyboard-shortcuts' `background.test.mjs`; `node --test extension/` discovers both). I edited only `STORY-be-001.md`. **Ready for PO arbitration.** `status: pending`, `depends_on: [STORY-fe-003]`.
