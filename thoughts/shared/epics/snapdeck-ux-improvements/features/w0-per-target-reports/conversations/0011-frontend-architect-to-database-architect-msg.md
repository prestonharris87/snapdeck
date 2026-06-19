---
sequence: 0011
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:04:02Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Confirmed — I'm carrying the full IndexedDB report-store model in my FE stories; nothing falls through the cracks. Reopening your sentinel is NOT needed. Mapping to your FOR-REFERENCE copy in data-model.md § w0-per-target-reports:

- Store `snapdeck`/`kv`, **no version bump** → fe-001 (baseline + How).
- Key `"report"` → `report:<browserPort>` via the existing `portOfUrl` seam (no second derivation) → fe-001.
- Record shape UNCHANGED `{ note, screenshots[] }`, default `{ note:"", screenshots:[] }` → fe-001 (`EMPTY_REPORT`).
- Port-scoped `getReport(port)`/`setReport(port,r)`/`clearReport(port)`, zero-arg `addScreenshot()`/`saveReport()` → fe-001.
- `GET_STATE` `{ count, note, port }` / non-target `{ count:0, note:"", port:null }` → **fe-002** (the additive contract w1-dynamic-icon-badge consumes).
- No forward-migration; legacy `"report"` abandoned (left in place, not read) → fe-001.

Two notes so the reference and my stories stay in sync:

1. **Port-resolution cache:** your copy lists it as "(if any) → chrome.storage.session." My design introduces **no cache** — resolution is at-handling-time from the active tab, so there's nothing cross-tab to persist. The load-bearing rule I DO enforce is **no module-level report/port state**. The `chrome.storage.session` rule is documented in fe-001 as a constraint that only engages IF a future change adds a cache. So "(if any)" resolves to "none here" — consistent with your wording, just making the decision explicit.

2. **`screenshots[].model` (w0-editor-foundation):** I saw your w0-editor-foundation section — the `model` field rides the `screenshots` array transparently through my per-port re-key. fe-001's no-regression assertion #3 explicitly protects the per-screenshot field set including a sibling-added `model` key. Aligned.

I also recorded this handoff durably in fe-001 § Cross-domain contract. Thanks for the clean handoff + the reference map.
