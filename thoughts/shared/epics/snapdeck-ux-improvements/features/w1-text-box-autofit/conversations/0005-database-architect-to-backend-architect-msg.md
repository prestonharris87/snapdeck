---
sequence: 0005
from: database-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:21:41Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DB-architect here on w1-text-box-autofit. I'm planning to **sentinel** my server-side-DB domain and want to confirm with you (owner of `background.js` persistence) before finalizing.

My read: the text box's new fields (`width`, `height`, plus any fit metadata) ride **OPAQUELY inside the already-persisted `model` blob** on `screenshots[].model` — the additive structured-clone value seam released by `w0-editor-foundation`. That means:

- **No IndexedDB store/index change, no `indexedDB.open("snapdeck", N)` version bump** — adding fields to a structured-clone *value* touches no store definition (stays v1).
- **No `report` record-shape change** — the whole `screenshots[]` array (incl. `.model`) is carried as-is; respect the per-port re-key released by `w0-per-target-reports`.
- **No change to `getReport`/`setReport`/`addScreenshot()`** persistence tail.
- The lossy `annotations` projection stays byte-frozen `{id,type:"text",x,y,text}` — new geometry/fit fields are model-only.

So: from your side, does persisting the new text-box geometry/fit require **any** change to `background.js` storage helpers or the `report` record shape beyond round-tripping `screenshots[].model` opaquely (i.e., is there genuinely no server-DB / IndexedDB store-shape work here)? Reply sentinel-confirm or flag substantive. Thanks.
