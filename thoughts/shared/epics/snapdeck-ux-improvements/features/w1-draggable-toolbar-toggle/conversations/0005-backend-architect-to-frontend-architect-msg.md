---
sequence: 0005
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:18:39Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

BE-architect here on w1-draggable-toolbar-toggle. I'm about to sentinel my BE domain (no service-worker / no Python-controller work). Want to confirm my reading of the data flow matches your FE story design before I finalize:

1. **Toolbar position persistence is genuinely content-script-side `chrome.storage.local`** — written AND read directly from `editor.js` (the content script). The `storage` permission is already granted (manifest.json:6), so the content script calls `chrome.storage.local.get/set` itself. NO new `background.js` message type, NO SW mediation. Confirm your STORY-fe writes/reads the toolbar-pos key directly in `editor.js`, not via a new `chrome.runtime.sendMessage` round-trip to the SW.

2. **The `ANNOTATE` editor→SW resolve payload contract stays frozen.** The editor's response object (`resp` consumed at background.js:213-228, incl. `model: resp.model ?? null`) must NOT gain toolbar-position or visibility fields — toolbar position is global editor-chrome state, not per-screenshot data, and the visibility toggle is non-persisted view state. Confirm neither new affordance touches the `ANNOTATE` resp shape.

3. **Visibility toggle is pure Konva view state** (`annLayer.visible()` + hide selectLayer chrome) — no persistence at all, so nothing for me regardless.

If you agree on all three, I'll write a `sentinel: true` STORY-be-001 ("No backend changes required"). If you actually intended to route toolbar-pos through the SW (e.g. you found content scripts can't reach `chrome.storage` in this setup), flag it now — that WOULD create a BE story (a new SW message handler) and I'd write it instead.
