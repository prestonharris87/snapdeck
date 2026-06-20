---
type: story
id: STORY-be-001
name: "Controller sentinel — gallery edits local IndexedDB only"
domain: backend
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
depends_on: []
sentinel: true
created_at: 2026-06-20T16:22:00Z
last_run_id: run-20260620-161818-88519
visual_references: []
defects: []
---

# Story: Controller sentinel — gallery edits local IndexedDB only

## What we're doing

**No backend (controller) changes are required for this feature.** The screenshot
gallery reviews, re-opens/re-saves, and deletes screenshots in the extension's
**local in-progress report store** (browser IndexedDB, keyed `report:<port>`). All
three new operations — fetch report screenshots, re-open-and-resave, and delete
(with GC-on-empty) — are client-side IndexedDB mutations via the released
`getReport` / `setReport` / `clearReport` seam in `extension/background.js`. None
of them calls the Python controller. The controller's two endpoints (`GET /resolve`,
`POST /report/save`) and the saved `report.json` projection are **unchanged**.

## Why this is a sentinel (verification basis)

"Backend" in this epic = the Python local controller under
`controller/snapdeck_controller/`. I read both endpoints in full on 2026-06-20:

- **`GET /resolve?port=`** → `resolve_owner` (`server.py:82-84` → `reports.py:44-60`).
  A pure read-path port→worktree lookup over the cross-worktree registry; returns
  `{ ok, worktree, project, controller_port, user_test_reports_dir }`. The gallery
  does not call it, add a param, or read a new field. **Unchanged.**
- **`POST /report/save`** → `save_report` (`server.py:148-150` → `reports.py:108-172`).
  Persists a *completed* report bundle (report.json + report.md + decoded PNGs) into
  the owning worktree's user-test-reports dir, resolving the owner from the payload's
  `browser_port` (`reports.py:120`). The saved `report.json` projection enumerates a
  fixed field set per screenshot (`index`, `url`, `title`, `captured_at`, `viewport`,
  `annotations`, `console`, `network_failures`, plus `original` / `annotated` PNG
  paths — `reports.py:139-172`). **Unchanged.**

The feature operates exclusively on the **client-side in-progress report** in
service-worker IndexedDB — a frontend/extension surface. This matches:

- **scope.md** (Out of scope): *"The upstream `/report/save` controller contract and
  the saved `report.json` projection — unchanged; this feature only edits the local
  in-progress store"* and *"Capture / annotate behavior, the localhost guard, and the
  controller `/resolve` contract — unchanged."*
- **data-model.md** § `w0-per-target-reports` ownership correction: the IndexedDB
  report-store (re-keying, record shape, `report:<port>`) is **frontend/extension
  domain**, owned by the `frontend-architect`; the server-side role is a sentinel.
- The released **w0-per-target-reports STORY-be-001** sentinel precedent (the
  controller is a thin loopback API; in-progress state lives client-side; `browser_port`
  already rides the save payload, so per-port partitioning needs no controller change).

The edited `model` / `annotated` / `annotations` that the gallery writes back into the
local `report:<port>` record only ever reach the controller **later**, via the
**existing, unchanged** popup "Save report" → `POST /report/save` flow — not via any
new gallery call.

## Peer coordination (unconditional Phase-5 floor)

Boundary confirmed with `frontend-architect` (two-message round) before finalizing:

- **Sent** (backend-architect → frontend-architect): pinned the contract boundary —
  (1) no new controller HTTP call (fetch/re-save/delete/GC are all local IndexedDB via
  `getReport`/`setReport`/`clearReport`); (2) `GET /resolve` + `POST /report/save` +
  the `report.json` projection stay byte-frozen; (3) the existing popup Save button
  still POSTs `/report/save` unchanged; (4) ownership ack — `background.js` message
  handlers + `extension/popup/*` + IndexedDB are FE/extension-owned, I own nothing in
  `background.js`.
- **Received** (frontend-architect → backend-architect): confirmed (a) `background.js`
  is FE-owned this feature (FE owns the new fetch / re-open-resave / delete handlers),
  and (b) the Python controller is untouched — the feature edits only the local
  in-progress IndexedDB store; re-save/delete never touch the controller. FE is
  authoring 3 FE stories (fetch+delete handlers; re-open+re-save handler; popup grid UI).

Both messages are recorded in this feature's `conversations/` audit trail.

## How we validate it was done correctly

- [ ] No diff under `controller/` for this feature — `controller/snapdeck_controller/server.py`,
      `reports.py`, and `core.py` are byte-unchanged.
- [ ] `GET /resolve` and `POST /report/save` request/response contracts and the saved
      `report.json` projection (`reports.py:139-172`) are unchanged.
- [ ] All gallery report mutations occur in the client-side IndexedDB `report:<port>`
      store (FE/extension domain); no new controller endpoint or call is introduced.

## Unit tests

n/a — sentinel (no controller code change). The feature's behavioral coverage lives in
the FE/extension stories (popup + `background.js` handler unit tests via `node --test`,
plus the browser-tester Playwright lane for Konva-render scenarios).

## Dependencies

none — standalone sentinel. The controller is untouched, so there is no producer
dependency on DB/DevOps/other-BE stories.

## History

- 2026-06-20 — created by backend-architect (effort=1, sentinel, depends on none).
  No-work decision peer-confirmed with frontend-architect (2-message round); controller
  `/resolve` + `/report/save` + `report.json` projection verified unchanged (files read
  2026-06-20).

## Revisions

### 2026-06-20 — product-owner (arbitrate, run-20260620 w2-screenshot-gallery)

- **Sentinel affirmed; no cross-domain conflict.** The controller is untouched — all
  three gallery ops are local IndexedDB mutations; the edited `model`/`annotated`/
  `annotations` only ever reach the controller via the **existing, unchanged** popup
  "Save report" → `POST /report/save` flow. FE peer-confirmed ownership of `background.js`
  + `popup/*` + IndexedDB. Frontmatter + `- [ ]` validate checklist conform; nothing to
  revise.
- **Unaffected by the FE stable-identity fix.** The `sid` synthesis (fe-001/002/003) is
  client-side only and derives from fields already present in the local record
  (`captured_at` + `original`); it does **not** add, rename, or reshape any field in the
  `report.json` projection the controller persists. The `report.json` per-screenshot
  field set (`reports.py:139-172`) stays byte-frozen.

**Status:** pending → approved.
