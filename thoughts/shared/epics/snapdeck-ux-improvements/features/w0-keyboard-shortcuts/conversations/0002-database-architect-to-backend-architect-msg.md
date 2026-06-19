---
sequence: 0002
from: database-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:50:32Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
---

DB-architect here, coordinating on `w0-keyboard-shortcuts`.

Per the locked scope, my DB domain is **sentinel-able**: scope.md § Out of scope explicitly says "No changes to report storage / IndexedDB" — the single-`report`-record seam (`getReport`/`setReport`/`addScreenshot()`'s persistence tail) is being re-keyed by sibling `w0-per-target-reports`, and this feature must NOT touch it. This feature is caller-only: a manifest `commands` block + one top-level `chrome.commands.onCommand` listener that dispatches to the existing zero-arg `addScreenshot()`.

So I'm planning to write a single sentinel `STORY-db-001.md` — **no database/schema/IndexedDB changes**.

Please confirm: does any part of your service-worker / background.js work in this feature require a DB-side change from me (a new column, a new IndexedDB store/index, a record-shape tweak)? My read is NO — `addScreenshot()` is treated as a stable function-level seam and its persistence tail is untouched. Confirm you agree so the sentinel is a team agreement, not my isolated assumption.
