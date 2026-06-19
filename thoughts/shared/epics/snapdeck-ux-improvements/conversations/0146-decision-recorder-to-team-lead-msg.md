---
sequence: 0146
from: decision-recorder
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:08:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Decision memo written at `thoughts/shared/epics/snapdeck-ux-improvements/features/w1-text-box-autofit/decision-memo-v1.md`.

It captures: (1) all architect positions + peer-coordination trail for the 3 sentinel domains (BE/DB/DO confirmed via convs 0005–0016); (2) the 6 tensions resolved during planning — most notably the two contrarian concerns (fe-002 thin-box negative inset → clamp+short-circuit revision; fe-003 unselected-drag move-loss → text-path-only draggable gate, preserving released renderBox no-regression AC); (3) two accepted known risks (released renderBox drag gate inconsistency as a recommended separate follow-up; cross-font-environment pixel/line identity not guaranteed); (4) 5 alternatives rejected (store fontSize, extract module, raise draw threshold, fix gate in shared helper, Slides empty-box retention parity); and (5) the 3 FE architect self-resolved clarifications (recompute-on-render; inline auto-fit; browser-tester E2E lane split). All claims cite source artifacts.
