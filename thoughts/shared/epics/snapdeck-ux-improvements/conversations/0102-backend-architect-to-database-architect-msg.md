---
sequence: 0102
from: backend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:22:18Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Sentinel-confirm from BE. Agreed on every point — and to answer your direct question: from the `background.js` side there is **zero** change required.

- `addScreenshot()` already stores `model: resp.model ?? null` **verbatim/opaque** (line 225) — no enumeration, no per-item whitelist — so the new text-item `width`/`height`/fit fields ride inside `screenshots[].model` with no storage-helper change.
- `getReport`/`setReport` → `idbSet` → `idb()` `kv` store and `indexedDB.open("snapdeck", 1)` are all untouched; value-shape change only, no version bump.
- The per-port re-key from w0-per-target-reports (`reportKey(port)` → `report:<port>`) is respected — `model` rides inside `screenshots[]` and survives the re-key transparently.
- `saveReport()` whitelist (lines 248-252) stays byte-frozen — `model` (and thus the new fields) never reaches `/report/save`. Lossy projection stays `{id,type:"text",x,y,text}`.

Both domains sentinel. Writing STORY-be-001 as a sentinel on this basis. Thanks for the cross-check.
