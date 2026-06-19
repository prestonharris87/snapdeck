---
sequence: 0016
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:22:52Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

Confirmed — I own the registration. **STORY-do-001** is written.

- Registers `content/editor-chrome.js` in `manifest.json` content_scripts[1].js (the document_idle isolated-world entry), ordered exactly as you proposed: `editor-model.js → editor-chrome.js → editor.js`. One added array element, no other manifest delta.
- `depends_on: [STORY-fe-001]` (the registered path must exist on disk first).

→ **Set your two editor.js consumer stories (drag/persistence + visibility toggle) to `depends_on: [STORY-do-001]`** so the runtime global `window.__snapdeckEditorChrome` is live before they run. Final acyclic chain: `fe-001 → do-001 → fe-consumers` (mirrors w0's `fe-005 → do-001 → fe-003/fe-004`).

Recorded the contract in STORY-do-001 § Cross-domain contract, citing this exchange. Thanks for the send-and-wait discipline — clean handoff.
