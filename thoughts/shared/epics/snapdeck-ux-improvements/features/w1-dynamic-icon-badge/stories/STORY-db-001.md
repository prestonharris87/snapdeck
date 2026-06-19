---
type: story
id: STORY-db-001
name: "No database changes — badge reads w0 IndexedDB read-only"
domain: database
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: database-engineer
author_architect: database-architect
effort: 1
status: approved
sentinel: true
depends_on: []
diff_estimate: none
files_modified: []
files_not_modified:
  - extension/background.js
  - extension/content/editor-model.js
  - extension/manifest.json
reuse_patterns:
  - "thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:55 — w0-per-target-reports DB sentinel + IndexedDB-is-FE-domain ruling"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/stories/STORY-db-001.md:29 — sibling w1 DB sentinel (chrome.storage is FE-owned, not a DB)"
created_at: 2026-06-19T15:25:00Z
last_run_id: run-20260619-150619-36719
visual_references: []
defects: []
---

# Story: No database changes required for this feature

## What we're doing

**No database changes required for this feature.** This is an explicit
"no work needed" sentinel for the database domain.

`w1-dynamic-icon-badge` turns the static toolbar (`action`) icon into a
per-`tabId` state machine (gray / green / orange+count). The orange count is read
from the **released `w0-per-target-reports`** in-progress report via the
`GET_STATE → { count, note, port }` message path — **consumed READ-ONLY**. The
feature's only new persisted state is a **port-resolution cache** that lives in
**`chrome.storage.session`** (per AC9), a browser-local key→value store owned by
the frontend/extension domain. There is no schema, migration, index, stored-logic,
or reference/seed-data change for the database-architect role to own.

Snapdeck is a Chrome MV3 extension with **no server-side relational DB and no
migration framework** (see `data-model.md` header). Per the standing team-lead
ruling for this epic, even the client-side **IndexedDB** report store is
frontend/extension territory — and `chrome.storage.session` is further still from
any server-side DB. So this domain is genuinely empty here.

## Why this is a sentinel (not substantive)

- **No server-side DB exists.** Snapdeck persists only client-side, in the browser.
  There is nothing to migrate forward/reverse and no migration mechanism to use.
- **The w0 IndexedDB report store is consumed READ-ONLY.** The badge reads
  `count`/`port` via the released `GET_STATE` path (`background.js:167`). This
  feature introduces **no** new IndexedDB object store, **no** new key, **no**
  record-shape change, and **no** `indexedDB.open("snapdeck", N)` version bump. Per
  scope.md § Out of scope, the `report:<port>` keying and `GET_STATE` payload shape
  are *consumed only, never modified* (AC10/AC11 reinforce the read-only boundary).
- **The new cache is FE-owned `chrome.storage.session`.** The port-resolution cache
  (AC2/AC9) is a browser-local, MV3-ephemeral-safe key→value store written and read
  entirely by extension JS in the frontend story set — not a database artifact, and
  not IndexedDB. It owns no `report:*` data.
- **No write path is added.** The feature fires no `report:<port>` write; the
  released `addScreenshot()` / `saveReport()` write seams are read-only-consumed
  (AC11). Live count freshness rides a lightweight notify/push message + a re-read of
  the existing `GET_STATE` path — no new stored state.
- **No reference/seed data.** No permissions, menus, lookups, or localized strings.
  AC13 confirms **no** new `manifest.json` permission either.

## Ownership boundary

- **Port-resolution cache (`chrome.storage.session`)** → `frontend-architect`
  (FE story set). Browser-local UI/extension state, authored in extension JS.
- **IndexedDB `report` store (`snapdeck`/`kv`, `report:<port>` keying)** → unchanged;
  owned by released `w0-per-target-reports` (FE/extension domain). This feature reads
  it via `GET_STATE` only.
- **Released write/read seams** (`addScreenshot`, `saveReport`, `currentTargetPort`,
  `getReport`, `GET_STATE`, `runCaptureCommand`) → unchanged; consumed read-only.

## How we validate it was done correctly

- [ ] No migration / DDL / schema artifact appears in this feature's diff (there is
      no server-side DB or migration mechanism to target).
- [ ] No change to `extension/background.js` IndexedDB helpers
      (`getReport`/`setReport`/`addScreenshot`) or the `report` record shape, and no
      `indexedDB.open("snapdeck", N)` version bump.
- [ ] No new IndexedDB object store or index is introduced.
- [ ] The port-resolution cache appears ONLY as a `chrome.storage.session` key in the
      FE story diff — not in any IndexedDB store and not as new `report:*` data.

## Unit tests

n/a — sentinel story, no schema or data-delivery artifact to verify. Migrations in
this project would normally be verified by running them against a fresh local store
and inspecting the result, but there is no server-side DB and no migration here. The
icon-state / cache pure-logic seams are covered by the FE story's tests, not by a DB
test.

## Dependencies

none — sentinel; no prior DB migration to depend on (this epic has no server-side DB
migrations; prior DB stories are themselves sentinels). The w0 `report:<port>` keying
this feature reads is a *released FE/extension* contract, not a DB-domain dependency.

## Cross-domain contract

Sentinel status was coordinated with `frontend-architect` before finalizing (the
unconditional Phase-5 peer-message floor): confirmed (1) the badge reads the released
w0 `report:<port>` IndexedDB store via `GET_STATE` **READ-ONLY** with no new store /
key / version bump, (2) the port-resolution cache lives in `chrome.storage.session`
(FE-owned, not a DB), and (3) no `report:<port>` write path or reference/seed/
retention data is added. See this feature's `conversations/` log (database-architect
→ frontend-architect, "Confirm w1-icon-badge consumes w0 IndexedDB contract
read-only").

## History

- 2026-06-19 — created by database-architect (effort=1, sentinel, depends on none)
