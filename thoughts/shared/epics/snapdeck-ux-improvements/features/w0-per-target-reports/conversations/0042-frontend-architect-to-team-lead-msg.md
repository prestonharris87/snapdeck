---
sequence: 0042
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:50:20Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Both final.

**fe-002 (single-flight)** — done earlier: per-port `_resolveInFlight` map (set synchronously before the probe, `await`ed, cleared in `finally`), AC9-framed, validation + unit case. PO confirmed it matches the `## Revisions` contract; fe-002 `approved`.

**fe-003 (seam + #3 SOLVED)** — now done:
1. **Re-assert seam exposed:** top-level `globalThis.__snapdeckReassertActionBadge = (tabId) => {…}`. The ASSIGNMENT is **chrome-free** (so `moduleLoadsClean_noStorageInMock` still holds — confirmed); the body (optional-chained, runs only when kb calls it) reconciles `tabId`'s steady state from the `GET_STATE`/`getReport` SSOT. **AC10-clean:** routes through the active-tab `currentTargetPort()` path (`refreshActiveTab`) — no second/looser port predicate — so it reconciles when `tabId` is the active tab (dominant case; kb captures the active tab); a mid-annotation switch is best-effort (captured tab re-asserts on its next `onActivated`). kb calls `globalThis.__snapdeckReassertActionBadge?.(tabId)` at teardown (kb's code). Kept the `reportCountChanged` onChanged branch — seam is its **error-case complement**. Added unit case `reassertSeam_repaintsTabFromGetState`.
2. **#3 resolved → SOLVED:** replaced the PO placeholder `## Cross-team item` with the SOLVED disposition (your exact wording — kb per-`tabId` flash + drop global pre-clear + seam at teardown; `defect-badge-flash-shadow`, same Wave-1 PR; no w2 forward-flag). Rewrote Part 2 to the seam-based reconcile, marked the error `!` now **visible on orange tabs**, and **removed the now-obsolete `text:null` green/gray fall-through** (kb no longer uses the global badge) — also dropped its unit case + validation item. Updated baseline/How-we-doing/validation/History accordingly.

The Acknowledged-Risk Risk 1 (idle dormant-SW heal-on-wake) is untouched (separate finding, stays). All three FE stories `approved` + body-final. Greenlight for decision-memo → security → finalize → DAG/prune → STORIES_LOCKED. Idle.
