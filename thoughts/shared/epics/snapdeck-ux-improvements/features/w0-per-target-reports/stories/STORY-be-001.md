---
type: story
id: STORY-be-001
name: "No backend changes — controller contract unchanged"
domain: backend
parent_feature: w0-per-target-reports
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
depends_on: []
sentinel: true
created_at: 2026-06-19T03:00:00Z
last_run_id: run-20260619-021434-24507
visual_references: []
defects: []
---

# Story: No backend changes required for this feature

## What we're doing

No backend changes required for this feature.

Per-target in-progress reports re-keys the extension's **in-progress** report
store from a single global IndexedDB key (`snapdeck`/`kv`/`"report"`) to a
per-browser-port key (`report:<browserPort>`). That store lives entirely in the
browser extension's IndexedDB and is owned by the frontend domain. The Snapdeck
controller (the server-side HTTP API) never stores the in-progress report — it
only receives a fully-assembled, completed report bundle on save — so its
contract is unchanged.

## Rationale (verified against the controller code)

- **`/resolve` is unchanged.** `controller/snapdeck_controller/server.py:82-84`
  routes `GET /resolve?port=<n>` to `reports.resolve_owner`
  (`controller/snapdeck_controller/reports.py:44-60`), a registry port→worktree
  lookup. It answers "which worktree owns this browser port?" and never reads or
  writes any per-port in-progress report key. The client-side re-keying does not
  alter this question or its answer shape.
- **`/report/save` is unchanged.** `server.py:148-150` routes
  `POST /report/save` to `reports.save_report`
  (`reports.py:108-181`). The accepted payload is already
  `{ browser_port, note?, screenshots: [...] }` (`reports.py:108-114`), and
  `browser_port` is already consumed at `reports.py:120` to resolve the owning
  worktree. Because the extension already derives and sends `browser_port` on
  save, the controller needs no change to accept per-port-keyed saves — the saved
  `report.json`/`report.md` projection (`reports.py:163-173`) is identical.
- **Per-port keying is a client-side IndexedDB concern.** The change is scoped to
  the service worker / IndexedDB helpers in `extension/background.js`
  (frontend domain). No server endpoint, service, repository, auth scheme, or
  integration is added or modified.

Auth note: both `/resolve` and `/report/save` remain as-is — the controller is a
loopback-only (`127.0.0.1`) local HTTP API with no auth scheme (`server.py:269`),
and this feature introduces no new endpoint, so there is no auth requirement to
state beyond "unchanged, local-loopback as established."

## How we validate

- [ ] No diff under `controller/` for this feature — the `GET /resolve` and
      `POST /report/save` endpoints and the saved `report.json`/`report.md`
      projection are byte-unchanged. The `browser_port` value the extension POSTs
      stays derived from `portOfUrl(activeTab.url)` (consumed by `resolve_owner`,
      `reports.py:120`), so worktree-owner resolution is unaffected.

## Dependencies

none

## History

- 2026-06-19 — created by backend-architect (sentinel; no backend work; controller `/resolve` + `/report/save` contract unchanged; `browser_port` already carried in the existing save payload; per-port keying is client-side IndexedDB)

## Revisions

- 2026-06-19 — **product-owner (arbitrate):** Promoted `pending → approved`
  (sentinel). Added a `## How we validate` checklist item (the empty-controller-diff
  assertion) so the story carries the required ≥1 validate item. Confirmed no
  FE↔BE contract conflict: STORY-fe-001 keeps `browser_port` derived from
  `portOfUrl(activeTab.url)` — exactly the derivation this sentinel's rationale
  requires for `resolve_owner` to match a worktree's `browsable_ports`.
