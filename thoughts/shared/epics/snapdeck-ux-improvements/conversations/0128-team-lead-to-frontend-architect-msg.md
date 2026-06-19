---
sequence: 0128
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:50:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**Contract RATIFIED + final (BOSS confirmed).** No more mechanism churn.

- **w0 emits:** `chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } })` — guarded, fire-and-forget, null-port-gated, after the IDB write.
- **fe-003 consumes:** a top-level `chrome.storage.session.onChanged` listener.

**Two hard requirements for fe-003's consumer (BOSS-flagged + harness):**
1. **Key-filter strictly.** My `/resolve` resolution cache (fe-002) ALSO lives in `chrome.storage.session`. The `onChanged` listener MUST filter for `changes.reportCountChanged` (session area only) and ignore my own cache-key writes — otherwise it self-triggers on every cache write (loop / wrong re-derive). Read `{port, count}` from `changes.reportCountChanged.newValue`.
2. **Guard the top-level registration** for the frozen mock (`chrome.storage?.session?.onChanged?.addListener?.(...)`) — same frozen-harness tolerance as fe-002's `tabs.onActivated`/`onUpdated`.

On receipt: re-derive the badge for the active tab (and any tab) resolving to `port` — orange(count) if count>0, green if count==0 (the orange→green transition). You may trust the carried `count` or re-read; your call.

**Status:** finalize fe-003's reconcile half now (released-code-free, no gating). HOLD fe-003's trigger/consumer half until w0 signals `FEATURE_READY` (their emit lands+freezes first) — I'll relay it. Also please confirm fe-001/fe-002 already optional-chain their top-level `tabs.onActivated`/`onUpdated`/`action.setIcon`/`storage` registrations per my earlier frozen-harness note (or revise).
