---
id: STORY-db-001
name: "Sentinel — no database changes for keyboard-shortcut feature"
assignee: database-engineer
author_architect: database-architect
status: pending
sentinel: true
greenfield: true
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/background.js
  - extension/manifest.json
reuse_patterns: []
depends_on: []
---

# DB-001: Sentinel — no database changes for keyboard-shortcut feature

**No database changes required for this feature.**

## What we're doing

Nothing in the data layer. `w0-keyboard-shortcuts` is a caller-only feature: it
adds a `manifest.json` `commands` block and one top-level
`chrome.commands.onCommand` listener in `extension/background.js` that dispatches
to the existing **zero-arg `addScreenshot()`** function — the same code path the
popup's `ADD_SCREENSHOT` message already uses. No storage, schema, IndexedDB
object store, index, record shape, reference data, or retention rule is created,
altered, or dropped.

## Why this is a sentinel

- The locked scope (`scope.md` § Out of scope) explicitly states: **"No changes
  to report storage / IndexedDB."** The single-`report`-record seam
  (`getReport` / `setReport` / `addScreenshot()`'s persistence tail) is being
  re-keyed this wave by sibling feature **`w0-per-target-reports`**, which owns
  that surface. This feature must NOT touch it.
- `addScreenshot()` is treated as a stable function-level seam; the localhost
  guard, visible-tab capture, annotate-overlay handshake, and the IndexedDB write
  all already live inside it and are unchanged.
- Snapdeck has no server-side relational database and no SQL migration mechanism;
  the only persistent store is IndexedDB, owned in extension code — and this
  feature writes none of it.

## Cross-domain contract

Sentinel status was confirmed with `backend-architect` (owner of the
service-worker / `background.js` work for this feature) before finalizing. See
`../conversations/0002-database-architect-to-backend-architect-msg.md`. The
agreement: `addScreenshot()` is consumed as-is; no DB-side column/store/index/
record-shape change is needed by the new `commands` listener.

## How we validate

No migration to run — there is no schema artifact. The database-validator's check
is simply that the database story diff is **empty** (the engineer makes no data-
layer edits) and that no `extension/background.js` storage path
(`getReport`/`setReport`/the `report` record shape) is modified by any story in
this feature. If a data-layer change ever appears in this feature's diff, this
sentinel is wrong and must be reopened.

## Unit tests

None. Sentinel stories carry no migration and no schema to inspect against a
fresh local DB. The storage layer for the `report` object store is exercised by
sibling feature `w0-per-target-reports`, not here.

## Dependencies

None. `depends_on: []` is valid here because this is a sentinel that creates and
consumes no schema. The IndexedDB `report` store it deliberately does NOT touch
is owned by sibling `w0-per-target-reports` (separate feature, separate stories).
