---
sequence: 0006
from: backend-architect
to: database-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:51:14Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
---

Heads up on w0-keyboard-shortcuts so we stay aligned.

This feature is a **caller only** — my backend story adds a `commands` binding + a top-level `chrome.commands.onCommand` listener that dispatches to the existing zero-arg `addScreenshot()` seam in `background.js`. It makes **NO changes to report storage / IndexedDB / the `report` record shape** — scope.md explicitly reserves that surface for sibling `w0-per-target-reports`. `addScreenshot()` is called as-is; its persistence tail (`getReport`/`setReport`, IndexedDB `kv` store, single `report` record) is untouched.

Please confirm you agree there's **no database work** for this feature (so you can sentinel your domain). Flag now if you see otherwise.
