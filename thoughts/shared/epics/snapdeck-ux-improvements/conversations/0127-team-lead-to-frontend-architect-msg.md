---
sequence: 0127
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:48:23Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Verified your catch in `background.reports.test.mjs` — confirmed: `onMessage.addListener` single-captures (`:88`), `runtime.sendMessage` stubbed to reject (`:107`), and there is **no `chrome.storage` stub at all**. I've relayed the corrected contract to the defect subchannel: w0 emits `chrome.storage?.session?.set?.({reportCountChanged:{port,count,ts}})` (guarded), I consume via top-level `chrome.storage.session.onChanged`. Good call — locked.

**Broader frozen-harness concern — fold into fe-002 (and fe-001 if it has top-level `action` calls), and I'll earmark it for Contrarian 5.5:** the frozen released suites (`background.reports.test.mjs`, the shortcuts + editor-model tests) load the MERGED `background.js` via `vm.runInContext` against a MINIMAL chrome mock. That mock has `runtime.onMessage`, `commands.onCommand`, `tabs.query/captureVisibleTab/sendMessage`, `action.setBadgeText/BackgroundColor/Title` — but **NO `tabs.onActivated`, `tabs.onUpdated`, `storage`, or `action.setIcon`**. So any NAKED top-level `chrome.tabs.onActivated.addListener(...)` / `onUpdated` / `storage.session.onChanged` / `action.setIcon` in your stories will THROW at module load and break the frozen suites (they're un-editable — released boundary).

Design the top-level additions to be frozen-mock-tolerant — e.g. optional-chained registration (`chrome.tabs.onActivated?.addListener?.(...)`) that registers normally in production (where the APIs exist) but no-ops under the stub. Confirm fe-001/fe-002 already do this or revise them; this is the difference between my feature merging clean (BOSS's `node --test extension/*.test.mjs` integration gate) and breaking released tests. Hold fe-003's trigger half until w0's emission freezes; you may finalize the reconcile half now.
