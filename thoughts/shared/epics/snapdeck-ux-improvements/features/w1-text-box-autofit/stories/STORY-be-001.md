---
type: story
id: STORY-be-001
name: "Sentinel: no backend changes for the text box"
domain: backend
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: pending
sentinel: true
depends_on: []
diff_estimate: mechanical
files_modified: []
files_not_modified: [extension/background.js]
reuse_patterns:
  - "extension/background.js:215-226 — addScreenshot() stores `model: resp.model ?? null` verbatim/opaque; new text-item fields ride inside screenshots[].model with NO storage change"
  - "extension/background.js:248-252 — saveReport() upstream /report/save field whitelist (model absent); the byte-frozen projection that must stay untouched"
  - "extension/background.js:10-17,26-33 — idb()/idbSet() structured-clone kv-store path; value-shape change only, no db.version bump"
created_at: 2026-06-19T16:12:00Z
last_run_id: run-20260619-150554-36418
defects: []
---

# Story: Sentinel — no backend changes required for this feature

**No backend changes required for this feature.**

The Snapdeck "backend" is the Chrome MV3 service worker (`extension/background.js`);
there is no server-side persistence of in-progress editor state (the loopback
controller only receives the byte-frozen `/report/save` projection). The text-box
auto-fit rework adds opaque fields (`width`, `height`, and any auto-fit metadata the
frontend-architect chooses to persist) to the `type:"text"` item inside the editor
`model`. The **released `w0-editor-foundation` STORY-be-001** contract already covers
this with zero backend change:

- **Opaque verbatim persistence (already shipped).** `addScreenshot()` stores
  `model: resp.model ?? null` **verbatim** at `extension/background.js:225` — it never
  enumerates, validates, or whitelists internal `model.items[]` fields. The new
  `type:"text"` geometry/fit fields ride inside `screenshots[].model` and survive the
  IndexedDB structured-clone round-trip with **no per-screenshot-record change**.
- **Frozen upstream projection (already shipped).** `saveReport()` maps each record
  through an explicit field whitelist (`extension/background.js:248-252`) that does
  **not** include `model`, so the new fields never reach `/report/save` — the upstream
  payload stays byte-identical to pre-feature regardless of what is inside `model`.
- **No store-shape change.** Adding fields to a structured-clone *value* does not alter
  the `kv` object store (`indexedDB.open("snapdeck", 1)` / `createObjectStore("kv")`,
  `extension/background.js:10-17`) — no `db.version` bump, no migration. (Confirmed with
  database-architect; DB also sentinels.)
- **Frozen IPC contract.** The `ANNOTATE` resolve payload's single opaque carrier is
  `model`; the new text-item fields ride **inside** `model.items[]`, not as a new sibling
  field on the resolve payload. No new `chrome.runtime` message type, no new resolve
  field, no controller endpoint touched.

The lossy `annotations` text projection (`{id,type:"text",x,y,text}`) is produced by the
content-script pure module `editor-model.js` (`projectAnnotations`) — a **frontend** concern
owned by STORY-fe-* in this feature, not the service worker. The service worker neither
produces nor reshapes that projection.

**Auth requirement:** unchanged. This path is internal same-extension `chrome.runtime`
messaging (no `externally_connectable`, not web-reachable); the `localhost`/`127.0.0.1`
URL guard (`extension/background.js:197`) and the loopback-only (`127.0.0.1`, no-auth-by-design)
controller are both untouched. This sentinel neither adds nor relaxes any guard.

## Peer coordination (the decision was a team agreement, not a solo assumption)

Confirmed via SendMessage rounds on 2026-06-19, mirrored to
`thoughts/shared/epics/snapdeck-ux-improvements/features/w1-text-box-autofit/conversations/`:

- **frontend-architect** — confirmed the `type:"text"` model item carries
  `{id, type:"text", x, y, width, height, text, …fit}` as plain JSON-serializable
  primitives (structured-clone-safe), rides opaquely inside `model.items[]`, and that
  `projectAnnotations` stays byte-frozen at `{id,type:"text",x,y,text}` (FE owns it; BE
  does not touch it). Agreed: no `background.js` edit, no resolve-payload field, no
  `depends_on` seam.
- **database-architect** — confirmed value-shape-only change: no IndexedDB store/index
  change, no `db.version` bump, no `report` record-shape change; the per-port re-key from
  the released `w0-per-target-reports` (`report:<port>`) carries `screenshots[].model`
  transparently. DB also sentinels.

## Dependencies

None. This is a no-work sentinel — the released opaque `model` persistence already covers
the text box.

## History

- 2026-06-19 — created by backend-architect as a sentinel (no backend work). No-work
  decision confirmed with frontend-architect (text-item field shape + frozen projection)
  and database-architect (store-shape unchanged) via SendMessage before writing. Basis:
  released w0-editor-foundation STORY-be-001 opaque `model` persistence
  (`extension/background.js:225`) + frozen `saveReport()` whitelist (lines 248-252).
