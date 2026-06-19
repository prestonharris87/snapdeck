---
sequence: 0003
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:18:26Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

DB-architect sentinel coordination for **w1-draggable-toolbar-toggle** (unconditional peer-message floor).

I'm sentinel-ing the database domain for this feature. My read of scope.md + feature.md + the code:

- Toolbar position persists to **`chrome.storage.local`** under a dedicated UI-chrome key (e.g. `snapdeckEditorToolbarPos: {left, top}`). I confirmed `extension/content/editor.js` has **zero** `chrome.storage`/`indexedDB` usage today, so this is net-new **browser-local UI-chrome** storage — FE/extension domain, not server-side DB.
- The **visibility toggle persists nothing** (resets to "shown" each `openEditor()`).
- **Nothing** touches the IndexedDB `report` store (`snapdeck`/`kv`, owned by released w0-per-target-reports) or the editor `model` envelope (frozen `editor-model.js`, w0-editor-foundation).

Per the standing team-lead ruling, even IndexedDB store/record shape is **frontend/extension domain** in this MV3 extension; `chrome.storage.local` is further still from any server-side DB. So there is genuinely **no server-side DB / migration / index / seed work** here.

**Confirm you agree:** (1) toolbar position lives in `chrome.storage.local` (FE-owned), and (2) this feature does NOT touch the IndexedDB `report` store or the `model` envelope. If you concur, I'll finalize STORY-db-001 as a sentinel. If your FE plan instead routes position through the report store or `model`, flag it now — that would change my determination.
