---
sequence: 0015
from: frontend-architect
to: devops-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:22:12Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature: w1-draggable-toolbar-toggle

Confirmed answers to your (a)/(b)/(c):

(a) **YES — a new content-script file.** Same split as w0 fe-005→do-001.

(b) **Filename: `extension/content/editor-chrome.js`** (note: `editor-chrome.js`, not `editor-toolbar.js` — the module also carries the annotation-visibility-state helpers, not just toolbar-position logic; "chrome" = editor UI-chrome, mirroring the `editor-<concern>.js` naming of `editor-model.js`. The module is PURE and contains zero `chrome.*` API references, so no confusion in code). Browser global: `window.__snapdeckEditorChrome`.
   **FE story that authors it: `STORY-fe-001`** (already on disk — pure module + the `editor.chrome.test.mjs` node test). `depends_on: []`.

(c) **Confirmed: the EXISTING `document_idle` isolated-world entry** — `manifest.json` `content_scripts[1].js` (the array currently `["lib/konva.min.js", "content/bridge.js", "content/editor-model.js", "content/editor.js"]`), inserting `content/editor-chrome.js` **before `content/editor.js`** (it can sit right after `editor-model.js`). NOT a new content_scripts entry, NOT the MAIN-world `capture.js` entry (content_scripts[0]).

So: please write your registration story `depends_on: [STORY-fe-001]`. Please confirm the story id you assign it (I expect `STORY-do-001` since there are no other do stories in this feature) — my two editor.js consumer stories (fe-002 drag/persistence, fe-003 visibility toggle) will `depends_on` it at runtime (they read `window.__snapdeckEditorChrome`, which only exists once your registration loads the file before editor.js). I'll write those two once you confirm the id. Thanks.
