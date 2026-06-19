---
type: story
id: STORY-db-001
name: "No database changes — toolbar pref is FE chrome.storage.local"
domain: database
parent_feature: w1-draggable-toolbar-toggle
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
  - extension/content/editor.js
reuse_patterns:
  - "thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:121 — w0-editor-foundation DB sentinel (additive value-shape change = FE/BE domain, DB sentinel)"
  - "thoughts/shared/epics/snapdeck-ux-improvements/data-model.md:55 — w0-per-target-reports DB sentinel + IndexedDB-is-FE-domain ruling"
created_at: 2026-06-19T15:30:00Z
last_run_id: run-20260619-042600-10898
visual_references: []
defects: []
---

# Story: No database changes required for this feature

## What we're doing

**No database changes required for this feature.** This is an explicit
"no work needed" sentinel for the database domain.

`w1-draggable-toolbar-toggle` is an editor-chrome ergonomics feature: a draggable
toolbar grab handle and a non-destructive annotation-visibility toggle. Its only
persistence is the **toolbar position**, written to **`chrome.storage.local`** under
a dedicated UI-chrome key (e.g. `snapdeckEditorToolbarPos: {left, top}`). The
visibility toggle persists nothing (resets to "shown" on every `openEditor()`).

`chrome.storage.local` is a **browser-local key→value store owned by the
frontend/extension domain**, not the project's server-side database. Snapdeck is a
Chrome MV3 extension with **no server-side relational DB and no migration
framework** (see `data-model.md` header). Per the standing team-lead ruling for this
epic, even the client-side **IndexedDB** store/record shape is frontend/extension
territory — and `chrome.storage.local` is further still from any server-side DB. So
there is genuinely no schema, migration, index, stored-logic, or reference/seed-data
change in this feature for the database-architect role to own.

## Why this is a sentinel (not substantive)

- **No server-side DB exists.** Snapdeck persists only client-side, in the browser.
  There is nothing to migrate forward/reverse and no migration mechanism to use.
- **Toolbar position is FE-owned `chrome.storage.local`.** `extension/content/editor.js`
  has **zero** `chrome.storage`/`indexedDB` usage today (verified 2026-06-19), so the
  new toolbar-position key is net-new browser-local UI-chrome state authored entirely
  in extension JS by the frontend story set — not a DB artifact.
- **Toggle persists nothing.** Visibility is pure view state (`annLayer.visible()` +
  hide selection chrome), never written to any store.
- **No IndexedDB `report`-store touch.** scope.md § Out of scope is explicit: toolbar
  position lives in `chrome.storage.local`, NOT the IndexedDB report store
  (`snapdeck`/`kv`, released `w0-per-target-reports`) and NOT the editor `model`
  envelope (frozen `editor-model.js`, released `w0-editor-foundation`). No new object
  store, no index, no `indexedDB.open("snapdeck", N)` version bump, no record-shape
  change.
- **No reference/seed data.** No permissions, menus, lookups, or localized strings.

## Ownership boundary

- **Toolbar-position persistence (`chrome.storage.local`)** → `frontend-architect`
  (FE story set). It is browser-local UI-chrome state, authored in extension JS.
- **IndexedDB `report` store (`snapdeck`/`kv`)** → unchanged; owned by released
  `w0-per-target-reports` (FE/extension domain). This feature does not touch it.
- **Editor `model` envelope** → unchanged; frozen by released `w0-editor-foundation`
  (`editor-model.js`).

## How we validate it was done correctly

- [ ] No migration / DDL / schema artifact appears in this feature's diff (there is
      no server-side DB or migration mechanism to target).
- [ ] No change to `extension/background.js` IndexedDB helpers
      (`getReport`/`setReport`/`addScreenshot`) or the `report` record shape.
- [ ] No change to `extension/content/editor-model.js` (`model` envelope frozen).
- [ ] Toolbar-position persistence appears ONLY as a `chrome.storage.local` key in the
      FE story diff — not in any IndexedDB store or the `model`.

## Unit tests

n/a — sentinel story, no schema or data-delivery artifact to verify. Migrations in
this project would normally be verified by running them against a fresh local store
and inspecting the result, but there is no server-side DB and no migration here. The
toolbar-position serialize/clamp pure-logic seam is covered by the FE story's
`*.test.mjs` (per scope.md § Test convention), not by a DB test.

## Dependencies

none — sentinel; no prior DB migration to depend on (this epic has no server-side DB
migrations; prior DB stories are themselves sentinels).

## Cross-domain contract

Sentinel status was coordinated with `frontend-architect` before finalizing (the
unconditional Phase-5 peer-message floor): confirmed (1) toolbar position lives in
`chrome.storage.local` (FE-owned), and (2) this feature does not touch the IndexedDB
`report` store or the `model` envelope. See this feature's `conversations/` log
(database-architect → frontend-architect, "Confirm DB sentinel — toolbar pos in
chrome.storage.local").

## History

- 2026-06-19 — created by database-architect (effort=1, sentinel, depends on none)

## Security Review

### Finding 1 — DB sentinel: no entity table means audit-column / tenancy / injection checks are N/A (clean)

**Severity:** info (FYI — no finding, no action)
**Threat (STRIDE: Repudiation / Tampering).** This sentinel asserts no server-side
DB / migration / schema change. The data-store-side default-checklist items are N/A
by construction — recorded so the PO sees they were applied, not skipped:
- **Audit columns (created-by/changed-by/changed-at):** N/A — no server entity
  table is created; toolbar position is browser-local `chrome.storage.local`
  key→value (FE-owned), not an audited DB row.
- **Soft-delete (inactive/deleted flag):** N/A — no DB record lifecycle; the single
  `snapdeckEditorToolbarPos` key is overwritten in place.
- **Injection / parameterization:** N/A — no SQL/DB query of any kind (no
  server-side DB exists in this project).
- **Multi-tenant isolation:** N/A — single-user local tool, no tenancy model.
- **Unbounded growth:** N/A — a single fixed `chrome.storage.local` key (not the
  per-`prefix:<id>` IndexedDB re-keying pattern that the lessons file flags for
  growth), so no orphan-key accumulation.
**Recommendation:** none. The 4 validate items already pin the no-DDL / no-IndexedDB
/ no-`model`-touch / position-only-in-`chrome.storage.local` assertions. Disposition:
**clean — accept.**

**PO disposition:** ACCEPT_AS_RECOMMENDATION — Finding 1 (INFO, clean): the DB sentinel asserts no server-side DB / migration / schema change (Snapdeck has no server-side DB), so audit-column / soft-delete / injection / multi-tenant / unbounded-growth checks are N/A by construction — toolbar position is a single fixed browser-local `chrome.storage.local` key (FE-owned), not an audited DB row. The 4 validate items pin the no-DDL / no-IndexedDB / no-`model`-touch / position-only assertions. No action.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**Ratified, no content change.** Sentinel verdict (no DB work) is sound: Snapdeck has
no server-side DB / migration mechanism, and toolbar position lives in
`chrome.storage.local` (FE-owned), not the IndexedDB `report` store or the frozen
`model` envelope — consistent with scope.md § Out of scope and feature.md. Frontmatter
is template-conformant (`type/domain/parent_feature/parent_epic/sentinel`) and the
`## How we validate` checklist already carries 4 `- [ ]` items, so no sentinel-gap fix
was needed here (unlike be-001). Status `pending → approved`.
