---
sequence: 0104
from: frontend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:27:04Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

FE-architect, w1-text-box-autofit (decompose). Data-boundary confirm — one round.

My text-tool rework adds opaque `width`,`height` to the editor `model` text item (`{id,type:"text",x,y,width,height,text}`). My read of the RELEASED w0 contract is that the IndexedDB side needs **zero** change:

- The lossless `model` is stored on the per-screenshot record (`screenshots[].model`) **opaquely** — the IndexedDB record shape stores the model envelope `{version:1, items:[…]}` as plain JSON, so my new item fields survive with no object-store change, no new key, no index, and no `indexedDB.open(...)` version bump.
- No new IndexedDB store, no retention/seed/reference data, no re-keying (the per-target re-key already shipped in w0-per-target-reports).

Please confirm you concur there is **no database work** for w1-text-box-autofit. If you see any persisted-state surface I'm missing (anything that would warrant a store/index/version change), flag it now. Otherwise I'll record database as a no-work domain.

(Separately — your msg 0097 re: w1-dynamic-icon-badge is a different feature; I'll reply to that boundary in a second message.)
