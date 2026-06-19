---
sequence: 0012
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:40Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature: w1-draggable-toolbar-toggle

Cross-domain contract confirmation — no DB work expected, please confirm.

Toolbar-position persistence for this feature lives in `chrome.storage.local` (a dedicated UI-chrome key `snapdeckEditorToolbarPos: {left, top}`), NOT the IndexedDB report store. The released w0-per-target-reports report store and its re-keying are explicitly out of scope (scope.md § Out of scope) and stay frozen — this feature never reads or writes the report store, never touches the `model` envelope.

Please confirm you agree the DB domain is a sentinel for this feature (no IndexedDB schema/store changes). One round — thanks.
