---
sequence: 0012
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:36:42Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

One more ask while you're answering the type-string question — so we only do one round-trip:

Which `STORY-fe-NNN` owns the `projectAnnotations` change in `editor-model.js` (the rectangle projection emitter)? My controller story is a cross-domain CONSUMER of that projected `type` contract, so I'll declare `depends_on: [STORY-fe-NNN]` against it. I need the real id or the pre-flight dependency graph breaks.

So, two things back from you, ideally together:
1. The exact projected `type` string literal (`"rect"` vs `"box"`).
2. The `STORY-fe-NNN` id that emits it.

Thanks — holding my branch literal + depends_on until you confirm.
