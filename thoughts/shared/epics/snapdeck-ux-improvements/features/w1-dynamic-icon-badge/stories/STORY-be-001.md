---
type: story
id: STORY-be-001
name: "No backend (controller) changes — /resolve consumed read-only"
domain: backend
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
sentinel: true
depends_on: []
diff_estimate: none
files_modified: []
files_not_modified: [controller/snapdeck_controller/server.py, controller/snapdeck_controller/reports.py, controller/snapdeck_controller/core.py]
reuse_patterns: []
created_at: 2026-06-19T15:32:00Z
last_run_id: run-20260619-150619-36719
visual_references: []
defects: []
---

# Story: No backend (controller) changes required

## What we're doing

**Sentinel — no backend work.** The dynamic icon/badge feature requires zero change to
the Snapdeck Python controller. Green-state detection consumes the existing
`GET /resolve` endpoint **read-only** through the already-released `findController()`
seam (`extension/background.js:88-101`); orange-count detection consumes the released
client-side `GET_STATE`/`getReport()` IndexedDB path; save/clear detection consumes the
released `SAVE_REPORT`/`CLEAR_REPORT` paths. None of these touch the controller's
`/resolve` or `/report/save` HTTP contract, its data access, or its (intentionally
absent) auth model. All net-new work — the per-`tabId` `action` state machine in
`background.js` — is the **frontend-architect's** domain for this feature
(`frontend_lane: N/A` service-worker work; story stub `STORY-fe-001`).

## Confirmed contract (read-only, unchanged by this feature)

`/resolve` — `GET http://127.0.0.1:<controllerPort>/resolve?port=<browserPort>`
- **Auth:** none by design — controller binds `127.0.0.1` only (local loopback;
  see lessons note + `server.py`). For this endpoint the auth requirement is
  "unchanged, local-loopback" — not a new scheme.
- **Handler:** `server.py:82-84` → `resolve_owner(port)` (`reports.py:44-60`).
- **Response (owner found, 200):**
  `{ ok: true, worktree, project, controller_port, user_test_reports_dir }`.
- **Response (no owner / bad port):** `{ error: "...", status: 404|400 }` (no `ok`).
- **Consumer dependency surface:** `findController()` reads **only** `r.json.ok`
  (`background.js:95`). No new field is required; the response shape is a superset of
  what the feature needs and is stable. Green = a `/resolve` that returns `ok: true`;
  everything else (including the deceptive-host and non-localhost cases, which fire no
  probe at all) reads as gray.

## How we validate it was done correctly

- [ ] No file under `controller/` is modified by this feature's diff.
- [ ] The feature's green-detection path calls the existing `findController()` →
      `/resolve` seam and reads only `r.json.ok` — no new controller endpoint, query
      param, or response field is introduced.
- [ ] `/report/save` is untouched; report save/clear remains the released w0 path.

## Unit tests

n/a — sentinel; no backend code changes, so no new backend (controller) unit tests.
The Python controller's existing `/resolve` tests remain the coverage for that contract.

## Dependencies

none — the consumed `/resolve` and report-state contracts are already released
(`w0-per-target-reports`, `w0-keyboard-shortcuts`).

## History

- 2026-06-19 — created by backend-architect (effort=1, sentinel, depends on none).
  Verified `/resolve` contract stability against `server.py:82-84` + `reports.py:44-60`
  and the consumer seam `background.js:88-101`. Peer-confirmed `/resolve` stability with
  frontend-architect.
