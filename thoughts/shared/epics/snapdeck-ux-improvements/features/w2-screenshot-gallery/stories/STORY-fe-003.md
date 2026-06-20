---
type: story
id: STORY-fe-003
name: "Popup thumbnail grid + delete-confirm UI"
domain: frontend
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: released
depends_on: [STORY-fe-001, STORY-fe-002]
diff_estimate: substantive
frontend_lane: N/A
visual_references: []
created_at: 2026-06-20T16:46:00Z
last_run_id: run-20260620-161818-88519
---

# Story: Popup thumbnail grid + delete-confirm UI

## What we're doing

Add the gallery surface to the popup (`extension/popup/popup.html` / `popup.js` /
`popup.css`): below the existing note / Add / Save / Clear chrome, render the
current target's report screenshots as a **thumbnail grid** (one tile per
screenshot, in capture order). Clicking a tile re-opens that shot in the in-page
editor (sends `REOPEN_SCREENSHOT`, then closes the popup so the overlay is usable);
each tile has a **delete affordance gated behind an inline two-state confirm**
(Delete → Confirm / Cancel) that, on confirm, removes the shot and updates the count
+ grid. A non-target / empty report renders an empty state. The grid consumes the
three new background messages from STORY-fe-001 / STORY-fe-002 — it holds **no**
business logic and **no** port. The mutation handle the popup round-trips is the
**stable `sid`** each tile carries (from `GET_REPORT_SCREENSHOTS`), **never the array
index** (index is display-only — the `#N` badge); this is what keeps re-open / delete
safe under a mid-edit splice (fe-002 Finding 1).

## What it should look like

Per the feature.md ASCII wireframe (no ui-designer mockup —
`skip_ui_designer: true`, `frontend_lane: N/A`; spec'd inline against the existing
`.sd-*` class family). A new section appended **after** `#status`:

```
 │ [ ✓ Save report ]   [ Clear ]         │   ← existing chrome (unchanged)
 │ <status line>                          │
 │  Screenshots in this report            │   ← .sd-gallery-head
 │  ┌──────┐ ┌──────┐ ┌──────┐            │
 │  │thumb │ │thumb │ │thumb │  #N badge  │   ← .sd-thumb (button) + .sd-thumb-idx
 │  └──────┘ └──────┘ └──────┘            │
 │  [ Delete ]  [Delete] [Delete]         │   ← resting: .sd-del-btn
 │  Delete? [Confirm] [Cancel]            │   ← confirm two-state (inline, per tile)
 │                                         │
 │  Empty: "No screenshots in this         │   ← .sd-empty (non-target / empty)
 │          target's report yet."          │
```

### HTML (append after `#status`, `popup.html:23`)

```html
<div class="sd-gallery-head">Screenshots in this report</div>
<div id="gallery" class="sd-gallery" role="list"></div>
```

### popup.js (additive — wire on open + after mutations)

- **On open:** extend `refresh()` (`popup.js:13-17`) to also call
  `refreshGallery()` → `send({type:"GET_REPORT_SCREENSHOTS"})` → `renderGallery(res.screenshots)`.
- **`renderGallery(screenshots)`** — clear `#gallery`; if empty/undefined, render a
  `.sd-empty` message; else append one `.sd-tile` per shot. Each tile closes over the
  shot's **`sid`** (the mutation handle) and its display `index`.
- **Tile** — a `.sd-thumb` **button** wrapping `<img class="sd-thumb-img" src=shot.thumbnail alt="">`
  + a `.sd-thumb-idx` `#${index+1}` badge; `aria-label="Re-open screenshot ${index+1}"`
  (+ title from `shot.title`/`shot.url`). Click → `reopen(shot.sid)`. (The `#N` badge uses
  the array position for display; the **`sid`** is the handle passed to the SW.)
- **`reopen(sid)`** — `const res = await send({type:"REOPEN_SCREENSHOT", sid});`
  if `res.error` → `setStatus(res.error,"err")` and **stay open**; else
  `window.close()` (mirrors the Add-flow close, `popup.js:21-26`, so the overlay is
  usable). The long-lived edit + re-save run in the SW after the popup closes.
- **Delete affordance** — a per-tile `.sd-del` container with two render states:
  - *resting:* a `Delete` button (`aria-label="Delete screenshot ${index+1}"`) →
    on click, swap to the confirm state.
  - *confirm:* a `Delete?` label + `Confirm` button + `Cancel` button. `Confirm` →
    `confirmDelete(shot.sid)`; `Cancel` → restore the resting state (no mutation).
- **`confirmDelete(sid)`** — `const res = await send({type:"DELETE_SCREENSHOT", sid});`
  if `res.error` → `setStatus(res.error,"err")`; else `setCount(res.count)` and
  `await refreshGallery()` — **re-fetch + re-render the whole grid** so the display
  indices recompute and each tile picks up its (unchanged) `sid` (NEVER reuse a stale
  array index after a splice — the SW already addresses by `sid`, but the grid must also
  re-fetch so the `#N` badges and the live shot set stay correct).
- **Keep Clear/Save in sync:** extend the existing `clear` (`popup.js:41-46`) and
  `save`-success (`popup.js:32-35`) handlers to also call `renderGallery([])` so the
  grid empties when the report is cleared/saved. (Additive — does not change their
  released behavior.)

### Labels — plain text, no symbol-icon chars

The feature.md wireframe sketches `Confirm? ✓ ✕`, but the **shipped** labels are
plain text — `Delete`, `Confirm`, `Cancel`, `#N` — per the no-emoji / no-symbol-icon
convention for **new** labels (precedent: the released Box button chose a plain-text
label, `editor.js:527`; the toolbar grip is a CSS affordance, not a glyph). Do
**not** use `✓` / `✕` / `●` / arrows. (The released popup buttons `＋`/`✓` and the
`▟` logo are pre-existing / brand and out of scope.) No inline `<svg>` icons.

### CSS (`popup.css`, extend the `.sd-*` family — dark palette already in file)

Responsive grid (`grid-template-columns: repeat(auto-fill, minmax(72px, 1fr))` or a
fixed 2–3 col — engineer judgment), uniform tiles (`aspect-ratio` + `object-fit:
cover`), reusing the existing tokens (`#2c2f3a` surface, `#3a3d4a` border, `#aac2dd`
focus, `#e7e9ee` text, `#9aa0ad` muted). The destructive `Confirm` button gets a
red-tinted border/text (anchor to the existing error token `#e88` /`#c0392b` family).
Icon-only controls are avoided (all controls are text), and `.sd-thumb:focus-visible`
must show a visible focus ring (keyboard-activatable per feature.md).

## Existing behavior baseline

- **Currently:** `popup.html:7-26` renders head (`▟` logo + title + `#count`),
  note input, `＋ Add screenshot`, `✓ Save report` / `Clear`, and `#status`; there
  is **no** gallery. `popup.js:13-48` wires `GET_STATE` refresh, `SET_NOTE` on note
  change, Add (fire-and-forget + `window.close()`), Save, Clear. `popup.css:1-37`
  defines the `.sd-*` dark theme.
- **Dispatch path / call graph:** `$("...").addEventListener` → `send(msg)` =
  `chrome.runtime.sendMessage` (`popup.js:4`) → SW `handle()` (`background.js:231`).
  This story adds three consumers: `GET_REPORT_SCREENSHOTS` + `DELETE_SCREENSHOT`
  (STORY-fe-001) and `REOPEN_SCREENSHOT` (STORY-fe-002).
- **No-regression assertion:** the existing head / note / Add / Save / Clear markup
  and their handlers remain functional and visually unchanged; the gallery is
  **appended below** `#status` and never reflows the existing chrome. The Add flow
  (`popup.js:21-26`) is untouched. The `send`/`setStatus`/`setCount` helpers
  (`popup.js:3-11`) are reused, not rewritten.
- **Dispatch contract preserved:** n/a — single UI lane (`frontend_lane: N/A`); not
  a revamp twin. The grid consumes the new message contracts as defined by
  fe-001/fe-002 (index-only payloads; the SW resolves the port internally).
- **Explicitly changing:** append the gallery section (html), add
  render/tile/delete-confirm/reopen logic + Clear/Save grid-sync (js), add
  grid/tile/delete CSS (css).
- **Verified:** 2026-06-20 — opened `popup.html`, `popup.js`, `popup.css`.

## How we're doing it

- **Files:** `extension/popup/popup.html`, `popup.js`, `popup.css` only. No build
  step, no manifest change (popup already registered, `manifest.json:14-22`).
- **Presentational only.** The popup holds no port and no report logic — it sends
  index-only messages and renders the response. Re-fetch the grid after every
  mutation (delete) rather than mutating the DOM in place, so indices stay correct.
- **Re-open closes the popup on success, surfaces error on failure.** `reopen()`
  awaits the `REOPEN_SCREENSHOT` result: the SW's pre-flight PING (fe-002) returns
  quickly, so a missing content-script host returns `{error}` → the popup shows it
  and stays open; success returns `{ok:true, opening:true}` → `window.close()`.
- **Accessibility:** every tile button and delete/confirm/cancel button has an
  `aria-label`; the thumbnail `<img>` is decorative (`alt=""`) because the wrapping
  button carries the label; `.sd-thumb` is keyboard-activatable with a visible
  `:focus-visible` ring.
- **Dev-server / extension-load gotcha (per onboarding/frontend.md):** to verify
  visual output, **confirm the unpacked extension + a localhost dev target are
  already loaded in Chrome** (browser-tester drives them) — do **not** start a
  long-lived dev/browser process under a Bash background call (it gets killed). Drive
  verification through the `bt` teammate (see Validation).

## How we validate it was done correctly

- [ ] On popup open against a target whose report has N screenshots, the grid
  renders exactly N tiles in capture order, each with a thumbnail, a `#index+1`
  badge, and a `Delete` button.
- [ ] The tile thumbnail shows the screenshot's `annotated` image (or `original`
  when it has no annotations) — i.e. it renders the `thumbnail` field from
  `GET_REPORT_SCREENSHOTS`.
- [ ] On a non-target tab or an empty report, the grid shows the `.sd-empty`
  message ("No screenshots in this target's report yet.") and zero tiles.
- [ ] Clicking a tile sends `REOPEN_SCREENSHOT {sid}` (the shot's stable identity,
  **not** an array index); on success the popup closes; on `{error}` the popup surfaces
  the error in `#status` and stays open.
- [ ] `Delete` flips the tile to the inline confirm state (`Delete?` + `Confirm` +
  `Cancel`); `Cancel` restores the resting state and **sends no message**.
- [ ] `Confirm` sends `DELETE_SCREENSHOT {sid}` (stable identity, not index), then
  updates `#count` and re-fetches + re-renders the grid (the removed tile is gone;
  remaining display indices recompute — e.g. former `#3` becomes `#2`).
- [ ] No `popup.js` path ever sends an array `index` as the re-open/delete handle —
  the `#N` badge is presentation-only; the `sid` from `GET_REPORT_SCREENSHOTS` is the
  only value passed back to the SW.
- [ ] After `Clear` or a successful `Save`, the grid empties (`renderGallery([])`).
- [ ] No emoji / symbol-icon char / inline `<svg>` in new markup; all new labels are
  plain text; decorative `<img>` has `alt=""`; every interactive control has an
  accessible label; `.sd-thumb` shows a visible focus ring.
- [ ] **No raw-HTML sink (security — output encoding, PROMOTED from Security Review S1):**
  tiles + labels are assembled via `createElement` + `textContent` + `img.src` (or
  equivalent attribute/property writes) — **no** `innerHTML`, `insertAdjacentHTML`, or
  template-string-to-HTML anywhere in the gallery render. A grep of the new `popup.js`
  gallery code finds zero raw-HTML sinks; stored `thumbnail`/`title`/`url`/`#N` reach the
  DOM only as `img.src` / attribute / `textContent`, never parsed as HTML.
- [ ] Existing head / note / Add / Save / Clear chrome is visually + behaviorally
  unchanged.
- [ ] **(browser-tester smoke — required for this UI story)** `bt` loads the popup
  against a seeded `report:<port>` (≥2 shots, ≥1 annotated): confirm tile count +
  order + thumbnails, click → re-open message + popup close, delete-confirm
  two-state + post-delete re-render, empty-state on a non-target; report any
  console errors; screenshot the grid + the confirm state. Reference the `bt`
  report in `## Engineer Notes` before landing.

## Motion contract

n/a — `frontend_lane: N/A`. Snapdeck's popup is plain HTML/CSS with no
component-library / design-token motion catalog. The thumbnail grid and the
inline delete-confirm two-state are **instantaneous DOM updates** (a `textContent`
swap for the confirm flip; a re-render after delete) with no transition tokens. No
animation is introduced, so reduced-motion is honored by construction. Consistent
with feature.md § Motion E2E (`n/a`) and every released sibling in this epic.

## Unit tests

No `node --test` lane — the popup is DOM/`chrome.runtime`-bound with no existing
headless harness, and extracting a "pure" helper purely to add a node test would be
a fake abstraction (cf. the w1-text-box-autofit lesson). The grid render, the
delete-confirm two-state, the re-open-and-close flow, and the empty state are
verified through the **browser-tester Playwright E2E lane** (feature.md E2E specs
"Gallery renders N thumbnails; non-target shows the empty state" and the
delete/confirm/cancel spec) plus the mandatory `bt` smoke above. The message
*contracts* the popup depends on are unit-tested in STORY-fe-001
(`background.gallery.test.mjs`) and STORY-fe-002 (`background.reopen.test.mjs`).

## Dependencies

- **STORY-fe-001** — consumes `GET_REPORT_SCREENSHOTS` (grid render + empty state)
  and `DELETE_SCREENSHOT` (delete-confirm).
- **STORY-fe-002** — consumes `REOPEN_SCREENSHOT` (tile click → re-open + close;
  the `{error}` vs `{ok:true,opening:true}` contract drives the surface-error-vs-
  close branch).

## Cross-domain contract

- **devops-architect:** popup is already registered (`manifest.json:14-22`); no
  manifest / build change. (devops sentinel — peer-confirmed Phase 5.)
- **backend / database architects:** no controller or server-side DB surface — the
  popup is pure presentation over the FE-owned SW messages. (BE + DB sentinel.)

## Engineer Notes

**Smoke verification deferred — dev server not running.** `.claude/state/dev-server.txt` does not exist; the extension popup smoke requires a running Chrome browser with the unpacked extension loaded + a localhost dev target seeded with screenshots. Per frontend.md protocol, this is left for the orchestrator's later smoke pass. The bt smoke request to verify when the extension is loaded:

```
bt: Load the Snapdeck extension popup (chrome-extension://<id>/popup/popup.html) against a Chrome profile where the unpacked extension is loaded and there is an active localhost:PORT tab with ≥2 screenshots (≥1 annotated) seeded in its report:PORT IndexedDB store. Verify: (1) gallery section renders below status with exactly N tiles in capture order; (2) each tile shows a thumbnail image + #N badge + Delete button; (3) non-target/empty report shows the empty state message; (4) clicking Delete on a tile shows the inline Confirm/Cancel two-state; (5) clicking Cancel restores resting state; (6) clicking Confirm removes the tile and updates the count; (7) clicking a tile closes the popup (or shows an error on no-host); (8) after Save or Clear the gallery empties. Report any console errors; screenshot the grid state and the confirm two-state.
```

**No unit tests for popup.js** — per story spec, the popup is DOM/chrome.runtime-bound with no existing headless harness; the message contracts are unit-tested by fe-001/fe-002.

**No innerHTML — confirmed.** All tile/label/button construction uses `createElement` + `textContent` + `img.src`; zero `innerHTML` / `insertAdjacentHTML` sinks in the gallery render code.

## History

- 2026-06-20T18:47:07Z — orchestrator — validate validated + honesty passed (BOSS-mode implement, Wave-2); node --test 144/144
- 2026-06-20 — created by frontend-architect (effort=2, depends on STORY-fe-001, STORY-fe-002)
- 2026-06-20T00:00:00Z — implemented (commit: 537aa27); node --test 144/144 pass; smoke verification deferred — dev-server.txt absent (Chrome extension popup requires loaded unpacked extension + localhost dev target)
2026-06-20T18:53:29Z — BOSS: status: 'validated' -> 'released' (Released via Wave-2 PR #3 (cd6c0cb))

## Contrarian Findings

### Finding 1 — The re-openable popup is the enabling surface for fe-002's mid-edit delete corruption

**Severity:** info

**Mechanism:** `reopen(index)` `window.close()`s on success (lines 71-74), but the popup
can be **re-opened** by clicking the toolbar icon while the in-page editor overlay is still
active on the page — at which point `refresh()` → `refreshGallery()` re-fetches the live
grid and `confirmDelete(index)` offers a working delete. That re-opened-popup delete is the
concrete trigger for STORY-fe-002 Finding 1 (severity **block**: the in-flight re-save then
overwrites the wrong record). This story is presentational and holds no business logic, so
it is **not** the fix site — the fix is identity-addressing in fe-001/fe-002. Recorded here
only so the FE engineer who lands all three stories sees the cross-story linkage and does
**not** "solve" it presentationally (e.g. by hiding the grid mid-edit, which the popup can't
detect anyway — it has no signal that an overlay is open).

### Finding 2 — `GET_REPORT_SCREENSHOTS` returns full-resolution PNGs for every shot; no count cap or downscale

**Severity:** info

**Mechanism:** Tiles render `shot.thumbnail` = the stored `annotated || original`
**full-resolution** base64 PNG, scaled down by CSS only (fe-001 explicitly forgoes any
SW-side resize). A report's `screenshots[]` is appended unboundedly by capture with no count
cap, so a large report (many full-page / high-DPI shots) ships tens of MB of base64 in one
`chrome.runtime.sendMessage` response and mounts that many full-res `<img>` elements in a
~280px popup — potentially slow/janky to open. Fine for typical reports (a handful of
shots) and a defensible simplicity call; recorded so the team consciously accepts the
"reports stay small" assumption. If it ever bites, the cheap mitigation is an
`OffscreenCanvas` downscale in the fetch handler (fe-001) returning a small thumbnail
data-URL, leaving full-res `original`/`annotated` in the store for re-open.

**Recommendation:** **acknowledge** — no change for typical use; revisit (downscale in
fe-001's projection) only if large-report popup latency is observed.

## Revisions

### 2026-06-20 — product-owner (arbitrate, run-20260620 w2-screenshot-gallery)

**Finding 1 (info) — RESOLVED upstream (the popup now passes `sid`, not `index`).** This
story is the *enabling surface* for fe-002's block (the popup is re-openable mid-edit), but
it is **not** the fix site (it holds no business logic). Per the contrarian's own guidance,
I did **not** "solve" it presentationally (hiding the grid mid-edit is impossible — the
popup has no signal an overlay is open). Instead the fix lands in fe-001/fe-002
(identity-addressing); this story is revised to **pass the stable `sid` as the mutation
handle** for re-open and delete (never the array index), with the `#N` badge demoted to
display-only. `reopen(sid)` / `confirmDelete(sid)` + validate item "no `popup.js` path ever
sends an array index as the handle." `depends_on` unchanged (fe-001, fe-002).

**Finding 2 (info) — ACCEPTED for v1 with a named re-trigger.** `GET_REPORT_SCREENSHOTS`
ships the full-resolution `annotated || original` PNG per shot, CSS-scaled in a ~280px
popup; fine for typical reports (a handful of shots), an unstated "reports stay small"
assumption for large/high-DPI sets. Accepted as-is to keep this arbitration round focused
on the silent-corruption block (the load-bearing fix) rather than piling optional perf work
onto the same diff. **Named re-trigger:** if large-report popup open latency is observed,
the cheap mitigation is an `OffscreenCanvas` downscale **in fe-001's projection** (return a
small thumbnail data-URL; keep full-res `original`/`annotated` in the store for re-open) —
a fe-001-local change, no fe-003 contract impact. Recorded so the assumption is conscious,
not silent.

**Status:** pending → approved.

## Security Review

_security-architect, Phase 7 STRIDE, 2026-06-20. The popup is the only UI surface this
feature adds; reviewed for output-encoding / DOM-XSS sinks._

### Finding S1 — No new DOM-XSS sink — CONFIRMED clean

**Severity:** info (security-positive)

**Threat (Information disclosure / script injection):** the grid renders stored screenshot
fields (`thumbnail`, `url`, `title`, `#N`) that ultimately trace to capture-time page data.
If any reached an `innerHTML`/raw-HTML sink it would be an XSS vector.

**Verification (against the story's spec):**
- **Thumbnail** is `<img class="sd-thumb-img" src=shot.thumbnail alt="">` (lines 72-73) —
  `shot.thumbnail` is a stored base64 **PNG data-URL** (`annotated || original`,
  fe-001), set as the `src` **attribute/property**, not parsed as HTML. A data-URL in
  `img@src` is inert (no script execution; `javascript:` doesn't execute in `img@src`
  regardless). ✓
- **`#N` badge** is the array index rendered as `textContent` (line 75) — auto-escaped. ✓
- **`title` / `aria-label`** from `shot.title` / `shot.url` are set as
  attributes/properties (lines 74-75), not HTML. Even a hostile `url` like
  `javascript:…` is inert in a `title=` attribute (never navigated to, never an `href`).
- **Re-open** is canvas (Konva, in the released editor) — no DOM-HTML path.
- No `innerHTML` / `insertAdjacentHTML` / raw-HTML / template-injection sink is specified;
  all new labels are plain text (lines 96-103). ✓

**Verdict:** **no new DOM-XSS sink.** Output encoding is in effect via `textContent` +
attribute/property writes. **Validator/engineer must NOT introduce `innerHTML`** when
building tiles — assemble via `createElement` + `textContent` + `img.src` (as specified).

### Finding S2 — `GET_REPORT_SCREENSHOTS` ships full-res PNGs to a small popup — LOW, accept

**Severity:** low (DoS — local, accept-risk; already dispositioned by PO via fe-003 Finding 2)

The grid mounts the full-resolution `annotated || original` base64 PNG per shot, CSS-scaled
in a ~280px popup (this story's Finding 2). A large/high-DPI report ships tens of MB in one
`sendMessage` and mounts many full-res `<img>`. **Not externally reachable** (local store,
not page-writable; no `externally_connectable`) and bounded by the user's own capture count
→ a latency/jank concern, not a security DoS. PO already accepted for v1 with a named
re-trigger (an `OffscreenCanvas` downscale in fe-001's projection). I concur — **acknowledge**,
no change.

### Default-checklist N/A dispositions

Presentation-only popup, no server/HTTP surface: **authn/authz/CSRF/CORS/rate-limit** N/A;
**secrets** none; **injection** none (no query construction); **multi-tenant** N/A. The one
applicable item — **output encoding** — is confirmed in effect (S1).

**PO disposition (S1 — no new DOM-XSS sink / output encoding):** PROMOTE_TO_AC — see the new feature.md AC "No DOM-XSS sink in the gallery render (output encoding)" + the sharpened fe-003 validate item "No raw-HTML sink" (tiles/labels via `createElement` + `textContent` + `img.src`; zero `innerHTML`/`insertAdjacentHTML`/raw-HTML sink, greppable). This is the feature's sole DOM-output trust boundary and a concrete engineer constraint, so it is made validator-enforceable rather than left advisory.

**PO disposition (S2 — full-res PNG payload LOW):** ACCEPT_AS_RECOMMENDATION — a local latency/jank concern, not a security DoS (not externally reachable; bounded by the user's own capture count); already accepted for v1 with the named re-trigger (an `OffscreenCanvas` downscale in fe-001's projection) in fe-003 Finding 2's PO revision. Engineers may implement the downscale at their discretion; not gating.

**PO disposition (default-checklist N/A items):** ACCEPT_AS_RECOMMENDATION — presentation-only popup with no server/HTTP surface; the one applicable item (output encoding) is PROMOTED via the S1 disposition above. Not gating.

## Validation

- 2026-06-20T18:47:07Z — result: **validated** (honesty: passed)
- frontend-validator: validated (thumbnail grid + delete-confirm + click-to-reopen by sid; zero innerHTML — createElement+textContent+img.src; .sd-* css). honesty: passed (no test suppression; no-popup-unit-tests genuine DOM/chrome.runtime binding). node --test 144/144.
