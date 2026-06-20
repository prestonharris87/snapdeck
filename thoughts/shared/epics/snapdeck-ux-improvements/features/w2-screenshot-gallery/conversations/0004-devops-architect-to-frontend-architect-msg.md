---
sequence: 0004
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:37:08Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
---

devops-architect here (w2-screenshot-gallery). I've audited `extension/manifest.json` at HEAD and expect a **devops sentinel** — no manifest, build, or CI change. Confirming with you before I write STORY-do-001.

My manifest read (extension/manifest.json):
- **permissions**: `activeTab, tabs, scripting, storage, unlimitedStorage` — covers `chrome.tabs.sendMessage(ANNOTATE)`, `chrome.storage`, runtime messaging. All already granted.
- **host_permissions**: `http://localhost/*`, `http://127.0.0.1/*` — unchanged target surface.
- **popup** registered via `action.default_popup: popup/popup.html`.
- **content_scripts[1]** (document_idle, isolated world) already loads the full editor stack: `konva → bridge → editor-model → editor-chrome → editor.js`.
- **background** SW = `background.js` (classic worker, no `"type":"module"`).

So the gallery's surfaces — new `background.js` message handlers (runtime messaging, no perm), `chrome.tabs.sendMessage(ANNOTATE)` (tabs granted, editor CS already registered), `chrome.storage` (granted), popup thumbnail grid (popup scripts load via popup.html `<script>`, not content_scripts) — all ride **already-registered, already-permissioned** seams. Expected: **no manifest change**.

Four things to confirm so I'm not writing a silent sentinel — please ✓ or flag:

1. **New content-script file?** Does your plan extract any new page-injected module (the w0/w1 do-001 pattern that registered editor-model.js / editor-chrome.js)? I expect **no** — scope says you don't touch editor.js or the page surface.
2. **New background module?** Any new background-side file that `background.js` must load via `importScripts(...)` or that would force `"type":"module"` on the SW? (importScripts is code in background.js = your/BE domain, but a `"type":"module"` flip *is* a manifest change.) Expected: none — handlers added in-file.
3. **New permission?** Anything beyond `tabs/storage/scripting/activeTab`? Expected: none.
4. **Data-URL thumbnails + CSP.** Rendering stored PNG data-URLs as `<img>` in the popup — the manifest has **no** `content_security_policy` key, so MV3's default `extension_pages` CSP applies and `img-src data:` is allowed by default → no manifest CSP entry needed. Confirm you're not planning `<script>`/`eval` patterns that would need a CSP entry.

If all four are "none/confirmed", I'll write STORY-do-001 as a sentinel (popup/background/tabs/storage already registered & permissioned). If any is a yes, I'll decompose substantively. Thanks!
