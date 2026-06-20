---
type: feature-scope
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
frontend_lane: N/A
skip_ui_designer: true
status: locked
created_at: 2026-06-20T16:19:57Z
---

# Screenshot gallery — review, re-open / edit, delete

## Problem statement

Once a screenshot is captured into the current target's in-progress report, it is
effectively write-only from the popup: the user sees only a count, can't review
what they captured, can't fix a bad annotation, and can't remove a single
mistaken shot without `Clear`-ing the entire report. The wave-0 spine now makes
this fixable — `w0-per-target-reports` keys the report per browser-port and
`w0-editor-foundation` persists a lossless editor `model` on every
`screenshots[].model`, so a stored shot can round-trip back into the editor
exactly. This feature exposes that: the popup renders thumbnails of the **current
target's** report, clicking one re-opens it in the in-page editor on its stored
PNG (lossless re-edit), `Done` re-saves/replaces the record, and `Delete` removes
a single shot behind a confirmation step (updating the count and badge). It is the
popup-side review/edit/delete surface — a distinct region from the rectangle
tool's `editor.js` annotation-shape rewrite, keeping the two Wave-2 features
parallel-safe.

## In scope

- **Gallery render.** The popup renders thumbnails of the current target's
  per-port (`report:<browserPort>`) in-progress-report screenshots. A new
  background message returns the current target's `screenshots[]` (index +
  thumbnail source + light metadata); the popup lays them out as a thumbnail
  grid. Non-target / empty report → empty state (no thumbnails).
- **Re-open on the stored PNG.** Clicking a thumbnail re-opens that screenshot in
  the **existing in-page editor** via the **released** seam:
  `ANNOTATE { image: shot.original, model: shot.model }` → `openEditor(image,
  model)` (`editor.js:14-24`) → `deserializeModel` (opaque pass-through,
  `editor.js:165`) → guarded `render()`. The persisted `model`
  (`{version:1, items:[…]}`) is restored exactly (model-byte), and the shot's
  stored `console` / `network` buffers are preserved across the round-trip.
- **Overlay reuse, page-independent.** Re-edit reuses the existing in-page overlay
  at screenshot-native sizing; the **original page need not be live** because the
  stored PNG covers the surface. The overlay is hosted on the **current target
  tab** (where `editor.js` is registered on localhost). If no content-script host
  is available, fail gracefully with the existing "reload the page so the content
  script loads" style error (`background.js:280`) — never a silent failure.
- **Done re-saves / replaces.** On `✓ Done`, the editor re-emits
  `serializeModel(model)` (`editor.js:486,493`); the feature **replaces** that one
  screenshot record in `report:<port>` with the edited version — new `model`
  (model-byte lossless), re-rendered `annotated` + lossy `annotations`,
  **`original` unchanged** (same stored PNG), and `console`/`network`/`meta`
  preserved. Other screenshots in the report are untouched.
- **Delete behind a confirm.** `Delete` is a destructive per-thumbnail control
  gated behind a confirmation step; confirming removes that screenshot from the
  current target's report (`report:<port>` record). Cancelling the confirm changes
  nothing.
- **Count + badge update on delete.** Deleting decrements the report count and
  emits `REPORT_COUNT_CHANGED` (the `chrome.storage.session` tick established by
  `w0-per-target-reports` STORY-fe-003) so the dynamic icon badge
  (`w1-dynamic-icon-badge` consumer) reflects the new count.
- **GC home — fold cleanup into Delete.** This feature is the GC home for
  unbounded `report:<port>` growth (per-target LOW-2 forward-flag). Delete shrinks
  the record; when a Delete empties the report, **clear the `report:<port>`
  record** (`clearReport(port)`) rather than persisting an empty
  `{note, screenshots:[]}`, so the store does not accumulate empty/stale entries.
- **New zero-port-arg message API.** New `background.js` message handlers for
  fetch-report-screenshots, re-open-and-resave (by index/id), and delete (by
  index/id). Following the released pattern, callers pass an **index/id only** —
  the handler resolves the current target port internally via
  `currentTargetPort()`; an index-scoped mutation never touches another port's
  record (write-key ≡ read-key).

## Out of scope (explicit)

- **The rectangle tool / `editor.js` annotation-shape rewrite** — owned by
  `w2-rectangle-tool`. This feature **consumes** the editor via the `ANNOTATE`
  message only and does **not** modify `editor.js` draw/render/shape logic.
- **The editor `model` envelope, `deserializeModel`, the render-boundary guards
  (`RENDER_ITEM_CAP` / `RENDER_TEXT_CAP` / `isFiniteNum`), and text-box auto-fit**
  — all consumed **as released**. Must NOT be re-implemented, forked, or bypassed.
- **The per-port report-store keying and the `GET_STATE` payload shape** — owned
  by released `w0-per-target-reports`. Consumed read + index-scoped mutation via
  the new messages; the keying contract (`report:<port>`, `getReport/setReport/
  clearReport`, `portOfUrl`) is **unchanged**.
- **The upstream `/report/save` controller contract and the saved `report.json`
  projection** — unchanged; this feature only edits the **local** in-progress
  store.
- **Cross-port / cross-worktree report GC beyond Delete** — stale
  `report:<otherPort>` records left by abandoned worktrees are not user-driven and
  are **not** addressed here (flagged residual; expand only on BOSS direction).
- **Cross-font-environment pixel/line identity** of a re-rendered annotation — NOT
  guaranteed (only model-byte identity is; see Critical directives §3).
- **Capture / annotate behavior, the localhost guard, and the controller
  `/resolve` contract** — unchanged.

## Branch policy

Wave 2 of the `snapdeck-ux-improvements` epic. Lands on the epic mirror feature
branch `feature/snapdeck-ux-improvements` (PR #1 = Wave 0, PR #2 = Wave 1, PR #3 =
Wave 2). Commits are pre-approved (atomic pathspec while warm teammates stage in
parallel); **BOSS coordinates the push window and opens/merges the gate-2 PR** — no
self-push. Parallel-safe with `w2-rectangle-tool`: that feature is `editor.js`
shape-region only; this feature is popup (`popup/*`) + `background.js` message
handlers — expected-disjoint files (confirm any shared `background.js` touch at the
Phase-5 peer-message floor).

## Critical directives

1. **Reuse the released re-open seam verbatim — do not fork the editor.** Re-open
   goes through `ANNOTATE { image, model }` → `openEditor` → `deserializeModel`
   (opaque pass-through) → guarded `render()`, exactly as the
   `w0-editor-foundation` round-trip test exercises. Do NOT bypass or duplicate the
   render-boundary guards; re-open **inherits** `RENDER_ITEM_CAP=500` /
   `RENDER_TEXT_CAP=10000` plus the text-box clamp / clamped-inset short-circuit.
2. **Security — STRIDE re-confirm of bounded arbitrary-model re-open (Phase 7).**
   This feature is the consumer the editor-foundation fe-004 and text-box
   STORY-fe-002 / DEFECT-001 r2 forward-flags pointed to: it re-opens **arbitrary
   stored models** (arrow + box + text + rectangle, including crafted/corrupted or
   numerically-hostile geometry / oversized text). The security pass must
   re-confirm **end-to-end** that re-open is **bounded** — no throw, hang, or
   console error — via the inherited guards. The `model` arrives from the
   extension's **own IndexedDB** per-screenshot record (isolated-world, not
   page-writable, not network) → this is **defense-in-depth resilience**, not an
   externally-reachable DoS. Do not weaken the inherited caps.
3. **"Lossless round-trip" means MODEL-BYTE identity, not pixel identity.** The
   round-trip guarantee is `deepEquals(model.items)` (geometry + content bytes) plus
   preserved `console` / `network` / `meta` — **NOT** cross-font-environment
   pixel/line identity of the re-rendered annotation (the text box pins a
   `fontFamily` but cross-env canvas wrap can still differ; recorded in text-box
   STORY-fe-002 Finding 2). Scope every "lossless" / "exact" AC to **model bytes**,
   never to a screenshot/pixel diff of the re-render.
4. **GC home — Delete owns report cleanup.** Folding cleanup into Delete is in
   scope: splice the deleted record, and when a Delete empties the report, clear the
   `report:<port>` record. Bounds the store without a separate GC surface.
5. **Re-open host tab (resolve at decompose).** The overlay hosts on the current
   target tab — the gallery shows that target's report and `editor.js` is registered
   on localhost there. Architect to lock: tab resolution + a graceful no-host error
   path (mirror `background.js:280`). The original page being navigated-away is fine
   (the stored PNG covers it); a missing content script is the only failure to
   handle.
6. **Coordinate any shared `background.js` touch with `w2-rectangle-tool`** at the
   Phase-5 peer-message floor. Expected disjoint (they are `editor.js`-only), but
   confirm rather than assume.

## Mockup decision

`skip_ui_designer: true`. `frontend_lane: N/A` — Snapdeck is a vanilla MV3
extension; the popup is plain HTML/CSS (`extension/popup/popup.html` +
`popup.css`) with **no** project component-library or design-token layer
(consistent with all seven sibling features, every one `skip_ui_designer: true`;
all epic mockup dirs are empty placeholders). The gallery does introduce a new
thumbnail-grid layout and a delete-confirm affordance — genuinely new visual
elements — but there is no branded design system to mock against, so the
frontend-architect specs the grid + confirm interaction **inline against the
existing `popup.css` patterns** (an ASCII wireframe in the story suffices). No
full ui-designer round is warranted.

## Acceptance criteria (seeds for PO to expand)

- The popup renders thumbnails of the **current target's** per-port report
  screenshots (keyed by browser-port); a non-target / empty report shows an empty
  state with no thumbnails.
- Clicking a thumbnail re-opens that screenshot in the in-page editor on the stored
  `original` PNG, with the persisted `model` restored exactly (model-byte) and the
  stored `console` / `network` buffers preserved.
- Re-edit reuses the existing in-page overlay at screenshot-native sizing; the
  original page need not be live; the overlay hosts on the current target tab; a
  missing content-script host fails gracefully (no silent failure).
- `✓ Done` re-saves and **replaces** the existing screenshot record with the edited
  version — `model` model-byte-identical to what was emitted, `annotated` /
  `annotations` re-rendered, `original` unchanged, `console` / `network` / `meta`
  preserved; other screenshots untouched.
- `Delete` is a destructive control gated behind a confirmation step; confirming
  removes exactly that screenshot from the current target's report, and cancelling
  changes nothing.
- Deleting updates the report count and emits `REPORT_COUNT_CHANGED` so the
  badge/icon count updates; a Delete that empties the report clears the
  `report:<port>` record.
- Re-opening a screenshot whose stored `model` is hostile / oversized / corrupted
  renders **bounded** — no throw, hang, or console error — via the inherited render
  guards (security).
- Fetch / re-open / delete resolve the current target port **internally** (callers
  pass an index/id, never a port); an index-scoped mutation never touches another
  port's record.

## E2E coverage hints (PO will write the actual specs)

- Gallery renders N thumbnails for a target whose report has N screenshots; a
  non-target tab (no resolvable localhost port) renders the empty state.
- Click a thumbnail → editor opens on the stored PNG with annotations restored
  (`done2.model.items deepEquals` stored `model.items`); `✓ Done` → the record is
  replaced, `model` is model-byte-identical, `console` / `network` preserved.
- Delete with confirm → the screenshot is removed, the count decrements, and
  `REPORT_COUNT_CHANGED` fires (badge updates); cancelling the confirm leaves the
  report unchanged.
- A Delete that removes the last screenshot clears the `report:<port>` record (no
  empty record left behind).
- Re-open of a crafted hostile/oversized stored model renders without throw / hang
  / console error (browser-tester E2E lane — Konva-render-dependent, not
  `node --test`).
- Two-port isolation: re-saving or deleting in target A's gallery never alters
  target B's `report:<port>` record.
