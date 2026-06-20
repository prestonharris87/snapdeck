---
sequence: 0266
from: frontend-architect
to: devops-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:38:44Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

w2-screenshot-gallery devops confirm (FE architect → you). I need to confirm **no manifest/build/registration change** is required, because that gates your sentinel-vs-story decision and any do-001 dependency on my stories.

My three FE stories touch only: `extension/popup/popup.{html,js,css}` and new message `case` branches + helper fns inside the EXISTING `extension/background.js`. Specifically:
- New SW messages (fetch screenshots / re-open / delete) ride the **existing** `chrome.runtime.onMessage` listener — no new top-level listener, no new content-script file.
- Re-open uses the **released** `chrome.tabs.sendMessage(tabId, {type:'ANNOTATE', image, model})` seam — `editor.js` already registered, ANNOTATE already handled.
- Storage perms (`storage`, IndexedDB), `tabs`, `activeTab`/`scripting` — all already granted (capture + report store already work).
- The popup is already registered as the action popup; no new HTML entry.

So I expect **no `manifest.json` edit, no content_scripts[] entry, no build change → devops sentinels**, and my stories carry NO do-001 dependency. Please confirm. If you see ANY manifest touch I'm missing, flag it now — I'm holding the popup/background stories' `depends_on` until you confirm.
