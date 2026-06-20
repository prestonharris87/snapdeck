---
type: feature
slug: w2-screenshot-gallery
wave: 2
parent_epic: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
depends_on: [w0-per-target-reports, w0-editor-foundation]
frontend_lane: N/A
visual_references: []
---

# Feature: Screenshot gallery — review, re-open / edit, delete

## Summary

From the popup, let the developer/tester review the screenshots in the **current
target's** in-progress report as a thumbnail grid, click a thumbnail to re-open
that shot in the **existing in-page editor** on its stored PNG (lossless re-edit),
`✓ Done` to re-save/replace the record, or `Delete` a single shot behind a
confirmation step (updating the count + badge). It turns a write-only report
(today the popup shows only a count) into a reviewable, correctable surface.
It rests on two released Wave-0 foundations: `w0-per-target-reports` (the
per-port `report:<browserPort>` store — *which* report's thumbnails to show) and
`w0-editor-foundation` (lossless `model` persistence + the released
`ANNOTATE {image, model}` → `openEditor` → `deserializeModel` → guarded `render()`
re-open seam — *what makes* the re-edit round-trip exact). The popup + re-open-entry
work is a distinct region (`extension/popup/*` + new `background.js` message
handlers) from the rectangle tool's `editor.js` annotation-shape rewrite, keeping
the two Wave-2 features parallel-safe.

## User-facing behavior

In the popup, below the existing note / Add / Save / Clear chrome, the current
target's report renders as a **thumbnail grid** — one tile per screenshot in
capture order, each showing the stored annotated thumbnail and a `Delete` affordance.

- **On a non-target tab** (no resolvable `localhost`/`127.0.0.1` port) or a target
  whose report is empty, the grid shows an **empty state** ("No screenshots in
  this target's report yet") — no tiles.
- **Clicking a tile** re-opens that screenshot in the **same in-page editor
  overlay** on the current target tab, drawn on the shot's stored `original` PNG
  with its persisted annotations restored exactly. The popup closes (as the
  `Add screenshot` flow already does) so the overlay is usable. The user edits as
  during capture; `✓ Done` re-saves the edited version back into the report
  (replacing that one record), and `Cancel` leaves the stored record unchanged.
- **The original page need not be live.** The stored PNG covers the surface, so a
  navigated-away or reloaded page re-edits fine. The overlay only needs the current
  target tab to have the content script registered; if it does not (e.g. the page
  loaded before the extension), the popup surfaces the existing graceful
  "reload the page so the content script loads" error — never a silent failure.
- **Clicking `Delete` on a tile** prompts a confirmation step; confirming removes
  exactly that screenshot from the current target's report and the count (popup
  header + toolbar badge) drops by one. Cancelling the confirm changes nothing.
  Deleting the **last** screenshot leaves the target with an empty report (the
  store retains no stale entry).

## UX patterns / interaction notes

`skip_ui_designer: true`, `frontend_lane: N/A` — Snapdeck is a vanilla MV3
extension; the popup is plain HTML/CSS (`extension/popup/popup.html` + `popup.css`)
with no component-library or design-token layer. The frontend-architect specs the
grid + delete-confirm **inline against the existing `popup.css` patterns** (the
`.sd-*` class family). No ui-designer round.

- **Thumbnail grid.** A responsive 2–3 column grid of fixed-aspect tiles under the
  existing status row. Each tile renders the stored thumbnail (the annotated PNG,
  or the original when a shot has no annotations) scaled down; tiles are keyboard-
  and click-activatable. The grid refreshes on popup open and after any delete.
- **Delete-confirm affordance.** Destructive, so gated. Reuse a lightweight in-popup
  confirm (e.g. the tile's `Delete` flips to a `Confirm? ✓ / ✕` inline two-button
  state, or a `window.confirm`) — the architect picks one consistent with `popup.css`;
  the load-bearing contract is *a second deliberate action is required before a
  screenshot is removed*. Cancelling restores the resting state with no mutation.
- **Re-open overlay behavior.** Re-open reuses the released in-page overlay verbatim
  via `ANNOTATE {image, model}`; the popup is closed by the time the overlay mounts.
  Re-edit happens at screenshot-native sizing on the stored PNG. If an overlay is
  already open on that tab (`active` guard, `editor.js:15`), the re-open is a no-op
  (`{cancelled:true, busy:true}`) rather than a double-mount.

```
 ┌──────────────────────────────────────┐
 │ ▟  Snapdeck                      [3]  │   ← existing header + live count
 │ Report note (optional)  [____________]│
 │ [ ＋ Add screenshot ]                 │
 │ [ ✓ Save report ]   [ Clear ]         │
 │ ───────────────────────────────────── │
 │  Screenshots in this report           │
 │  ┌───────┐ ┌───────┐ ┌───────┐        │   ← thumbnail grid (click = re-open)
 │  │ thumb │ │ thumb │ │ thumb │        │
 │  │  #1   │ │  #2   │ │  #3   │        │
 │  │ [Del] │ │ [Del] │ │ [Del] │        │   ← Del → inline "Confirm? ✓ ✕"
 │  └───────┘ └───────┘ └───────┘        │
 └──────────────────────────────────────┘

 Empty state (non-target / empty report):
 │  Screenshots in this report           │
 │  No screenshots in this target's      │
 │  report yet.                          │
```

## Acceptance criteria

- [ ] **Gallery render.** The popup renders a thumbnail per screenshot in the
  **current target's** per-port (`report:<browserPort>`) report, in capture order,
  via a new zero-port-arg background message that returns the current target's
  `screenshots[]` as `{ index, thumbnail-source, light meta }`. The thumbnail
  source is the stored annotated PNG (or `original` when a shot has no annotations).
- [ ] **Empty state.** A non-target tab (`currentTargetPort()` → `null`) or a target
  with an empty report renders the empty state with **no** thumbnails (the fetch
  returns `getReport(null|port)` → `screenshots: []`).
- [ ] **Click → lossless re-open (model-byte).** Clicking a thumbnail re-opens that
  screenshot in the in-page editor via the **released** seam —
  `ANNOTATE { image: shot.original, model: shot.model }` → `openEditor(image, model)`
  (`editor.js:14-24`) → `deserializeModel` (`editor-model.js:72`, opaque pass-through)
  → guarded `render()`. The restored model is **model-byte identical**: the
  deserialized items `deepEquals` the stored `shot.model.items`. (Lossless = model
  bytes, **not** a pixel/screenshot diff of the re-render — see scope §3.)
- [ ] **Overlay reuse, inherited guards, page-independent.** Re-open reuses the
  existing overlay at screenshot-native sizing on the **current target tab**; the
  original page need not be live (the stored PNG covers it). Re-open **inherits the
  released render guards verbatim** — `RENDER_ITEM_CAP = 500`, `RENDER_TEXT_CAP =
  10000` (`editor.js:192-193`) and the text-box clamp / clamped-inset short-circuit
  — with **no** guard bypass, fork, or re-implementation.
- [ ] **Graceful no-host / busy.** If the current target tab has no content-script
  host, re-open fails with the existing reload-the-page error
  (mirror `background.js:280`) — never a silent failure. If an overlay is already
  open on that tab, re-open is a no-op (`{cancelled:true, busy:true}`), not a
  double-mount.
- [ ] **Done re-saves / replaces (model-byte).** On `✓ Done` the editor re-emits
  `serializeModel(model)` (`editor.js:486`); the feature **replaces** that one
  record in `report:<port>` with: `model` **model-byte identical** to the emitted
  `{version:1, items}` envelope, `annotated` + lossy `annotations` re-rendered,
  `original` **unchanged** (same stored PNG), and `console` / `network` / meta
  (`url` / `title` / `captured_at` / `viewport`) **preserved from the pre-edit
  record** — NOT overwritten by the re-edit host tab's live buffers/meta. All other
  screenshots in the report are untouched.
- [ ] **Delete behind a confirm.** `Delete` is a destructive per-thumbnail control
  gated behind a confirmation step; confirming removes **exactly** that screenshot
  from the current target's report; cancelling the confirm changes nothing.
- [ ] **Count + badge update on delete.** A confirmed delete decrements the report
  count and emits `REPORT_COUNT_CHANGED` (the `chrome.storage.session` tick from
  `w0-per-target-reports` STORY-fe-003) with the new count, so the dynamic icon
  badge reflects it. A re-save (edit) does **not** change the count.
- [ ] **GC — Delete owns cleanup.** A Delete that empties the report leaves the
  store with **no populated/stale `report:<port>` entry** — the report reads as
  empty (`getReport(port).screenshots.length === 0`, count `0`). (Architect locks
  the mechanism — remove the IDB key vs. write the empty record — but the
  observable is: no stale screenshots persist; see scope §4 and Scope ambiguity below.)
- [ ] **Bounded arbitrary-model re-open (security).** Re-opening a screenshot whose
  stored `model` is hostile / oversized / corrupted (arrow + box + text + rectangle,
  including numerically-hostile geometry and oversized text) renders **bounded** —
  no throw, no hang, no console error — via the inherited guards. The caps are **not**
  weakened. (Defense-in-depth: the model is from the extension's own IndexedDB,
  isolated-world, not page-writable — see scope §2.)
- [ ] **No mid-edit wrong-record corruption (stable-identity).** Because the popup is
  re-openable while an in-page re-edit overlay is still active, a `Delete` of a *sibling*
  screenshot can splice the report array mid-edit. Re-open / re-save / delete therefore
  address records by a **stable identity** (synthesized from the preserved `captured_at`
  + `original` fields), never by array position: a mid-edit sibling delete never corrupts
  a bystander record, and a `✓ Done` whose target was itself deleted mid-edit is a
  **fail-safe no-op** (the edit is discarded; no record is created or overwritten). No
  throw, no `console.error`.
- [ ] **Zero-port-arg, stable-identity API / two-port isolation.** Fetch, re-open, and
  delete resolve the current target port **internally** via `currentTargetPort()`;
  callers pass a **stable per-screenshot identity** (the `captured_at` + `original`
  synthesis above — NOT the array index) as the mutation handle, never a port; the
  display `#N` index is presentation-only. An identity-scoped mutation in target A never
  touches target B's `report:<port>` record (write-key ≡ read-key); a mutation whose
  identity is absent from the current target's report is a no-op.
- [ ] **No DOM-XSS sink in the gallery render (output encoding) [security].** The popup
  builds thumbnail tiles and labels via `createElement` + `textContent` + `img.src` only —
  **no** `innerHTML` / `insertAdjacentHTML` / raw-HTML / template-string-to-HTML sink in the
  gallery render. Stored fields that trace to capture-time page data (`thumbnail` data-URL,
  `title`, `url`, `#N` badge) are written as attributes/properties or `textContent`, never
  parsed as HTML (the `thumbnail` is an inert base64 PNG data-URL in `img@src`). A grep of
  the new `popup.js` gallery code finds zero raw-HTML sinks.
- [ ] **Out-of-scope untouched.** The feature does NOT modify `editor.js`
  draw/render/shape logic, the `model` envelope / `deserializeModel` /
  render-boundary guards, or the per-port report-store keying contract
  (`report:<port>`, `getReport`/`setReport`/`clearReport`, `portOfUrl`,
  `currentTargetPort`) beyond the new message handlers — all consumed **as released**.

## In scope

- **Gallery render.** The popup renders thumbnails of the current target's per-port
  (`report:<browserPort>`) in-progress-report screenshots. A new background message
  returns the current target's `screenshots[]` (index + thumbnail source + light
  metadata); the popup lays them out as a thumbnail grid. Non-target / empty report
  → empty state (no thumbnails).
- **Re-open on the stored PNG.** Clicking a thumbnail re-opens that screenshot in
  the **existing in-page editor** via the **released** seam:
  `ANNOTATE { image: shot.original, model: shot.model }` → `openEditor(image, model)`
  (`editor.js:14-24`) → `deserializeModel` (opaque pass-through, `editor-model.js:72`)
  → guarded `render()`. The persisted `model` (`{version:1, items:[…]}`) is restored
  exactly (model-byte), and the shot's stored `console` / `network` buffers are
  preserved across the round-trip.
- **Overlay reuse, page-independent.** Re-edit reuses the existing in-page overlay at
  screenshot-native sizing; the **original page need not be live** because the stored
  PNG covers the surface. The overlay is hosted on the **current target tab** (where
  `editor.js` is registered on localhost). If no content-script host is available,
  fail gracefully with the existing "reload the page so the content script loads"
  style error (`background.js:280`) — never a silent failure.
- **Done re-saves / replaces.** On `✓ Done`, the editor re-emits `serializeModel(model)`
  (`editor.js:486,493`); the feature **replaces** that one screenshot record in
  `report:<port>` with the edited version — new `model` (model-byte lossless),
  re-rendered `annotated` + lossy `annotations`, **`original` unchanged** (same stored
  PNG), and `console` / `network` / `meta` preserved. Other screenshots in the report
  are untouched.
- **Delete behind a confirm.** `Delete` is a destructive per-thumbnail control gated
  behind a confirmation step; confirming removes that screenshot from the current
  target's report (`report:<port>` record). Cancelling the confirm changes nothing.
- **Count + badge update on delete.** Deleting decrements the report count and emits
  `REPORT_COUNT_CHANGED` (the `chrome.storage.session` tick established by
  `w0-per-target-reports` STORY-fe-003) so the dynamic icon badge
  (`w1-dynamic-icon-badge` consumer) reflects the new count.
- **GC home — fold cleanup into Delete.** This feature is the GC home for unbounded
  `report:<port>` growth (per-target LOW-2 forward-flag). Delete shrinks the record;
  when a Delete empties the report, **clear the `report:<port>` record** rather than
  persisting a stale empty entry, so the store does not accumulate empty/stale records.
- **New zero-port-arg message API.** New `background.js` message handlers for
  fetch-report-screenshots, re-open-and-resave (by index/id), and delete (by index/id).
  Following the released pattern, callers pass an **index/id only** — the handler
  resolves the current target port internally via `currentTargetPort()`; an
  index-scoped mutation never touches another port's record (write-key ≡ read-key).

## Out of scope

- **The rectangle tool / `editor.js` annotation-shape rewrite** — owned by
  `w2-rectangle-tool`. This feature **consumes** the editor via the `ANNOTATE`
  message only and does **not** modify `editor.js` draw/render/shape logic.
- **The editor `model` envelope, `deserializeModel`, the render-boundary guards
  (`RENDER_ITEM_CAP` / `RENDER_TEXT_CAP` / `isFiniteNum`), and text-box auto-fit** —
  all consumed **as released**. Must NOT be re-implemented, forked, or bypassed.
- **The per-port report-store keying and the `GET_STATE` payload shape** — owned by
  released `w0-per-target-reports`. Consumed read + index-scoped mutation via the new
  messages; the keying contract (`report:<port>`, `getReport`/`setReport`/`clearReport`,
  `portOfUrl`) is **unchanged**.
- **The upstream `/report/save` controller contract and the saved `report.json`
  projection** — unchanged; this feature only edits the **local** in-progress store.
- **Cross-port / cross-worktree report GC beyond Delete** — stale `report:<otherPort>`
  records left by abandoned worktrees are not user-driven and are **not** addressed
  here (flagged residual; expand only on BOSS direction).
- **Cross-font-environment pixel/line identity** of a re-rendered annotation — NOT
  guaranteed (only model-byte identity is; see scope Critical directives §3).
- **Capture / annotate behavior, the localhost guard, and the controller `/resolve`
  contract** — unchanged.

## E2E test spec (written by Product Owner)

> Note (testing.md gotcha): none of these specs involve a web-app hard-refresh /
> re-login — Snapdeck is an MV3 extension whose `report:<port>` IndexedDB store has
> no login screen and survives service-worker eviction (consistent with the released
> w0 siblings). The gallery is read-on-popup-open; no SW-restart step is required.
> The Konva-render-dependent scenarios (re-open / hostile-model) run in the
> **browser-tester Playwright lane**, not `node --test`.

### Test: Gallery renders N thumbnails; non-target shows the empty state

**Given** the current target tab is `http://localhost:5101/` and its
`report:5101` record holds 3 screenshots
**When** the popup opens and requests the current target's screenshots (the new
fetch message)
**Then** the grid renders exactly 3 thumbnails in capture order, each with a
`Delete` affordance
**And When** the active tab is a non-target (`https://example.com/`, or a localhost
tab with an empty report)
**Then** the fetch returns `screenshots: []` and the grid shows the empty state
with zero thumbnails.

### Test: Click → re-open restores the model (model-byte), Done replaces the record

**Given** `report:5101` screenshot `#2` has a stored `model = {version:1, items:[…]}`
(arrow + text-box) and stored `console` / `network` buffers
**When** the user clicks thumbnail `#2` → the feature sends
`ANNOTATE { image: shot.original, model: shot.model }` to the current target tab and
the editor opens
**Then** the editor's deserialized `model.items` `deepEquals` the stored
`shot.model.items` (model-byte restore; no item dropped, reordered, or coerced)
**And** the overlay is drawn on the stored `original` PNG at screenshot-native sizing
**And When** the user edits (e.g. moves the arrow) and clicks `✓ Done`
**Then** `report:5101[2]` is **replaced** such that: `model` is model-byte identical to
the emitted `serializeModel(model)` envelope; `annotated` + `annotations` are
re-rendered; `original` is **unchanged** (byte-equal to the pre-edit `original`);
`console` / `network` / `url` / `title` / `captured_at` / `viewport` are **preserved
from the pre-edit record** (NOT replaced by the re-edit host-tab buffers/meta)
**And** screenshots `#1` and `#3` are byte-unchanged
**And** no uncaught error or `console.error` is emitted during the round-trip.

### Test: Delete behind a confirm — count decrements, badge ticks; cancel is a no-op

**Given** `report:5101` holds 3 screenshots and the popup grid is showing them
**When** the user clicks `Delete` on thumbnail `#2` and **cancels** the confirm
**Then** the report still holds 3 screenshots, the count is unchanged, and **no**
`REPORT_COUNT_CHANGED` tick is emitted
**And When** the user clicks `Delete` on `#2` again and **confirms**
**Then** `report:5101` holds exactly 2 screenshots (the former `#1` and `#3`), the
popup count reads `2`, and a `REPORT_COUNT_CHANGED { port:5101, count:2 }` tick is
emitted on `chrome.storage.session` (the badge consumer repaints)
**And** the deleted record is exactly the one that was at index `2` (siblings intact).

### Test: Deleting the last screenshot clears the report record (GC)

**Given** `report:5101` holds exactly 1 screenshot
**When** the user `Delete`s it and confirms
**Then** the report reads as empty — `getReport(5101).screenshots.length === 0`,
`GET_STATE.count === 0` — with **no stale populated `report:5101` entry** left in the
store, and a `REPORT_COUNT_CHANGED { port:5101, count:0 }` tick is emitted.

### Test: Bounded re-open of a hostile / oversized stored model (security — Konva lane)

**Given** a `report:5101` screenshot whose stored `model.items` is crafted hostile —
mixed arrow + box + text + rectangle items with numerically-hostile geometry
(`NaN` / `Infinity` / negative / huge coords), an item count `> RENDER_ITEM_CAP` (500),
and a text item `> RENDER_TEXT_CAP` (10000 chars)
**When** the user clicks that thumbnail to re-open it (browser-tester Playwright lane —
Konva-render-dependent, not `node --test`)
**Then** the overlay mounts and `render()` completes **bounded** — no thrown error,
no hang, and **no** `console.error` — because re-open inherits the released
`RENDER_ITEM_CAP` / `RENDER_TEXT_CAP` caps and the text-box clamp/short-circuit
verbatim (caps not weakened, guards not bypassed).

### Test: Two-port isolation — edit/delete in target A never touches target B

**Given** `report:5101` (target A) holds 2 screenshots and `report:5102` (target B)
holds 3, and target A's tab is active
**When** the user re-saves screenshot `#1` and deletes screenshot `#2` in A's gallery
(the handlers resolve `currentTargetPort()` → `5101` internally; the popup passes only
index/id)
**Then** `report:5101` reflects the edit + delete, while `report:5102` is **byte-for-byte
unchanged** (count 3, every record identical) — the index-scoped mutation never
resolved to B's port.

### Test: Re-open on a tab with no content-script host fails gracefully

**Given** the current target tab `http://localhost:5101/` loaded before the extension
(no `editor.js` content-script host)
**When** the user clicks a thumbnail to re-open it
**Then** the feature returns the existing graceful error ("could not open the annotation
overlay (reload the page so the content script loads): …", mirroring `background.js:280`)
and the popup surfaces it — never a silent failure, and the stored record is unchanged.

### Test: Mid-edit sibling delete never corrupts the re-edited record (stable-identity — Konva lane)

**Given** `report:5101` holds 3 screenshots and the user clicks the tile for the
screenshot with stable identity `sid_B` (the former `#2`); the editor opens on its
stored `original` PNG and the popup closes
**And When** while that overlay is still active the user re-opens the popup (toolbar
icon), the grid re-fetches, and the user confirms a `Delete` on the screenshot with
identity `sid_A` (the former `#1`, a **lower** display index) — the array splices and
the count ticks to `2`
**And When** the user finishes editing `sid_B` and clicks `✓ Done`
**Then** the re-save resolves the record by **`sid_B`** (re-reading the shifted report
and matching on identity, not array position) and overwrites exactly that record's
`model` / `annotated` / `annotations`; the bystander record (former `#0`) is
**byte-unchanged** across `model` / `annotated` / `annotations` / `original` / `console`
/ `network` / meta
**And** no uncaught error or `console.error` is emitted
**And When** instead the user had deleted the **very shot being re-edited** (`sid_B`)
mid-edit and then clicked `✓ Done`
**Then** the re-save finds **no** record matching `sid_B` and is a **fail-safe no-op** —
the report still holds the surviving 2 screenshots; no record is created, overwritten,
or corrupted; no throw, no `console.error`.

### Motion E2E (required for any UI feature; write `n/a` for backend-only)

**n/a** — `frontend_lane: N/A`. Snapdeck's popup is plain HTML/CSS with no
component-library / design-token motion catalog; the thumbnail grid and inline
delete-confirm are instantaneous DOM updates with no branded transition tokens, and
the re-open overlay is the released in-page editor (its only motion is default
`Konva.Transformer` handle chrome, owned upstream). Consistent with every released
sibling in this epic (all `frontend_lane: N/A`, all `Motion E2E: n/a`).

## Stories (populated by architects)

- [ ] STORY-fe-001 — Gallery fetch + delete report-screenshot handlers + GC (frontend-engineer)
- [ ] STORY-fe-002 — Re-open + preserve-from-record re-save handler (frontend-engineer)
- [ ] STORY-fe-003 — Popup thumbnail grid + delete-confirm UI (frontend-engineer)
- [ ] STORY-be-001 — <summary> (backend-engineer)
- [ ] STORY-db-001 — DB sentinel: no server-side DB change; gallery rides released `report:<port>` IndexedDB (FE/extension-owned) [sentinel] (database-engineer)
- [ ] STORY-do-001 — DevOps sentinel: no manifest/build/CI change; gallery rides already-permissioned popup/background/tabs/storage seams [sentinel] (devops-engineer)

## Defects (populated as found)

- (none yet)
