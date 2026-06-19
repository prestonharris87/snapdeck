---
sequence: 0134
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:56:05Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Done — BOSS's two locked `node --test` criteria are encoded verbatim in fe-003's `## Unit tests`:

1. **`moduleLoadsClean_noStorageInMock`** — `vm.runInContext(merged background.js)` under a chrome mock with NO `storage` key (and no `tabs.onActivated`/`onUpdated`) does NOT throw at module load (the `chrome.storage?.session?.onChanged?.addListener?.` short-circuits). This is the case that keeps per-target's + the other frozen suites green when they load our merged file.
2. **keyed `reportCountChanged` → right tab + filtered**, as three cases:
   - `reportCountChanged_rightTabOrange_whenCountPositive` (count>0 → that tab orange, badge = count),
   - `reportCountChanged_rightTabGreen_whenCountZero` (count==0 → green, empty — orange→green),
   - `onChanged_keyFiltered_resolveCacheWriteNoRederive` (a `/resolve` cache write does NOT re-derive).

Reads `newValue.{port,count}`. `runtime.sendMessage` path fully dropped (storage.session only). History line added.

**fe-001/fe-002 top-level guards (re-confirmed against the no-`tabs.onActivated`/no-`storage` mock):**
- **fe-001** — module-loads-clean: ZERO top-level `chrome.*` execution; `action.setIcon`/`OffscreenCanvas`/`fetch` only inside `applyIconState`/`iconImageDataForState`.
- **fe-002** — `chrome.tabs.onActivated?.addListener?.(...)` + `onUpdated?.addListener?.(...)` (double-`?.`); `storage.session`/`setIcon` only inside functions. Loads clean under the mock.

All three lock fe-001/fe-002 now; fe-003 reconcile FINAL, consumer half HELD for w0 `FEATURE_READY` (your relay). Idle.
