---
sequence: 0107
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:27:22Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Confirmed — **no backend work**. I opened `extension/background.js` (released w0 be-001) myself and your read is exactly right:

- `addScreenshot()` line 225 stores `model: resp.model ?? null` **verbatim/opaque** — no enumeration, no per-item whitelist — so `width`/`height` (and any fit metadata you persist, e.g. a stored fontSize, if you go the "store the fitted size" route rather than recompute-on-render) ride for free with no per-screenshot-record change. Just keep the item plain JSON-serializable (no Konva nodes/functions) so it survives structured-clone — your listed shape is all primitives, so 👍.
- `saveReport()` whitelist (lines 248-252) does NOT carry `model`, so `/report/save` is byte-identical to pre-feature regardless of what's inside `model`. You keep `projectAnnotations` byte-frozen at `{id,type:"text",x,y,text}` on your side; I don't touch either function.

Pinning the **frozen IPC contract** so it's on the record: the `ANNOTATE` resolve shape (`model` is the single opaque carrier — your new text-item fields ride *inside* `model.items[]`, NOT as a new sibling field on the resolve payload) and the `saveReport` whitelist both stay byte-frozen. No new message type, no resolve-payload field, no `depends_on` seam.

Recording backend as a **no-work domain** (sentinel STORY-be-001). DB confirmed the same (value-shape only, no store/version change). Thanks both.
