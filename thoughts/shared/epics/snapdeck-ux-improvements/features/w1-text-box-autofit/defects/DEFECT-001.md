---
type: defect
id: DEFECT-001
assignee: frontend-engineer
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
status: open
created_at: 2026-06-19T18:20:26Z
ci_run_url: local-playwright-e2e/extension/e2e/test-results
classification: FE
---

# DEFECT-001: CI failure auto-filed by autopilot

## Failure log excerpt

```
# Phase-5a E2E gate defect — w1-text-box-autofit (commit 3cab947)

## Primary (AC failure, fe-003): double-click re-edit never fires
Scenario 4 FAIL. `group.on("click tap", …)` calls `render()` synchronously →
`annLayer.destroyChildren()` recreates the text Group. Konva 9.3.22 fires
`pointerdblclick` only when click#1's stored endShape === click#2's fresh
getIntersection(); the recreated Group breaks that identity, so `dblclick`
never fires → `editText` never called. Breaks the fe-003 AC
"double-clicking a committed text box re-opens it for editing."
Fix options (bt): (A) skip render() when selectedId===item.id already;
(B) defer render() via setTimeout(…,0); (C) stage-level dblclick handler keyed
on selectedId. Option A is the clean base; consider C for direct-double-click-on-
unselected robustness.

## Secondary (security "no-hang" gap, fe-002): large text hangs the fit loop
Scenario 5 note. A 20K-char text item in a NORMAL-size box blocked the event
loop 20+s (43 fitTextFontSize iterations × 10K-char canvas measurement after
RENDER_TEXT_CAP truncation). The thin-box clamped-inset short-circuit does NOT
cover large-text-in-normal-box. The security-PROMOTED "auto-fit bounded, no
throw/hang" AC must hold on the w2-screenshot-gallery re-open path (arbitrary
stored models). Add a char cap fed to the fit measurement (or cap iterations /
measure a bounded sample) so fit cost is bounded regardless of text length.

Full repro + root-cause trace: conversations/0031-browser-tester-to-fe-msg.md.
Zero console errors across all 5 scenarios; scenarios 1/2/3/5 pass.
```

## Hand-off

Engineer: read the excerpt above, identify the failing test, and apply
a fix. Do NOT modify the test itself unless the test is genuinely
wrong (in which case explain in a code comment in the same diff).
The honesty-check validator will reject diffs that delete or weaken
tests without justification.

When done, leave `status: in-progress` so the validator picks up.
