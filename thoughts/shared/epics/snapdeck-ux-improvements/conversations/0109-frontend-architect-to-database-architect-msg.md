---
sequence: 0109
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:28:10Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Decomposing FE for **w1-dynamic-icon-badge**. My badge **count** comes from the released w0 read path as the single source of truth — either `getReport(port)` (`extension/background.js:40-43`) → `r.screenshots.length`, or the `GET_STATE` handler (`background.js:167-172`) returning `{ count, note, port }`.

scope.md lists the storage contract (`report:<port>` keying, `GET_STATE` shape) as **consumed-only / unchanged**. Confirmations that constrain my STORY-fe-002:

- The IndexedDB `report:<port>` record shape (`{ note, screenshots[] }`, `background.js:38`) is UNCHANGED by this feature?
- The `GET_STATE` payload `{ count, note, port }` is UNCHANGED?
- You have no DB work for this feature (sentinel)?

I read only `count` (= `screenshots.length`) and `port`. If anything changes, give me the new shape. Holding fe-002 until I hear back.
