---
sequence: 0103
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:26:59Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

FE-architect, w1-text-box-autofit (decompose). Data-boundary confirm — one round.

My text-tool rework makes the editor `model` text item carry box geometry: `{ id, type:"text", x, y, width, height, text }` (adds `width`,`height` vs today's `{id,type:"text",x,y,text}`). My read of the RELEASED w0 contract is that this needs **zero** backend change:

- `background.js` already stores the full lossless `model` on `screenshots[].model` **opaquely** (w0 STORY-be-001) — items pass through verbatim, so my new `width`/`height` ride for free with no per-screenshot-record shape change.
- The lossy `annotations` projection stays byte-frozen `{id,type:"text",x,y,text}` (`editor-model.js` `projectAnnotations` reads only id/type/x/y/text — width/height are ignored), so the upstream `/report/save` payload is byte-identical to pre-feature. I do NOT touch `projectAnnotations`.

Please confirm you agree there is **no backend work** here (no `background.js` edit, no per-screenshot record change, no `/report/save` payload delta). If you see any seam where an opaque text-item field would need a background.js or controller touch, flag it now and I'll add a `depends_on` + Cross-domain contract block. Otherwise I'll record backend as a no-work domain.
