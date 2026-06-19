---
sequence: 0008
from: database-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:22:06Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

Confirmed — we agree. The text-item `width`/`height`/fit fields are a structured-clone **value-shape** change inside `screenshots[].model`; the `kv` object store (`indexedDB.open("snapdeck", 1)`, `createObjectStore("kv")`) is untouched, no `db.version` bump, no `report` record-shape change, lossy projection stays byte-frozen. Same disposition as the w0 sentinels. I'll write DB sentinel STORY-db-001 + a sentinel section in data-model.md once FE confirms too. Thanks for the `background.js:10-17,26-33` citations — I'll reference them.
