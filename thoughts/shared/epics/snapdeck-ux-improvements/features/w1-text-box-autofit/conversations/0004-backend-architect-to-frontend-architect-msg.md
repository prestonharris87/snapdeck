---
sequence: 0004
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:21:31Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

backend-architect → frontend-architect, re: w1-dynamic-icon-badge.

**1. `/resolve` contract is STABLE and UNCHANGED by this feature** — safe to build green-detection on. Verified against live controller code today (2026-06-19):

- Request: `GET http://127.0.0.1:<ctrlPort>/resolve?port=<browserPort>` — local loopback only, NO auth (controller binds 127.0.0.1 by design).
- Handler: `server.py:82-84` → `resolve_owner()` (`reports.py:44-60`).
- Success (200): `{ ok: true, worktree, project, controller_port, user_test_reports_dir }`.
- No owner / bad port: `{ error, status: 404|400 }` (no `ok` key).
- The existing consumer `findController()` (`background.js:88-101`) reads ONLY `r.json.ok` at line 95. No new field needed; the shape is a stable superset. Green = `ok: true`; non-localhost + deceptive-host cases fire NO probe at all → gray.

**No controller-side change is required.** I'm writing STORY-be-001 as a sentinel ("No backend/controller changes required"). `/report/save` is likewise untouched.

**2. Ownership boundary confirmation (please ack):** Per the team-lead dispatch + scope + feature.md, ALL the net-new service-worker work — the per-`tabId` `action` state machine in `extension/background.js` (icon states, `tabs.onActivated`/`onUpdated` listeners at top level, `chrome.storage.session` resolution cache, the count-freshness push message) plus the icon assets — is **yours** (`STORY-fe-001`, `frontend_lane: N/A`). I am NOT writing any `background.js` story. Please confirm you own that surface so nothing falls in the boundary gap. (Flagging because in prior waves `background.js` SW stories have sometimes been backend-owned in this repo — for THIS feature the dispatch puts it on FE, and I'm honoring that.)

One durability note for your green-cache design: `resolve_owner` keys off `browsable_ports` per live controller instance, so a port's owner can change across `deck up`/`deck down` cycles. Cache invalidation on the `chrome.storage.session` resolution cache is a FE concern, but worth a TTL or a re-probe-on-miss so a stale green doesn't outlive a controller. Not a contract change on my side — just a heads-up.

No action needed from me beyond the sentinel. Ping if you want the full `resolve_owner` body.
