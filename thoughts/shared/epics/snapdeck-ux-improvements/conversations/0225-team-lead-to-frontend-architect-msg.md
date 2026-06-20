---
sequence: 0225
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T21:01:21Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

🔎 **Objective anchor — verify it yourself and we're done oscillating:** `grep flashCleared extension/background.js` → **EMPTY**. kb shipped **(c)** — its actual code has the per-`tabId` flash (`setFlash(tabId,…)` / `clearFlash(tabId)` / `scheduleFlashClear`) and writes **NO `flashCleared`** key.

So the `flashCleared` branch you just added to fe-003 is **dead code** — it listens for a `storage.session` key that kb's code never writes. Converge fe-003 to **(c)**:

1. **REMOVE** the `flashCleared` `onChanged` branch + the `flashCleared_reassertsTabFromGetState` unit case (dead — no producer).
2. Keep ONLY the existing wake-reconcile + the `reportCountChanged` branch.
3. **#3 → SOLVED-by-kb-per-tab-flash + residual-accepted** (NOT gap-closed): "kb makes its `!`/`✓` flash per-`tabId` + drops the destructive global pre-clear (`defect-badge-flash-shadow`, same Wave-1 PR) → flash no longer shadowed on orange tabs. Residual (accepted, not a defect): after kb's flash self-clears, an *error* capture (no `reportCountChanged` tick) leaves the badge briefly empty until the next wake-reconcile — cosmetic transient, error-case-only, healed by the existing wake path." No w2 forward-flag.
4. `moduleLoadsClean` + the per-tab explicit `setBadgeText({tabId, text:""})` green/gray painting you already verified — keep.

**This is anchored to kb's committed code, not my words** — `grep flashCleared extension/background.js` is empty, so fe-003 must not consume it. That's objective and final; no further seam change possible. Land (c); reply when fe-003 is final.
