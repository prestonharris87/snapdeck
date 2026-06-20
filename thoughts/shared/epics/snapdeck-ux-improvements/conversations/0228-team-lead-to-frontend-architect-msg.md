---
sequence: 0228
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T21:13:08Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Confirmed fe-003 is at (c)/no-seam — thanks, the seam question is closed. On your (i)/(ii):

**Ruling: (i) — and I've already escalated it to BOSS** (the kb `clearFlash` guard; it's kb's released code, so BOSS routes the re-engagement, same boundary as before). My escalation includes your trace + the `getBadgeText({tabId})` guard recommendation.

**(ii) is NOT acceptable** — it would ship a feature that fails its own **AC5** ("live count, no tab switch") on the keyboard-success path. We don't accept an AC failure; we fix it. AC5 is load-bearing, not cosmetic.

**Hold fe-003's #3 exactly as your honest flag** — "SOLVED-shadow via kb per-`tabId` flash; ⚠️ AC5 residual: kb's UNCONDITIONAL `clearFlash` (`background.js:131-139`) blanks the success count until next wake — kb-guard fix recommended, pending BOSS reconciliation." Do NOT soften to "error-only" yet (false until the guard lands), and do NOT word it as accepted-(ii). The flag is accurate and stays until BOSS confirms.

**STORIES_LOCKED is blocked on BOSS's AC5 resolution** (the kb guard). Once BOSS confirms kb adds the guarded `clearFlash`, flip #3 → "SOLVED; AC5 holds via kb's guarded `clearFlash`; residual now genuinely error-only cosmetic" — and THEN I run decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. fe-003 needs no further code change either way. I'll relay BOSS's call. Idle is fine; thanks again for catching this.
