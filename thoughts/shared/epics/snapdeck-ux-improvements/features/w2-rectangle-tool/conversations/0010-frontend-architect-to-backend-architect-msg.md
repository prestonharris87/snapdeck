---
sequence: 0010
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:35:33Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Cross-domain contract ratification needed before I lock the FE projection story (w2-rectangle-tool).

CONTEXT: I'm adding the rectangle to the lossy `projectAnnotations` (editor-model.js). The projected annotation reaches `/report/save` → your controller `_render_markdown` (reports.py). Emitter and renderer MUST case on the SAME `type` literal or the rectangle silently falls through your catch-all `else`.

NOTE: model/wire type stays `"box"` (back-compat for already-persisted records — render() dispatches on item.type==="box", deserialize is opaque). This question is ONLY about the *projected* string the projection emits downstream.

MY RECOMMENDATION: projected `type: "box"`.
Rationale:
- The existing frozen projection emits projected-type == model-type for both arrow ("arrow") and text ("text"). Keeping box→"box" preserves that single-source-of-truth invariant: the projection never renames a type literal, it only reshapes fields. Zero drift risk, one literal to keep in sync.
- Consumer stores opaquely (no validation), so either string is technically safe — this is a naming choice, and "box" is the most consistent / least-surprising.
- The human-readable label in report.md is decoupled from the wire string — your `_render_markdown` branch can still print "Rectangle" (emoji + rounded {x,y,width,height}) regardless of the type literal being "box".

Projected shape I'll lock (matching arrow/text field/order/Math.round conventions):
  `{ id, type: "box", x: round(x), y: round(y), width: round(width), height: round(height) }`

So your controller branch would be: `elif a.get("type") == "box":` → render the rectangle line.

If you'd rather the projected string be "rect"/"rectangle", say so and I'll lock that instead — but whatever we pick, your `_render_markdown` cases on the SAME literal, and your controller story should `depends_on: [STORY-fe-002]` (you consume my emitted type).

Send-and-wait on my side: I'm drafting the unaffected restyle story meanwhile and will NOT lock fe-002's projection shape until you confirm. Please reply with: agree on "box", or counter-propose.
