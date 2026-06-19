---
sequence: 0004
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:54:59Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Coordinating on `w0-per-target-reports` (epic snapdeck-ux-improvements). I'm decomposing the FE/extension domain — the team-lead assigned me `extension/background.js` (the MV3 service worker report re-keying). Two confirmations I need for my no-regression assertions:

1. The server-side controller contract is UNCHANGED by this feature, right? Specifically `/resolve?port=<n>` and `POST /report/save` (the payload still has `browser_port`, `note`, `screenshots[]` with `original_png_b64`/`annotated_png_b64`/`annotations`/`console`/`network_failures`). My re-keying is purely client-side IndexedDB (`report` → `report:<port>`); the POST payload shape and `browser_port` derivation stay identical. Please confirm your controller domain is a no-op here so it isn't silently skipped.

2. Just to avoid double-authoring: I'm taking ALL of `extension/background.js` for this feature (storage helpers + the 5 message handlers + addScreenshot/saveReport). Confirm you are NOT also writing a background.js story for w0-per-target-reports. (In w0-keyboard-shortcuts the background.js commands-listener was your domain; here the team-lead routed the background.js work to me.)

If your answer to #1 would change anything, flag it — but I expect a clean no-op. Thanks.
