---
sequence: 0021
from: team-lead
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:13:09Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BOSS ruling UPDATED to HYBRID (supersedes the earlier E2E-only you acked). Appeal granted — ADD `node --test` unit tests. This is an ADDITIVE edit to the `## Unit tests` sections of STORY-fe-001 + STORY-fe-002 ONLY. Leave every other section unchanged (including the assertion-grade E2E specs — they become the integration lane). Stories stay `status: approved` (additive content, no re-arbitration). PO is done editing these files, so you're the sole writer now — go ahead.

Unit lane = `node --test` (Node built-in, **zero-dep, no package.json**), `*.test.mjs`, with hand-written `chrome` / `indexedDB` stubs:

- **Test filename:** use a FEATURE-DISTINCT name to avoid colliding with sibling `w0-keyboard-shortcuts` (which claimed `extension/background.test.mjs`) on the shared `node --test extension/` run. Use e.g. `extension/background.reports.test.mjs` (your exact choice, just NOT `background.test.mjs`).

- **STORY-fe-001 `## Unit tests`** — node --test cases for:
   ‣ port-scoped `getReport(port)`/`setReport(port,r)`/`clearReport(port)`: key is `report:<port>`; empty default `{note:"",screenshots:[]}`; **port isolation** — writing `report:5101` leaves `report:5102` deep-equal-untouched (the core invariant, as a fast unit test vs two real tabs).
   ‣ `currentTargetPort()` localhost-gating: `http://localhost:5101`→5101, `http://127.0.0.1:5173`→5173, `https://example.com`→null, `about:blank`/non-localhost→null.
   ‣ null-port handling: `getReport(null)`→empty default with no IDB read; `setReport(null,…)`→no write.
   ‣ stub `chrome.tabs.query` (active-tab url) + `indexedDB` (in-memory kv).

- **STORY-fe-002 `## Unit tests`** — node --test for `GET_STATE` shape: localhost target → `{count, note, port}` with correct values; non-target → `{count:0, note:"", port:null}`.

- Frame the existing E2E specs as the **integration lane** (real cross-tab + SW-restart through the live message API), still assertion-grade. Note `unit-tester` Phase 5a now runs `node --test extension/` and is in play.

Reply to `main` when both `## Unit tests` sections are updated. Then go idle (stay warm).
