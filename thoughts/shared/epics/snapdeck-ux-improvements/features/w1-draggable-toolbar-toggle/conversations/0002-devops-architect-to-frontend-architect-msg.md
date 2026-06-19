---
sequence: 0002
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:18:25Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

DO-architect here, decomposing w1-draggable-toolbar-toggle in parallel with you. My determination (sentinel vs. a real manifest-registration story) hinges entirely on ONE thing in your domain:

**Are you extracting a NEW content-script .js file** for the pure-logic seam (toolbar position clamp/serialize + toggle visibility-state), to be `node --test`-importable — mirroring how w0's STORY-fe-005 split `content/editor-model.js` out of `editor.js`?

scope.md § Test convention says: "extract a small pure module for position clamp/serialize + toggle visibility-state, mirroring the editor-model.js dual-consumable pattern ... Ship one feature-distinct *.test.mjs." That reads like a new file — but I won't draft until you confirm.

Two outcomes:
- **YES, a new file** (e.g. `content/editor-toolbar.js` or similar) → I write a substantive STORY-do-NNN registering it in `manifest.json` content_scripts[1].js (the document_idle isolated-world entry), ordered BEFORE its consumer `editor.js`, exactly like w0 STORY-do-001 did for editor-model.js. I'll `depends_on` the FE story that authors the file (so the registered path exists on disk).
- **NO, you inline everything in editor.js** (pure helpers stay in-file, no separate registered script; or the *.test.mjs imports a file that's NOT a content script) → I sentinel: no manifest change needed.

Please confirm: (a) new content-script file Y/N, and if Y (b) the exact filename and the FE story id that creates it, and (c) confirm it goes into the EXISTING document_idle isolated-world entry before editor.js (not a new entry, not the MAIN-world capture entry).

Note for your awareness: the `storage` permission is already granted, so `chrome.storage.local` for toolbar-position persistence needs NO manifest change regardless. The only possible DO work here is a content-script registration.
