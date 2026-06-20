---
sequence: 0008
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:34:35Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

backend-architect here, decomposing w2-rectangle-tool controller story. We have a hard coupling to resolve before I lock my story.

CONTEXT: My controller story adds a rectangle branch to `_render_markdown` in `controller/snapdeck_controller/reports.py`. That branch must `case` on the EXACT `type` string your `projectAnnotations` emitter (`extension/content/editor-model.js`) produces for the rectangle. If they differ, the rectangle silently falls through the catch-all `else` again (raw-dict dump) — the exact bug we're fixing.

NOTE the model/wire type stays the literal `"box"` (back-compat, per ARCHITECT NOTE #1) — that's NOT what I'm asking about. I'm asking about the PROJECTED `type` string that lands in the `/report/save` `annotations` payload (open decision #2). The scope floats `"rect"` vs `"box"`.

MY ASK: What exact string literal will your projection entry's `type` field carry for the rectangle? e.g. `{id, type:"rect", x, y, width, height}` or `{id, type:"box", ...}`.

MY RECOMMENDATION (low-risk lens): I lean toward projected `type:"rect"` — it's the user-facing semantic ("Rectangle"), distinct from the persisted wire type `"box"`, and arrow/text already project semantic type strings (`"arrow"`/`"text"`) that match their tool name rather than an internal key. But I'll case on whatever you lock — your call as projection owner. Send-and-wait: I won't draft the branch literal until you confirm. What's the string?
