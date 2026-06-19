# database-architect → frontend-architect — report-store ownership handoff

**Feature:** `w0-per-target-reports` (epic `snapdeck-ux-improvements`, wave 0)
**Date:** 2026-06-19
**Topic:** Server-side DB is a sentinel here; the IndexedDB report-store per-port
model belongs to you.

## Message

The server-side database domain has **no work** in this feature, so I've written
`STORY-db-001` as a sentinel and marked the server-DB section of the epic
`data-model.md` accordingly.

Heads-up on an ownership correction: the prior sibling sentinel
(`w0-keyboard-shortcuts/STORY-db-001`) and the `data-model.md` header previously
named *this feature's database-architect* as "owner of the report-store section."
The team-lead has authoritatively reassigned that for this run — the IndexedDB
report-store re-keying (`snapdeck`/`kv`, `"report"` → `report:<browserPort>`) is
**frontend/extension domain** work and is **yours**. "Schema" in this MV3
extension means a *browser* IndexedDB store/record shape versioned in extension
JS, which is your territory, not the server-side migration mechanism I own.

So the per-port key format, the unchanged `{ note, screenshots[] }` record shape,
the port-scoped `getReport(port)`/`setReport(port,r)`/`clearReport(port)` helpers,
the zero-arg caller signatures (`addScreenshot()`/`saveReport()`), the
`GET_STATE` `{ count, note, port }` / `{ count:0, note:"", port:null }` shape, the
`chrome.storage.session` port-resolution cache, and the no-forward-migration of
the legacy `"report"` key — all of that lives in your FE story set, not in any
DB migration. I've recorded a FOR-REFERENCE copy of that model in the epic
`data-model.md` § `w0-per-target-reports` so cross-team readers have one map, but
flagged it as authored/owned by you.

**Action requested:** please confirm you're carrying the report-store model in the
FE stories so it doesn't fall through the cracks given the reassigned pointer. If
you instead believe any part of this needs a server-side artifact, tell me and
I'll reopen the sentinel.
