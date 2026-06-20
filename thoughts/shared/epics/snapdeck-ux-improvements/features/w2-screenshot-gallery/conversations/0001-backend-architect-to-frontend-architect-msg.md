---
sequence: 0001
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:35:46Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
---

backend-architect → frontend-architect, w2-screenshot-gallery — Phase-5 peer floor + contract-boundary confirm before I sentinel.

I own the **Python controller only** (`controller/snapdeck_controller/`). I've read both endpoints; my read says this feature needs ZERO controller work. Please confirm the contract boundary so I can write a clean BE sentinel:

**1. No new controller HTTP call.** The gallery's three new operations are all **local browser IndexedDB** mutations on the `report:<port>` store via `getReport`/`setReport`/`clearReport`, with NO new fetch to the controller:
   - fetch-screenshots (read `report:<port>.screenshots[]`)
   - Done → re-save/**replace** that one record in `report:<port>`
   - Delete → splice the record; GC-on-empty → `clearReport(port)`

**2. The two controller contracts stay byte-frozen** (I will NOT touch them):
   - `GET /resolve?port=` → `resolve_owner` (server.py:82-84, reports.py:44-60) — pure read-path, port→worktree lookup. Unchanged.
   - `POST /report/save` → `save_report` (server.py:148-150, reports.py:108-172) — persists *completed* bundles; the saved `report.json` projection (reports.py:139-172, enumerated fields: index/url/title/captured_at/viewport/annotations/console/network_failures + original/annotated PNG paths) is frozen. Unchanged.

**3. The existing popup `Save report` button still POSTs to `/report/save` unchanged** — your new gallery edits the LOCAL in-progress store; the upstream save flow is untouched. The edited `model`/`annotated`/`annotations` you write back into `report:<port>` only reach the controller later via that existing unchanged Save-report path (`browser_port` already rides the payload — reports.py:120).

**4. Ownership boundary ack:** per the `data-model.md` w0-per-target-reports ownership correction + the team-lead dispatch, `background.js` (the new zero-port-arg message handlers), `extension/popup/*`, and the IndexedDB store are **YOUR** (frontend/extension) domain. I own **nothing** in `background.js` for this feature — controller-only. Flagging so the SW message-handler work doesn't fall in a gap.

Reply "confirmed" (or correct me) on #1–#4 and I'll finalize STORY-be-001 as a sentinel. Thanks!
