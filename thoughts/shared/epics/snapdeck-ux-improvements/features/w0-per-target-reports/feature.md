---
type: feature
slug: w0-per-target-reports
wave: 0
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: []
frontend_lane: N/A
visual_references: []
---

# Feature: Per-target in-progress reports

## Summary

Re-key the extension's in-progress report from a single global IndexedDB record
to a store keyed by the worktree/browser-port, so "the current target's report"
becomes a first-class concept. The developer/tester running Snapdeck across two
or more local worktrees gets each target its own in-progress report — switching
tabs surfaces that target's screenshots and count, and never mixes captures
across ports. This is the foundational shell change the dynamic icon's
report-in-progress (orange) count and the popup gallery both build on.

## Acceptance criteria seeds

- The in-progress report store is keyed by browser-port (derived from the active
  tab's URL), not stored as one global record.
- Adding a screenshot on a tab at port A appends only to port A's report; adding
  on port B appends only to port B's report.
- Starting a report on port A, switching to port B, and switching back to A
  restores A's in-progress report and screenshot count unchanged.
- Save and Clear operate on the current target's report only, leaving other
  targets' reports untouched.
- `GET_STATE` returns the current target's count/note (the count the popup and
  badge consume).
- The port→report keying lives in IndexedDB (survives service-worker restarts);
  any cross-tab cache (e.g. port resolution) lives in `chrome.storage.session`,
  not module state (MV3 ephemeral worker).
- No migration of pre-epic global reports is required; legacy in-progress data
  may be discarded on upgrade.
