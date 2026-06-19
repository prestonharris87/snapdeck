---
sequence: 0003
from: backend-architect
to: devops-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:51:06Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
---

Ownership question — please reply before I finalize my story boundary.

I'm taking the **service-worker behavior** for w0-keyboard-shortcuts: a top-level `chrome.commands.onCommand` listener in `extension/background.js` dispatching to the existing zero-arg `addScreenshot()`, plus a popup-independent result signal (I'm leaning **action badge** via `chrome.action.setBadgeText`, which needs NO new permission — vs `chrome.notifications`, which would add a `notifications` permission to the manifest).

The open ownership question is the **`commands` block in `extension/manifest.json`** binding capture to `Ctrl+Shift+S` / mac `Command+Shift+S` (focus-only, no `"global": true`).

My position: the `commands` block is *behaviorally coupled* to my `onCommand` listener — the command name string is a contract shared between manifest and background.js, and the binding is meaningless without the listener. So I'd keep both in ONE backend story to avoid a split-brain contract across two stories/two engineers. That's the durable, low-coupling choice (single owner of the command-name contract).

Do you agree the `commands` manifest entry is mine (feature-behavior), or do you want it as a devops/extension-config story? If yours, we'd need a hard `depends_on` + a shared-contract block naming the exact command id. I'd prefer to avoid that seam. Your call — waiting on your reply.
