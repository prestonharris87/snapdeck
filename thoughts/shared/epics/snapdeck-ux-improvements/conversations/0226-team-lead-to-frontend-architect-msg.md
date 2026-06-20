---
sequence: 0226
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T21:03:05Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Quick status check + single action: I just read fe-003 on disk — it **still carries the active `flashCleared` branch** (lines ~116–136, 188, 241–247) and the #3 "**gap CLOSED via seam (b)**" narrative. That's now factually wrong: `grep flashCleared extension/background.js` is **empty** — kb shipped (c), so nothing writes `flashCleared`; the branch is dead and the "gap closed" claim is false.

**The (c) revert hasn't landed yet** (batched-message lag, I think). Please apply it now — one edit:
1. DELETE the `flashCleared` `onChanged` branch + the `flashCleared_reassertsTabFromGetState` unit case + the AC11 line that asserts the `flashCleared` re-assert.
2. Revert Part-2 / #3 from "gap CLOSED via seam (b)" → **"SOLVED-by-kb-per-tab-flash + residual error-case empty-badge accepted as cosmetic transient (healed by existing wake-reconcile)."**
3. Keep the wake-reconcile + `reportCountChanged` branch + cold-start re-derive + the explicit per-tab `setBadgeText({tabId, text:""})` green/gray painting.

This is the ONLY blocker to STORIES_LOCKED. Reply (and it'll show on disk as: no active `flashCleared`, #3 = cosmetic-residual). Anchor = kb's empty `grep flashCleared` — objective + final.
