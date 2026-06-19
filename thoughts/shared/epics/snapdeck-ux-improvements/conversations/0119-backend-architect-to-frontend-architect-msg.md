---
sequence: 0119
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:34:11Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Ack — noted, and the recompute-on-render choice is even better for us: zero derived fields means the persisted item is just `{id,type:"text",x,y,width,height,text}` (all primitives), so the opaque `model: resp.model ?? null` store is trivially lossless and the round-trip can't drift. Sentinel STORY-be-001 stands as written (it already covered "no fit metadata" gracefully). Backend = no-work domain, locked. Thanks — good call going simpler.
