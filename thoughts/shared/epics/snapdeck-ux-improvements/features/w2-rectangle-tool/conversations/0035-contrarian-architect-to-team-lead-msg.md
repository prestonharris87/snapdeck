---
sequence: 0035
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:50:27Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Phase 5.5 stress-test of `w2-rectangle-tool` complete. Verdict: **0 block, 1 concern, 2 info** — calibrated for a well-negotiated feature. Wrote `features/w2-rectangle-tool/stress-test.md` + `## Contrarian Findings` blocks on STORY-fe-002 and STORY-be-001.

**Your #1 stated risk is VERIFIED CLEAN.** No test beyond `editor.model.test.mjs:88-101` asserts box-excluded, and no test asserts the blue stroke:
- `background.editormodel.test.mjs:188` & `editor.textbox.test.mjs:117` carry `box` fixtures but exercise only storage/round-trip — neither calls `projectAnnotations`. fe-002's `files_modified` (editor-model.js + editor.model.test.mjs) covers the *only* projection-coupling test.
- `#1e88e5` appears only in `editor.js` source (`:328`, `:403`), never in a test/spec. fe-001 restyle has zero test coupling.
- Box projection is purely additive (`editor-model.js` if/else-if) → arrow/text byte-frozen entries safe. Confirmed.
- `_render_markdown` (`reports.py:220-228`) is the **only** annotation-type-discriminating consumer in the repo (MCP server + core.py/server.py are opaque) → no hidden downstream type-switch breaks.

**The one concern (top cross-cutting):** the `type:"box"` literal coupling between fe-002 (JS emitter) and be-001 (Python `_render_markdown`) is documented "must move in lockstep" on both sides but **guarded by no test** — each suite hard-codes its own copy, no test runs real-emitter→real-renderer. A future single-sided rename leaves both suites green while the rectangle silently falls through the controller's raw-dict `else` into a `- {...}` dump in report.md. Rec for PO arbitrate: accept as `## Acknowledged Risk`, or adopt a shared contract fixture both suites load (or make the PO E2E a true end-to-end check). Today it's correct — this is decay-under-change, hence concern not block.

**Two info:** (fe-002) `projectAnnotations` has no finite/≤0 geometry guard unlike `renderBox`, so a malformed hydrated box is skipped at render but projected as null/coerced garbage on Done — low reachability, cosmetic. (be-001) client/controller version skew → old controller renders raw-dict in report.md (report.json unaffected).

db-001 and do-001 sentinels: no findings — verified the value-vs-schema and no-new-content-script reasoning holds. One pass; exiting. Findings flow to architects via PO arbitrate.
