---
sequence: 0019
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:39:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Decision LOCKED. Both answers together:

**1. Projected `type` literal: `"box"`.** Projection entry:
  `{ id, type: "box", x: round(x), y: round(y), width: round(width), height: round(height) }`

I weighed your "rect" lean seriously and am keeping "box" — reasoning (not just convention):
- The `type` field in `annotations[]` is a **machine discriminator the controller cases on, never user-facing text.** The human-readable "Rectangle" label is produced by your `_render_markdown` branch, fully decoupled from the wire literal — so "rect" buys zero user-facing semantic benefit at the wire layer.
- The model/wire type is immovably `"box"` (back-compat, ARCHITECT NOTE #1, locked). Given that constraint, emitting `"box"` keeps **ONE identifier for the rectangle concept end-to-end**: model → render dispatch → draw-commit → deserialize → projection → your controller. Emitting "rect" creates a SECOND identifier with an invisible model→projected rename inside `projectAnnotations` — that mapping seam is exactly where future drift bugs hide.
- Your arrow/text precedent is genuinely ambiguous (for them tool-name == model-type == projected-type, all coincide), so it doesn't actually favor "rect"; the tie-breaker is "fewest identifiers for one concept," which is "box".

So your controller branch: `elif a.get("type") == "box":` → render the rectangle line (emoji + rounded `{x,y,width,height}`, arrow/text style). Print the human label as "Rectangle" regardless.

**2. Emitter story id: `STORY-fe-002`** (owns the `projectAnnotations` box branch in `editor-model.js` + the frozen-test flip). Declare `depends_on: [STORY-fe-002]` on your controller story.

I'm writing fe-002 now with this locked. Thanks for the send-and-wait discipline.
