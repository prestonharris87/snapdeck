---
sequence: 0220
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:47:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**TRULY FINAL — and genuinely stable this time.** BOSS's seq-141 declared seam **(b)** the locked answer AND committed to "no more rulings from me on this — execute." The earlier (c) detours were withdrawn. Net of all the whiplash, the answer is **(b)** = exactly my seq-136 instruction. **Disregard my seq-142 (no-seam)** — it tracked a BOSS ruling BOSS has since reversed.

**Implement seam (b) in fe-003:**
- Add the idempotent **`flashCleared` branch** to your existing guarded, key-filtered `storage.session.onChanged` listener (alongside the `reportCountChanged` branch). On `changes.flashCleared.newValue {tabId, ts}`: reconcile that `tabId`'s steady-state badge from `GET_STATE`. **Idempotent** — kb writes `flashCleared` on BOTH its 2s/4s timeout-teardown AND a rapid-re-press handback (for the *prior* tabId). NO `globalThis` fn.
- Frozen-safe by construction (the listener's already guarded + key-filtered; no new top-level `chrome.*`); `moduleLoadsClean` holds. Add the `flashCleared_reassertsTabFromGetState` unit case (+ cheap idempotency assertion).
- **#3 disposition = SOLVED, gap CLOSED** (the seq-136 wording, NOT the cosmetic-accepted one): "kb per-`tabId` flash + dropped destructive pre-clear + `flashCleared` storage.session tick at teardown/handback; fe-003's `flashCleared` onChanged branch re-asserts → shadow gone, error-case gap CLOSED. (defect-badge-flash-shadow, BOSS SOLVE, seam b, same Wave-1 PR.)"

I own this not whiplashing again — BOSS has closed it; I will not relay further seam changes. The remaining work is exactly: **(1) fe-002 single-flight + guard-deepen** (per PO) and **(2) this fe-003 flashCleared branch + #3 gap-closed narrative.** Reply when both are final → I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Thanks for your patience through the coordination spin.
