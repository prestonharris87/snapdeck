---
type: feature
slug: w1-dynamic-icon-badge
wave: 1
parent_epic: snapdeck-ux-improvements
status: stub
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-per-target-reports]
frontend_lane: N/A
visual_references: []
---

# Feature: Dynamic per-tab toolbar icon + badge

## Summary

Turn the static toolbar icon into a per-tab state machine: gray when the current
page is not a Snapdeck target, green when it is a registered target, and orange
with a live screenshot count while a report is in progress — returning to green
once the report is saved. The badge surfaces the unsaved-screenshot count.
Depends on per-target reports because the orange "report-in-progress(N)" count
is the current target's report count. Green-state detection reuses the existing
`/resolve` registry probe (cheap via a two-tier check), bringing "icon is green"
and "capture+save will work" into the same condition.

## Acceptance criteria seeds

- On a non-localhost tab the icon is gray immediately (instant, no probe).
- On a localhost tab whose browser-port is owned by a live controller (per a
  cached `/resolve` probe), the icon is green ("registered target").
- While the current target has an in-progress report, the icon is orange and the
  badge shows the live screenshot count; the count increments as screenshots are
  added.
- After the report is saved (and cleared), the icon returns to green.
- Icon/badge state is driven by `tabs.onActivated` / `tabs.onUpdated` and set
  per `tabId` so it survives service-worker restarts; the registry resolution
  cache lives in `chrome.storage.session`.
- All `tabs` / `action` listeners are registered at top level (MV3 ephemeral
  worker rebind).
- Tab switching with the two-tier check stays responsive (instant gray for
  non-localhost; cached registry probe only for localhost tabs without an active
  report) — no sluggish tab-switch.
