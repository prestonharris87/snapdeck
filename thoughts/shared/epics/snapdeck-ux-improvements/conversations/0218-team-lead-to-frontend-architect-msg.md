---
sequence: 0218
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:44:39Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**FINAL fe-003 instruction — this supersedes BOTH my prior messages** (the seam-a `globalThis` add AND the "no-seam, unchanged" revert). The contract flip-flopped via crossing BOSS messages; BOSS's seq-132 is the settled final ruling: **seam (b), `chrome.storage.session` flag.** This is stable now — implement to this.

**fe-003 change — add a `flashCleared` branch to your EXISTING guarded, key-filtered `storage.session.onChanged` listener** (the same listener that handles `reportCountChanged`):
- On `changes.flashCleared` (newValue `{ tabId, ts }`): re-assert THAT `tabId`'s steady-state badge by reconciling from `GET_STATE` (derive the tab's port → icon/badge: gray/green/orange+count). Scoped to the passed tabId.
- **Idempotent** — kb fires `flashCleared` on BOTH: (i) its 2s/4s flash-timeout teardown, and (ii) a rapid-re-press handback (a new capture run cancels the prior timer and writes `flashCleared` for the *prior* tabId so it gets repainted). Your branch must handle repeated/overlapping fires safely.
- This is purely a new `onChanged` key-branch — **NO `globalThis` fn** (that was the dropped seam-a). Frozen-safe by construction (your listener is already guarded + key-filtered; no new top-level `chrome.*`). `moduleLoadsClean` still holds.
- Add a unit case `flashCleared_reassertsTabFromGetState` (+ an idempotency/rapid-repress assertion if cheap).

**#3 disposition (resolve as gap-CLOSED, not cosmetic-accepted):** "SOLVED — kb makes its `!`/`✓` flash per-`tabId` + drops the destructive global pre-clear + writes a `flashCleared` `storage.session` tick at teardown/handback (`defect-badge-flash-shadow`, BOSS-ruled SOLVE, seam (b), same Wave-1 PR); fe-003's `flashCleared` onChanged branch re-asserts the tab's steady state. Shadow gone; error-case post-flash gap CLOSED via the seam." No w2 forward-flag.

That + the fe-002 single-flight (per PO) are the last fe-003/fe-002 edits. Reply when both are final — then I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Apologies for the seam whiplash; it's settled now.
