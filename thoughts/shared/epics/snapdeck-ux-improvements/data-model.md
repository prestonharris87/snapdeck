# Data Model — epic `snapdeck-ux-improvements`

> Epic-level data model, authored per feature. Each feature's database-architect
> appends/updates its own section. Snapdeck is a Chrome MV3 extension; its only
> persistent client-side store is **IndexedDB** (the `report` object store driven
> by `getReport` / `setReport` / `addScreenshot()` in `extension/background.js`).
> There is no server-side relational database and no migration framework — schema
> here means the IndexedDB store/record shape, owned and versioned in extension
> code rather than via SQL migrations.

---

## Feature `w0-keyboard-shortcuts` — NO data-model changes (sentinel)

**Decision: sentinel.** This feature introduces **zero** schema/data/storage changes.

### Rationale

- Per `features/w0-keyboard-shortcuts/scope.md` § Out of scope: *"No changes to
  report storage / IndexedDB. The single-`report`-record seam
  (`getReport`/`setReport`/`addScreenshot()`'s persistence tail) is being re-keyed
  by sibling feature `w0-per-target-reports`. This feature must NOT touch that
  surface — it only adds a listener that calls `addScreenshot()`."*
- The feature is **caller-only**: a `manifest.json` `commands` block plus one
  top-level `chrome.commands.onCommand` listener in `extension/background.js` that
  dispatches to the existing **zero-arg `addScreenshot()`** function. The localhost
  guard, visible-tab capture, annotate-overlay handshake, and the IndexedDB
  persistence tail all already live inside `addScreenshot()` and are unchanged.
- No new IndexedDB object store, no new index, no `report` record-shape change, no
  reference/seed data, no retention rule changes.

### Ownership boundary

The IndexedDB `report` object store and its record shape are owned by sibling
feature **`w0-per-target-reports`** this wave (it is re-keying the single-`report`
seam to per-target). That feature's database-architect owns the report-store
section of this document. `w0-keyboard-shortcuts` deliberately does not duplicate
or pre-empt that model — it treats `addScreenshot()` as a stable function-level
seam.

### Cross-domain confirmation

Sentinel status was coordinated with `backend-architect` (owner of the
service-worker / `background.js` work for this feature) before finalizing — see
`features/w0-keyboard-shortcuts/conversations/0002-database-architect-to-backend-architect-msg.md`.

### Migration / rollback strategy

N/A — no schema change to migrate forward or reverse. Forward-only/soft-delete
policy is not engaged because no data is written, altered, or dropped by this
feature.

---

## Feature `w0-per-target-reports` — NO server-side DB changes (sentinel) + ownership handoff

**Decision: sentinel for the server-side database domain.** This feature's only
storage is the browser's **client-side IndexedDB** (`snapdeck`/`kv`) inside the
Chrome MV3 extension service worker — not the project's server-side database.
There is no server-side migration, index, stored-logic, or seed/reference-data
change. See `features/w0-per-target-reports/stories/STORY-db-001.md`.

### Ownership correction (supersedes the earlier pointer)

The header above and the `w0-keyboard-shortcuts` section previously named *this
feature's database-architect* as "owner of the report-store section of this
document." Per the team-lead's authoritative ruling for this run, that is
**reassigned**: the IndexedDB report-store re-keying is **frontend/extension
domain** work, owned by **`frontend-architect`** in this feature's FE story set.
The distinction: "schema" in this MV3 extension means a *browser* IndexedDB
store/record shape, versioned in extension JS — which is frontend/extension
territory, not the server-side migration mechanism that the database-architect
owns. The server-side database-architect role is a sentinel here.

### IndexedDB report-store model (FOR REFERENCE — authored by frontend-architect)

Recorded here only so cross-team readers (backend-architect, future db runs) have
a single map. The authoritative model lives in the FE stories.

- **Store:** existing `snapdeck` DB, existing generic `kv` object store. **No
  version bump** (the `kv` store is already a generic key→value store).
- **Key change:** single global `kv` key `"report"` → per-port key
  `report:<browserPort>`, where `<browserPort>` is derived from the active tab's
  URL via the existing `portOfUrl(url)` seam (the same derivation `saveReport()`
  already uses — no second port-derivation path).
- **Record shape (UNCHANGED):** `{ note: string, screenshots: Screenshot[] }`;
  empty-record default stays `{ note: "", screenshots: [] }`. Only the *key*
  changes, not the value shape.
- **Helpers become port-scoped:** `getReport(port)` / `setReport(port, r)` /
  `clearReport(port)`. Caller-facing signatures (`addScreenshot()`,
  `saveReport()`) stay zero-arg — they resolve the active tab internally and pass
  their own resolved port down into the storage helpers.
- **`GET_STATE` return shape:** `{ count, note, port }` for the current target;
  `{ count: 0, note: "", port: null }` on a non-localhost (non-target) tab.
- **Port-resolution cache (if any):** lives in `chrome.storage.session`
  (MV3-ephemeral-safe), never a module-level service-worker variable. The
  per-port reports themselves stay in IndexedDB (survive service-worker restart).
- **No data migration:** the legacy global `"report"` key is abandoned on upgrade
  (not read-and-ported-forward).

### Migration / rollback strategy

N/A for the server-side DB domain — no server-side schema to migrate forward or
reverse. The IndexedDB key change is non-versioned (same generic `kv` store) and
forward-only by abandonment: the legacy `"report"` record is simply no longer
read; no destructive drop of user data is performed (it is left in place and
ignored). That client-side strategy is owned and detailed by the
frontend-architect.

### Cross-domain confirmation

Ownership handoff coordinated with `frontend-architect` — see
`features/w0-per-target-reports/conversations/0001-database-architect-to-frontend-architect-msg.md`.
