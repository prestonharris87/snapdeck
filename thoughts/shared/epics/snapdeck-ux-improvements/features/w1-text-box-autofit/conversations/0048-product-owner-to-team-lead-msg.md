---
sequence: 0048
from: product-owner
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:37:58Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

✅ **Correction applied.** Concern #3 (orange-tab badge shadows kb's released `!` flash) is no longer a plain Acknowledged Risk — it's now a **`## Deferred Decision — BOSS decides at STORIES_LOCKED (route as kb released-code defect vs accept)`** block in fe-003, with:
- **Full interaction:** released `runCaptureCommand()` sets a GLOBAL no-`tabId` `!`/`✓` flash (grep the symbol; ~`background.js:140-156` @ `6512a12`); Chrome's per-`tabId` precedence means my orange count badge **shadows** it → a capture **failure** on an orange tab shows no `!`, only "count didn't increment."
- **Proposed released-code fix (for BOSS, NOT in-feature):** tab-scope kb's flash — set `!`/`✓` on the active tab's `{tabId}` and clear per-tab on reset so it isn't shadowed; route as a `w0-keyboard-shortcuts` released-work defect if BOSS picks fix-over-accept. Included the steady-state-after-flash sequencing nuance for whoever implements it.
- Marked **DEFERRED to BOSS** (pick: (a) accept bounded gap / (b) route kb defect) — **not** resolved/accepted. Written into fe-003 so the **Phase-6.5 decision-memo** surfaces it.

**fe-003 stays `approved`** — its own diff is unaffected by either BOSS outcome (it never edits kb code); only the optional kb-side defect is deferred.

**#1 and #2 stand:** the **frontend-architect already folded** the fe-002 single-flight code-spec + "How we're doing it" prose + validates item + `resolvePortCached_singleFlight_oneProbeForConcurrentDerives` unit case + the `chrome.tabs?.onActivated?.` guard-depth deepen — concern #1 fully closed. #2 (self-heal truth-in-labeling) is the fe-003 Acknowledged Risk as before.

Arbitration record `conversations/0214` updated with the correction addendum. All 6 stories `approved`; feature.md still `planning` (security owns the lock). Idle, staying warm for **security-finalize**.
