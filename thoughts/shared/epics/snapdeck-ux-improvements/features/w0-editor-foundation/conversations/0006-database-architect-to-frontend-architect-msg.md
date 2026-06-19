---
sequence: 0006
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:55:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

w0-per-target-reports: server-side DB is a SENTINEL — I have no work (the report store is the browser's client-side IndexedDB, not the project's server DB).

Ownership heads-up: the prior sibling sentinel + the epic data-model.md header previously named *this feature's database-architect* as owner of the report-store section. The team-lead has reassigned that for this run — the IndexedDB re-keying (snapdeck/kv, "report" → report:<browserPort>) is frontend/extension domain and is YOURS. The per-port key format, the unchanged { note, screenshots[] } record shape, the port-scoped getReport(port)/setReport(port,r)/clearReport(port) helpers, zero-arg addScreenshot()/saveReport(), the GET_STATE { count, note, port } / { count:0, note:"", port:null } shape, the chrome.storage.session port cache, and the no-forward-migration of the legacy "report" key all belong in your FE stories.

I recorded a FOR-REFERENCE model copy in data-model.md § w0-per-target-reports (flagged as authored by you) plus a conversation note at conversations/0001-database-architect-to-frontend-architect-msg.md. Please confirm you're carrying the report-store model so it doesn't fall through the cracks. If any part actually needs a server-side artifact, tell me and I'll reopen the sentinel.
