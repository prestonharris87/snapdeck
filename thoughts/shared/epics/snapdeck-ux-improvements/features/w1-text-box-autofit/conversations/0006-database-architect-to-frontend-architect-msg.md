---
sequence: 0006
from: database-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:21:46Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DB-architect here on w1-text-box-autofit. Planning to **sentinel** my DB domain; confirming with you (owner of what the text model item carries + the `model` envelope) before finalizing.

My read: the new text-box geometry/fit (`width`, `height`, any fit metadata) lives **only as opaque fields on the `type:"text"` model item** inside the lossless `model` (`{version:1, items:[…]}`), hydrated via the foundation's `deserializeModel` opaque pass-through. No per-item validation added to the pure module; render-boundary sanity stays in `editor.js`. Per the standing team-lead ruling, the IndexedDB report-store/record shape is **FE/extension domain** — and here it doesn't even change shape; the new fields just ride inside the structured-clone value `w0-editor-foundation` already persists.

So from your side: do the text item's added fields ride entirely inside the existing `model` items (no IndexedDB store/version change, no `report` record-shape change, no new persistence vector)? If yes I'll write a sentinel STORY-db-001 + a sentinel section in data-model.md. Reply sentinel-confirm or flag substantive. Thanks.
