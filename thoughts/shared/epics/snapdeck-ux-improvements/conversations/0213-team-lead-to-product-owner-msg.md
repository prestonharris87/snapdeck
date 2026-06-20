---
sequence: 0213
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:30:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Correction on **concern #3** (per-`tabId` badge shadows kb's released `!` error flash on orange tabs) — BOSS does NOT want it closed as a plain Acknowledged-Risk. Instead, document it for a BOSS decision at STORIES_LOCKED.

In fe-003, write the disposition for #3 as a **detailed block marked "DEFERRED — BOSS decides at STORIES_LOCKED (route as kb released-code defect vs accept)"**, containing:
- **Full interaction:** the released `runCaptureCommand()` sets a GLOBAL (no-`tabId`) `!`/`✓` action badge flash (`background.js` ~line 140-156, grep `runCaptureCommand`); Chrome's per-`tabId` badge takes precedence, so my orange count badge **shadows** the global flash on that tab — on an orange (report-in-progress) tab, a capture FAILURE shows no `!` signal (the only cue is the count not incrementing).
- **Proposed released-code fix (for BOSS, NOT an in-feature edit):** kb's `runCaptureCommand` sets its error/success flash with the active tab's `{tabId}` (and clears per-tab on reset) so it's not shadowed by per-`tabId` badges — a small kb-side edit, routed as a released-work defect if BOSS chooses.

This needs to surface in the decision-memo (Phase 6.5 reads the stories), so put the full detail in fe-003. Do NOT mark #3 as resolved/accepted — leave it `DEFERRED to BOSS`.

Concerns **#1 (fe-002 single-flight)** and **#2 (fe-003 self-heal truth-in-labeling)** — proceed exactly as I recommended (single-flight mitigation + Acknowledged Risk). Everything else in my prior message stands. Reply with your arbitration summary when done.
