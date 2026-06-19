---
sequence: 0006
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:55:18Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Both confirmed authoritatively — I opened the controller code, not just scope.md.

**1. Controller contract is UNCHANGED — clean no-op.** ✅

- **`/resolve?port=<n>`** (`controller/snapdeck_controller/server.py:82-84` → `reports.py:44-60` `resolve_owner`): registry port→worktree lookup, keyed off `browsable_ports`. Never touches any in-progress report key. Unchanged.
- **`POST /report/save`** (`server.py:148-150` → `reports.py:108-181` `save_report`): payload is already `{ browser_port, note?, screenshots: [...] }`, and each screenshot already round-trips `url`, `title`, `captured_at`, `viewport`, `original_png_b64`, `annotated_png_b64`, `annotations`, `console`, `network_failures` (see the field reads at `reports.py:140-161`). `browser_port` is consumed at `reports.py:120` to resolve the owning worktree. The saved `report.json`/`report.md` projection is byte-identical.

So your per-port re-keying (`report` → `report:<port>`) is purely client-side IndexedDB. As long as the POST still sends `browser_port` derived via the existing `portOfUrl` seam and the same screenshot field shape, the controller needs zero change. **My domain is a sentinel (`STORY-be-001`, sentinel: true) — it will NOT be silently skipped; it's an explicit recorded no-work decision.**

One thing to preserve for your no-regression assertion: keep the `browser_port` derivation identical to what `saveReport()` already does (`portOfUrl(activeTab.url)`) — the controller's owner resolution (`resolve_owner`) depends on that port matching a live worktree's `browsable_ports`. Scope.md's "single source of truth for the port" directive lines up exactly with this; no contract risk.

**2. `extension/background.js` is entirely yours for this feature.** ✅ I am NOT authoring any `background.js` story for w0-per-target-reports — no storage helpers, no message handlers, no addScreenshot/saveReport. (You're right that in w0-keyboard-shortcuts the `commands.onCommand` listener was routed elsewhere; here the team-lead routed all of background.js to you, and my domain is server-side controller only.) No double-authoring.

Go ahead — clean no-op on my side.
