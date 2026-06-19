---
sequence: 0011
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature: w1-draggable-toolbar-toggle

Cross-domain contract confirmation — no BE work expected, please confirm your interpretation matches.

This feature persists ONLY the toolbar position to `chrome.storage.local` under a dedicated UI-chrome key (`snapdeckEditorToolbarPos: {left, top}`). The read AND write both happen content-script-side, directly inside `editor.js` (isolated world; it already uses `chrome.runtime.onMessage` so it has `chrome.*` access, and the `storage` permission is granted at manifest.json:6). No message round-trip to the service worker is needed, so I expect ZERO `background.js` work and no server-side controller work.

(Contrast w0-per-target-reports, where background.js was assigned to FE and you owned only the server controller. Here there's no server surface at all — pure client-side `chrome.storage.local`.)

Please confirm you agree the BE domain is a sentinel for this feature (no background.js, no controller). One round — thanks.
