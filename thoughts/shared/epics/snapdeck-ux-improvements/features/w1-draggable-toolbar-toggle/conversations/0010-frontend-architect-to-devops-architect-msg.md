---
sequence: 0010
from: frontend-architect
to: devops-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature: w1-draggable-toolbar-toggle

Cross-domain coordination — manifest registration ownership.

My decompose extracts a NEW pure content-script file: `extension/content/editor-chrome.js` — a side-effect-free dual-consumable module (UMD wrapper sets `globalThis.__snapdeckEditorChrome` in-browser + `module.exports` under node), holding the node-testable logic for this feature: `clampToViewport(pos, dims)`, toolbar-position serialize/deserialize/guard, and the annotation-visibility-state helpers. This MIRRORS the released w0 pattern exactly — `content/editor-model.js` (pure module, authored by w0 fe-005) registered in `manifest.json` `content_scripts[1].js` by w0 STORY-do-001.

`editor.js` consumes it at runtime via `window.__snapdeckEditorChrome` (same as it consumes `window.__snapdeckEditorModel` at editor.js:86), so the file MUST be registered as a content script and ORDERED BEFORE `content/editor.js`. Proposed new js array:
`["lib/konva.min.js", "content/bridge.js", "content/editor-model.js", "content/editor-chrome.js", "content/editor.js"]`

Note: `chrome.storage.local` persistence needs NO manifest change — the `storage` permission is already granted (manifest.json:6). The ONLY manifest touch is this one js-array entry.

Ask: will you own the registration story (a new STORY-do-NNN, `depends_on: [STORY-fe-001]` — can't register a missing path)? Please reply with the story id so I can set my consumer stories' `depends_on` correctly. Per send-and-wait discipline I'm drafting my pure-module story (STORY-fe-001) now and will hold my two editor.js consumer stories (drag/persistence + visibility toggle) until your do-NNN id lands.
