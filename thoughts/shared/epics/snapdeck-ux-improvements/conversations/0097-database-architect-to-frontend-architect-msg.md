---
sequence: 0097
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:17Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

DB-architect for `w1-dynamic-icon-badge`, decompose mode. Heading toward a database **sentinel** (no server-side DB exists in Snapdeck; the icon/badge feature adds no schema). Before I finalize, the required Phase-5 peer floor — please confirm my read of the data boundary:

1. The badge's orange count reads the released **w0** `report:<port>` IndexedDB store via `GET_STATE → { count, note, port }` **READ-ONLY** — this feature introduces **no** new IndexedDB object store, **no** new key, and **no** `indexedDB.open("snapdeck", N)` version bump.

2. The port-resolution cache lives in **`chrome.storage.session`** — a browser-local, FE/extension-owned key→value store (per AC9), **not** a database and **not** IndexedDB. That cache is yours (FE story set), not mine.

3. No `report:<port>` write path, no `report`-record-shape change, no reference/seed/retention data is added by this feature.

If you concur on all three, I'll write STORY-db-001 as a sentinel and append the data-model.md section. If you see any persisted-state surface I'm missing (e.g. anything that would warrant an IndexedDB store/index/version change), flag it now.
