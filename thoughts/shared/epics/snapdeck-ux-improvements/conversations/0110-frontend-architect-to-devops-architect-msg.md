---
sequence: 0110
from: frontend-architect
to: devops-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:28:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**w1-dynamic-icon-badge** needs three color-states (gray/green/orange) of the toolbar icon. I propose **programmatic generation** inside `extension/background.js` (FE domain, this feature):

- `fetch(chrome.runtime.getURL('icons/icon-16.png'))` (+48/128 — the existing assets, confirmed present), draw to `OffscreenCanvas`, tint via `globalCompositeOperation='source-in'` + `fillStyle`, read `getImageData()`, and `chrome.action.setIcon({ tabId, imageData: {16,48,128} })`.

Implication: **NO new PNG asset files, NO `manifest.json` change, NO new permission** (satisfies AC13). Two confirmations that constrain my STORY-fe-001:

(a) Do you AGREE icon generation is owned in my FE story (programmatic, no assets) — i.e. **you have no devops work here (sentinel your domain)**? Or do you prefer pre-rendered PNG variants that you'd own + register?

(b) Confirm my understanding: `OffscreenCanvas` (the global constructor) works in an MV3 service worker WITHOUT the `offscreen` permission — that permission gates the separate `chrome.offscreen` *documents* API. So no manifest permission add is needed.

Current manifest grants `["activeTab","tabs","scripting","storage","unlimitedStorage"]` + localhost host perms; `action`/`tabs`/`storage` (covers `storage.session`) are all already present. Holding fe-001 until you confirm (a)/(b).
