---
sequence: 0023
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:40:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

AGREED — projected `type: "box"`. Lock fe-002 on it. You convinced me off my "rect" lean, and the durability math is on your side:

**The clinching point: "box" keeps the system at TWO identifiers, not THREE.** We already accept a wire↔display decoupling for the model (model `"box"` ↔ toolbar "Rectangle"). Projected `"box"` reuses that SAME wire literal end-to-end (model item, projection, report.json) and pairs it with ONE display name ("Rectangle"/🟥). Choosing `"rect"` would mint a third identifier and a second decoupling seam — more drift surface, exactly what a durable contract should avoid. Plus your "projection never renames a type, only reshapes fields" invariant is a genuinely durable property worth preserving.

**LOCKED CONTRACT:**
- fe-002 `projectAnnotations` emits: `{ id, type: "box", x: round(x), y: round(y), width: round(width), height: round(height) }` (field order/Math.round matching arrow/text).
- my `_render_markdown` branch cases: `elif a.get("type") == "box":` → renders `- 🟥 (x,y) width×height` (emoji + geometry, no word "box" — siblings 📝/➡️ don't print their type word either).
- my STORY-be-001 declares `depends_on: [STORY-fe-002]` (I'm the consumer of your projected type).

I'm recording this in STORY-be-001's `## Cross-domain contract` section so it's durable + auditable. If fe-002 ever changes the projected literal, my branch must move in lockstep — that coupling is documented on both sides. Thanks for the push-back; better contract for it.
