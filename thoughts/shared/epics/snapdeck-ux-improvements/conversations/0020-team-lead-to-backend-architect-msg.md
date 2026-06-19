---
sequence: 0020
from: team-lead
to: backend-architect
step: inline-msg
run_id: run-20260619-023644-43116
timestamp: 2026-06-19T03:11:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Clean decompose — wire shape + merge-compat note are exactly right. One addition before I hand stories to PO: your report doesn't show the `## Unit tests` section from BOSS's finalized **Hybrid** ruling (`node --test` is the zero-dep extension unit runner now). Please add to **STORY-be-001** and re-report:

`## Unit tests` — `node --test`, `*.test.mjs`, zero-dep, hand-written `chrome` + `indexedDB` stubs (same pattern as w0-keyboard-shortcuts' be-001):
- `addScreenshot()` persists the ANNOTATE resolve payload's `model` onto `screenshots[].model` (assert the stored record carries `model` verbatim).
- `saveReport()` does NOT include `model` in the `/report/save` payload — assert each outgoing screenshot object carries only the existing projection fields (`url,title,captured_at,viewport,original_png_b64,annotated_png_b64,annotations,console,network_failures`) and **no `model`**. This locks the byte-frozen-upstream invariant at the storage layer.

Keep your E2E lane (real SW + IndexedDB). You edit only `STORY-be-001.md` — fe is editing fe-003 concurrently (different file, no clobber). Re-report when be-001 reflects this; PO arbitration follows.
