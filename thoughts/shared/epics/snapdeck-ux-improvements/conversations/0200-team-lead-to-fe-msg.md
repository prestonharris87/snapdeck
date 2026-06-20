---
sequence: 0200
from: team-lead
to: fe
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:20:46Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Remediation needed — Phase-5a E2E gate found 1 product bug + 1 robustness gap (DEFECT-001, full root-cause in conversations/0031-browser-tester-to-fe-msg.md). 4/5 scenarios pass; fix these two, both in `extension/content/editor.js`:

**1. (fe-003 AC failure — blocking) Double-click re-edit never fires.** `group.on("click tap")` calls `render()` → `annLayer.destroyChildren()` recreates the Group, so Konva 9.3.22's `pointerdblclick` identity check (click#1 endShape === click#2 intersection) fails → `dblclick`/`editText` never fires. bt's **Option A** is the clean base: in the text Group click handler, only call `render()` when `selectedId !== item.id` (skip the redundant re-render when already selected → Group identity stays stable across the double-click). Consider also bt's **Option C** (a stage-level `dblclick` handler keyed on `selectedId` → `editText`) if you want direct-double-click-on-unselected to work too — your call, but the AC must pass: double-click a committed box → editor opens with existing text; single-click still only selects.

**2. (fe-002 security "no-hang" gap) Large text hangs the fit loop.** A 20K-char text item in a normal-size box blocked the event loop 20+s (43 `fitTextFontSize` iters × 10K-char canvas measurement). The thin-box short-circuit doesn't cover large-text-in-normal-box. The security-PROMOTED "auto-fit no-hang" AC must hold on the w2-screenshot-gallery re-open path. Add a bound so fit cost is independent of text length — e.g. measure a length-capped sample, or cap chars before the fit loop (a `RENDER_CHAR_CAP` smaller than RENDER_TEXT_CAP for the *measurement*), or cap iterations. Keep the displayed text honest per the existing RENDER_TEXT_CAP; just bound the *measurement* cost.

Don't touch story ACs (append `## Engineer Notes` + `## History`, reference DEFECT-001). Commit atomically (`git commit -- extension/content/editor.js`, message `fix(w1-text-box-autofit): DEFECT-001 — dblclick re-edit + bounded fit loop`). Run `node --test extension/*.test.mjs` (must stay green; add a unit test for the fit-bound if feasible). Then SendMessage `bt` to re-run scenario 4 + the large-text case at full size, AND reply to me (team-lead) with the fix commit SHA + what you changed. Do NOT push.
