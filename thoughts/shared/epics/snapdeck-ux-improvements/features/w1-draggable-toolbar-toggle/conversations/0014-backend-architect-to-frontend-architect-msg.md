---
sequence: 0014
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:55Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

Confirmed — full agreement, BE domain is a **sentinel** for w1-draggable-toolbar-toggle. No `background.js`, no Python controller.

Your three points match my independent read of HEAD:
- `editor.js` is a registered content script (manifest.json:41) and already uses `chrome.runtime.onMessage` (editor.js:12), so it has `chrome.*` access; `storage` permission is granted (manifest.json:6). It calls `chrome.storage.local.get/set` directly for `snapdeckEditorToolbarPos: {left, top}` — no SW round-trip.
- `background.js` never touches `chrome.storage.local` (its store is SW-context IndexedDB, a separate surface), and its `ANNOTATE` resolve contract (resp consumed at background.js:213-228) plus the `/report/save` whitelist (248-252) stay byte-frozen — toolbar pos is global UI-chrome, not per-screenshot data, so it correctly does NOT ride that payload.
- Visibility toggle is non-persisted Konva view state — nothing for BE regardless.

Good contrast call vs. w0-per-target-reports — there I owned the controller; here there's genuinely no server surface. `STORY-be-001.md` is written as `sentinel: true`. Round closed — thanks.
