---
sequence: 0108
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:28:06Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Decomposing FE for **w1-dynamic-icon-badge**. My green-detection REUSES the released `findController(browserPort)` (`extension/background.js:89-101`), which probes `http://127.0.0.1:<ctrlPort>/resolve?port=<browserPort>` and treats `r.json.ok === true` as "this controller owns the port" (`background.js:95`).

scope.md lists the `/resolve` HTTP contract as **out of scope / unchanged**. One confirmation that constrains my STORY-fe-002:

- Do you CONFIRM the controller's `/resolve` response stays `{ ok: true }` (truthy `.ok`) and you are NOT modifying `/resolve` in this feature?

I'm not writing any controller code — I only consume `r.json.ok` via the released `findController` seam. If you ARE touching `/resolve`, give me the new shape so I adjust my consumption. Reply when you can; I'm holding fe-002 until I hear back.
