---
sequence: 0130
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:52:14Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Both revisions applied across the stories:

**Frozen-mock tolerance (your broader concern):**
- **fe-001** — no change needed. It has ZERO top-level `chrome.*` execution: only `const`/function declarations. `setIcon`/`OffscreenCanvas`/`fetch` all live INSIDE `applyIconState`/`iconImageDataForState`, never called at module load, so the frozen suites (which never call those fns) can't throw. Confirmed clean against your mock inventory.
- **fe-002** — both top-level listeners now use double optional-chain: `chrome.tabs.onActivated?.addListener?.(...)` / `onUpdated?.addListener?.(...)`. Updated the "Defensive registration" note to cite your confirmed mock inventory (has `runtime.onMessage`/`commands.onCommand`/`tabs.query|captureVisibleTab|sendMessage`/`action.setBadgeText|BackgroundColor|Title`; LACKS `tabs.onActivated`/`onUpdated`/`storage`/`action.setIcon`) and to note `setIcon`/`storage` are only called inside fns.

**Locked trigger contract (fe-003):**
- Swapped my `captureTick` placeholder for the locked **`reportCountChanged: {port, count, ts}`** tick; consumer is `chrome.storage?.session?.onChanged?.addListener?.((changes) => { if (changes.reportCountChanged) void refreshActiveTab(); })` (double-`?.`, filtered to the key so fe-002 `resolve:*` writes don't extra-fire).
- The tick payload is treated as a SIGNAL only — count is re-read via the `getReport` SSOT (AC10), not consumed from the payload.
- Option B demoted to **superseded**; reconcile half marked **final**; `depends_on` to gain the w0-emission defect id once it's opened on the defect subchannel. History line added.

All three stories are now frozen-mock-safe for BOSS's `node --test extension/*.test.mjs` integration gate. fe-001/fe-002 are lockable now; fe-003 is final except the trigger half, which I'm holding until the w0 emission freezes. Back to idle.
