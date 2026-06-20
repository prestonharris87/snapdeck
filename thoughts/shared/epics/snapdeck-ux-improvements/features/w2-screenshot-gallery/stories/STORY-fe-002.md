---
type: story
id: STORY-fe-002
name: "Re-open + preserve-from-record re-save handler"
domain: frontend
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: pending
depends_on: [STORY-fe-001]
diff_estimate: substantive
frontend_lane: N/A
visual_references: []
created_at: 2026-06-20T16:38:00Z
last_run_id: run-20260620-161818-88519
---

# Story: Re-open + preserve-from-record re-save handler

## What we're doing

Add the **`REOPEN_SCREENSHOT`** zero-port-arg message handler to
`extension/background.js`. It re-opens a stored screenshot (by index) in the
**released** in-page editor on its stored `original` PNG via the
`ANNOTATE { image, model }` seam, and on `✓ Done` **replaces** that one record in
`report:<port>` — taking ONLY `model` / `annotated` / `annotations` from the editor
response while **preserving** `original` / `console` / `network` / meta from the
**pre-edit stored record**. This story owns the **re-save preserve-from-record
contract** (the corruption-risk lock), the graceful no-host / busy paths, and the
bounded arbitrary-model re-open (security — guards inherited, never re-implemented).

## What it should look like

A new `case` in the existing `handle()` switch dispatching to two new helpers; the
re-open uses the **released** editor seams verbatim. The host tab is the **current
target tab** (= the active tab — the gallery shows that target's report and
`editor.js` is registered on localhost there; Critical directive §5 resolved).

### `REOPEN_SCREENSHOT` — pre-flight host check (so the popup can surface no-host)

```js
case "REOPEN_SCREENSHOT":
  return reopenScreenshot(msg.index);

async function reopenScreenshot(index) {
  const port = await currentTargetPort();
  if (port == null) return { error: "no current Snapdeck target tab" };
  const r = await getReport(port);
  const shot = r.screenshots[index];
  if (!Number.isInteger(index) || index < 0 || !shot) return { error: "no such screenshot" };
  const tab = await activeTab();
  // Pre-flight PING so a MISSING content-script host surfaces in the popup (the popup
  // awaits THIS quick result and stays open on error). editor.js answers PING
  // synchronously and BEFORE its active/busy check (editor.js:13) → PING only proves
  // "host present", not "host free".
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PING" });
  } catch (e) {
    return { error: "could not open the annotation overlay (reload the page so the content script loads): " + e.message };
  }
  // Host present → fire the LONG-LIVED ANNOTATE round-trip and re-save on resolve.
  // The SW survives the popup closing, so the .then() re-save runs after window.close().
  chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE", image: shot.original, model: shot.model })
    .then((resp) => resaveScreenshot(port, index, resp))
    .catch(() => { /* tab navigated/closed mid-edit → record left unchanged (no partial write) */ });
  return { ok: true, opening: true };
}
```

### `resaveScreenshot` — the preserve-from-record contract (corruption lock)

```js
async function resaveScreenshot(port, index, resp) {
  if (!resp || resp.cancelled) return;          // Cancel OR busy ({cancelled:true,busy:true}) → stored record UNCHANGED
  const r2 = await getReport(port);             // re-read fresh (robust to SW wake); index stable (see note)
  const target = r2.screenshots[index];
  if (!target) return;                          // defensive — shot vanished mid-edit (shouldn't happen)

  // Take ONLY from the editor response:
  target.model       = resp.model ?? null;      // model-byte lossless envelope {version:1, items:[…]}
  target.annotated   = resp.annotated;          // re-rendered PNG; editor returns null when items.length===0
  target.annotations = resp.annotations || [];  // re-projected lossy annotations

  // PRESERVE from the pre-edit record (NEVER read from resp):
  //   target.original, target.console, target.network,
  //   target.url, target.title, target.captured_at, target.viewport
  // (left untouched by construction — we only overwrite the three fields above)

  await setReport(port, r2);
  // NO emitReportCountChanged — a re-save does NOT change the count (AC).
}
```

### Why the preserve contract is load-bearing (do NOT mirror `addScreenshot`)

On `✓ Done` the editor's resolve payload (`editor.js:489-501`) emits **FRESH**
`meta` (`location.href` / `document.title` / `new Date()`) and the **LIVE**
re-edit-host-tab `console` / `network` from `window.__snapdeckBuffers` —
**not** the originally-captured values. So a naive `addScreenshot`-style record
rebuild (which copies `resp.meta` / `resp.console` / `resp.network` / `resp.original`
wholesale, `background.js:284-295`) would **overwrite** the stored record's
capture-time `original` PNG, `console`, `network`, and `meta` with the re-edit
tab's live/fresh data — **corrupting the record on every re-edit**. The fix is the
in-place mutation above: re-read the stored record and overwrite **only**
`model` / `annotated` / `annotations`, leaving the preserved fields untouched **by
construction**. `original` is preserved from the record (NOT taken from
`resp.original`, even though the editor echoes back the same PNG we passed in).

Index-stability note: while the overlay is open the popup is closed (no concurrent
delete) and a concurrent keyboard capture is blocked by the editor's `active` guard
(`editor.js:15` → `{cancelled:true,busy:true}`, no push). So the `index` captured at
re-open dispatch is stable through the `await`; the fresh re-read is robustness, not
correctness-critical.

## Existing behavior baseline

- **Currently:** `background.js:231-258` `handle()` has no re-open/re-save message;
  the only path that writes a screenshot record is `addScreenshot()`
  (`:261-299`), which **builds a fresh record** from the editor response —
  appropriate for a NEW capture, **wrong** for a re-save (it would clobber the
  preserved fields).
- **Dispatch path / call graph:** popup click → `REOPEN_SCREENSHOT {index}` →
  `reopenScreenshot` → `currentTargetPort()` (`:78-83`) + `getReport(port)`
  (`:40-43`) + `activeTab()` (`:67-70`) → `chrome.tabs.sendMessage(tab.id, {PING})`
  then `{ANNOTATE, image, model}` → content-script `editor.js` onMessage
  (`editor.js:12-19`): PING → `{ok:true}` (`:13`); ANNOTATE → busy guard (`:15`)
  else `openEditor(image, model)` (`:24`) → `deserializeModel` opaque
  (`editor.js:165` → `editor-model.js:72`) → guarded `render()` (`:176-189`,
  caps at `:192-193`) → on Done `serializeModel` (`:486`) +
  `projectAnnotations` (`:485`) + FRESH meta / LIVE buffers (`:489-501`) →
  `resaveScreenshot` → `setReport(port, r2)` (`:44-47`).
- **No-regression assertion:** `addScreenshot()` (`:261-299`), `saveReport()`
  (`:301-333`), `clearReport`/`setReport`/`getReport` (`:40-48`),
  `currentTargetPort`/`activeTab` (`:67-83`), and **`editor.js` / `editor-model.js`
  in their entirety** are **byte-unchanged** — re-open consumes them as released.
  The render-boundary guards (`RENDER_ITEM_CAP=500`, `RENDER_TEXT_CAP=10000`,
  `isFiniteNum`, the text-box clamp/short-circuit) are **inherited, never bypassed,
  forked, or re-implemented**. No new top-level listener; no `manifest.json` change.
  The released vm suites stay green.
- **Explicitly changing:** one additive `handle()` case + two additive helpers
  (`reopenScreenshot`, `resaveScreenshot`).
- **Verified:** 2026-06-20 — opened `background.js` (full), `editor.js` (full),
  `editor-model.js`, `background.emit.test.mjs`.

## How we're doing it

- **File:** `extension/background.js` only (+ a new test file). Additive `case` +
  two top-level helper fns; **no** new top-level listener (frozen-suite safety).
- **Reuse the released seam verbatim.** ANNOTATE payload is exactly
  `{ type:"ANNOTATE", image: shot.original, model: shot.model }`; do **not**
  pre-process, sanitize, or re-shape `shot.model` (it passes through
  `deserializeModel` opaquely and is bounded by the inherited render guards —
  security §2). Mirror the no-host error string from `addScreenshot`
  (`background.js:280`).
- **Pre-flight PING for popup-surfaced no-host.** The popup (fe-003) awaits the
  `REOPEN_SCREENSHOT` result: `{error}` → popup surfaces it and stays open;
  `{ok:true, opening:true}` → popup `window.close()`s so the overlay is usable.
  The long-lived ANNOTATE round-trip + re-save run in the SW after the popup closes.
- **Busy is an accepted silent no-op.** If an overlay is already open, ANNOTATE
  resolves `{cancelled:true, busy:true}` → `resaveScreenshot` returns early (no
  double-mount, no re-save). The popup has already closed; per feature.md this
  no-op is the accepted contract.
- **Security (bounded arbitrary-model re-open).** Re-opening a hostile / oversized
  / corrupted stored `model` (arrow + box + text + rectangle, numerically-hostile
  geometry, oversized text, item count > cap) renders **bounded** via the inherited
  guards — the handler adds **no** new validation and **weakens no cap**. The
  `model` originates from the extension's own IndexedDB (isolated-world, not
  page-writable) → defense-in-depth, not an externally-reachable DoS. (security-
  architect re-confirms end-to-end in Phase 7; Konva-render proof is the
  browser-tester E2E lane below.)
- **No manifest change** — ANNOTATE/PING messaging + `tabs.sendMessage` already
  work (`addScreenshot` uses the same seam); editor content scripts already
  registered (`manifest.json:32-45`).

## How we validate it was done correctly

- [ ] Re-open sends `{ type:"ANNOTATE", image: shot.original, model: shot.model }`
  to the active tab — `shot.model` passed through **verbatim** (no SW-side
  sanitization/mutation).
- [ ] No content-script host (PING rejects) → returns the graceful
  "could not open the annotation overlay (reload the page so the content script
  loads): …" error (mirrors `background.js:280`); the stored record is unchanged.
- [ ] On `✓ Done`, the record at `index` is **replaced**: `model` model-byte
  identical to `resp.model`, `annotated` + `annotations` re-rendered from `resp`,
  while `original` / `console` / `network` / `url` / `title` / `captured_at` /
  `viewport` are **preserved from the pre-edit record** (NOT the editor's
  fresh/live values). **No** other screenshot is touched.
- [ ] `Cancel` (`{cancelled:true}`) and busy (`{cancelled:true,busy:true}`) leave
  the stored record **byte-unchanged**; no double-mount on busy.
- [ ] A re-save emits **no** `REPORT_COUNT_CHANGED` tick (count unchanged).
- [ ] Two-port isolation: a re-save with target A active never alters
  `report:<B>` (port resolved internally; `msg` carries no port).
- [ ] **(browser-tester E2E — Konva lane)** Click a thumbnail → editor opens on the
  stored `original` PNG, deserialized `model.items` `deepEquals` the stored
  `shot.model.items` (model-byte restore); `✓ Done` → record replaced as above;
  no uncaught error / `console.error`.
- [ ] **(browser-tester E2E — Konva lane, security)** Re-open of a crafted
  hostile/oversized stored `model` renders **bounded** — no throw, no hang, no
  `console.error` — via the inherited caps (caps not weakened, guards not bypassed).
- [ ] Released `addScreenshot`/`saveReport`/`editor.js`/`editor-model.js` unchanged;
  no new top-level listener; no `manifest.json` change.

## Motion contract

n/a — `frontend_lane: N/A`. This story is service-worker message handling; the only
motion in the re-opened surface is the released in-page editor's default
`Konva.Transformer` handle chrome, owned by `w0-editor-foundation` and not modified
here. No new animation introduced; reduced-motion honored by construction.

## Unit tests

`node --test` vm-context harness (mirror `background.emit.test.mjs:30-176`). New
feature-distinct filename:

- `extension/background.reopen.test.mjs` — `reopen_passesStoredOriginalAndModelToAnnotate` —
  seed `report:5101[1]` with `original:'O'`, `model:{version:1,items:[…]}`; stub
  `chrome.tabs.sendMessage` to capture args (PING resolves `{ok:true}`, ANNOTATE
  captured); assert the ANNOTATE call args are
  `{ type:"ANNOTATE", image:'O', model:<stored model verbatim> }`.
- `extension/background.reopen.test.mjs` — `reopen_noHost_returnsReloadError_noMutation` —
  stub the first `sendMessage` (PING) to reject; assert `{error}` includes "reload
  the page", and `report:5101` is byte-unchanged.
- `extension/background.reopen.test.mjs` — `reopen_nonTarget_returnsError` — tab
  `about:blank`; assert `{error:"no current Snapdeck target tab"}`, no sendMessage.
- `extension/background.reopen.test.mjs` — `reopen_badIndex_returnsError` — seed 2
  shots, index 9; assert `{error:"no such screenshot"}`, no sendMessage.
- `extension/background.reopen.test.mjs` — `resave_preservesCaptureFields_takesOnlyEditorModel` —
  **(the corruption-lock assertion)** seed `report:5101[1]` = `{ original:'O',
  console:['c'], network:['n'], url:'U', title:'T', captured_at:'CA',
  viewport:{w:9,h:9}, model:{version:1,items:[{old:true}]}, annotated:'OLD',
  annotations:[{old:true}] }`; call `resaveScreenshot(5101, 1, { model:{version:1,
  items:[{new:true}]}, annotated:'NEW', annotations:[{new:true}], original:'ECHO',
  meta:{url:'FRESH',title:'FRESH',captured_at:'FRESH',viewport:{w:1,h:1}},
  console:['LIVE'], network:['LIVE'] })`; assert the stored record =
  `{ original:'O', console:['c'], network:['n'], url:'U', title:'T',
  captured_at:'CA', viewport:{w:9,h:9}, model:{version:1,items:[{new:true}]},
  annotated:'NEW', annotations:[{new:true}] }` — i.e. model/annotated/annotations
  took the editor values; original/console/network/meta were **preserved** (NOT
  'ECHO'/'LIVE'/'FRESH').
- `extension/background.reopen.test.mjs` — `resave_cancelled_noMutation` — call
  `resaveScreenshot(5101, 1, { cancelled:true })`; assert record byte-unchanged.
- `extension/background.reopen.test.mjs` — `resave_busy_noMutation` — call with
  `{ cancelled:true, busy:true }`; assert record byte-unchanged (no double-write).
- `extension/background.reopen.test.mjs` — `resave_doesNotEmitCountTick` — assert
  no `storage.session.set` captured during a re-save (count unchanged).
- `extension/background.reopen.test.mjs` — `resave_twoPortIsolation` — seed
  `report:5101` + `report:5102`; `resaveScreenshot(5101, 0, …)`; assert
  `report:5102` byte-for-byte unchanged.
- `extension/background.reopen.test.mjs` — `moduleLoadsClean_noStorageKey` —
  second vm context whose `chrome` mock omits `storage`: assert no throw at load,
  `onMessage` registered (proves no new top-level listener added).

> The Konva-render-dependent scenarios (model-byte restore through the real editor;
> hostile-model bounded render) are **browser-tester Playwright E2E**, not
> `node --test` — see feature.md E2E specs. Coordinate with `bt` when the popup
> (fe-003) lands so the full click→restore→Done round-trip is driven end-to-end.

## Dependencies

- **STORY-fe-001** — shared-file serialization: fe-001 and this story both add
  `case` branches to the same `handle()` switch in `background.js`. One warm
  frontend-engineer works them sequentially; declaring this edge makes the landing
  order explicit and avoids two stories racing on the same switch. (Not a
  functional dependency — the re-open handler does not call fe-001's handlers.)

Consumes **released** `w0-editor-foundation` (the `ANNOTATE`→`openEditor`→
`deserializeModel`→guarded `render()` seam + the render caps) and
`w0-per-target-reports` (the `report:<port>` store + `currentTargetPort`) — prose
linkage, not `depends_on` ids (cross-feature; feature-level edge in feature.md).

## Cross-domain contract

- **backend-architect:** re-save edits the **local** IndexedDB record only; the
  controller `/resolve` + `/report/save` contract is untouched. (BE sentinel —
  peer-confirmed Phase 5.)
- **database-architect:** in-place value mutation on the existing `kv` store; no
  version bump / new store / index. (DB sentinel — peer-confirmed Phase 5.)
- **devops-architect:** ANNOTATE/PING messaging + editor content scripts already
  registered; no `manifest.json` / build change. (devops sentinel — peer-confirmed
  Phase 5.)
- **security-architect (Phase 7):** re-open of arbitrary stored models is bounded
  by the inherited render guards (caps not weakened); model is from the extension's
  own IndexedDB (isolated-world, not page-writable) — defense-in-depth.

## History

- 2026-06-20 — created by frontend-architect (effort=2, depends on STORY-fe-001)

## Contrarian Findings

### Finding 1 — Re-save addresses the record by a STALE array index; a delete from a re-opened popup mid-edit silently corrupts the wrong screenshot

**Severity:** block

**Mechanism:** `reopenScreenshot(index)` captures `index` at dispatch, fires the
**long-lived** `ANNOTATE` round-trip fire-and-forget, and returns `{ok:true,opening:true}`
so the popup `window.close()`s. On `✓ Done` the deferred `.then` runs
`resaveScreenshot(port, index, resp)`, which re-reads the report fresh and writes the
edited fields into `r2.screenshots[index]` — addressing by **array position**, and the
records carry **no stable id** (verified: `addScreenshot` pushes a plain object with no
id, `background.js:284-295`). The story's index-stability note (lines 111-115) asserts
this is safe because *"while the overlay is open the popup is closed (no concurrent
delete)."* **That premise is false.** The in-page editor overlay is page-world DOM
(`editor.js:33-40`); it does not disable the browser-action popup. The user can re-open
the popup by clicking the toolbar icon while the overlay is still `active` — `refresh()`
→ `refreshGallery()` re-fetches the live grid (fe-003), exposing a working `Delete`.
The editor's `active` guard (`editor.js:15`) blocks a second *ANNOTATE/capture* but has
**zero** visibility to the SW's `DELETE_SCREENSHOT` handler; nothing tracks an in-flight
re-edit. Sequence: re-edit shot at index *i* in flight → user re-opens popup → confirms
`DELETE_SCREENSHOT{index:j}` with *j ≤ i* → `splice` shifts the array → user clicks
`✓ Done` → `resaveScreenshot` re-reads the shifted report and overwrites
`r2.screenshots[i]`, which is now the **former shot i+1**. Result: that bystander record
keeps its own preserved `original`/`console`/`network` but receives shot *i*'s edited
`model`/`annotated`/`annotations` — a silent Frankenstein record; the shot actually
edited is left unchanged; **no error, no console.error**. (If the edited shot itself was
the deletion and it was the last index, `r2.screenshots[index]` is `undefined` → the
defensive guard at line 79 returns and the user's edit is silently *lost* instead —
same root cause, milder symptom.) The fresh re-read framed as "robustness" (line 114) is
precisely what makes the wrong-record write deterministic. Note the scope already
sanctioned the fix: feature.md / scope.md describe the new API as **"by index/id"** — the
architect chose the weaker `index`.

**Recommendation:** **revise** — address re-open / delete / re-save by a **stable
identity**, not array position. No released code need change: synthesize identity from
fields already stored and preserved (`captured_at`, tie-broken by `original` bytes if a
same-millisecond collision is a concern — same `Date.now()`-resolution caveat as the w0
nonce). fe-001's projection emits the identity, this handler re-matches the record on
re-save (no match ⇒ deleted mid-edit ⇒ no-op), and fe-003 passes it. Alternatively the
SW tracks an in-flight-reedit lock `{port,index}` and `DELETE_SCREENSHOT` refuses/adjusts
while a re-edit is pending — but identity-addressing is cleaner and hardens fe-001's
delete too (see fe-001 Finding 1). If the team instead elects to ship index-addressing,
this requires an explicit `## Acknowledged Risk` (stated tolerance for silent
wrong-record corruption when a shot is deleted mid-re-edit) **and** PO approval per the
block rubric.

### Finding 2 — Re-save persists `resp.model` verbatim; it round-trips and re-deserializes on the next re-open (→ security-architect Phase 7)

**Severity:** info

**Mechanism:** `resaveScreenshot` writes `target.model = resp.model ?? null`
(line 82) straight back to IndexedDB with no shape check — correct for model-byte
losslessness, but it means a stored `model` that is *bounded at RENDER* by the inherited
caps (`RENDER_ITEM_CAP=500` slices the render list, `editor.js:178-179`; `RENDER_TEXT_CAP`
clamps display, `:256`) is nonetheless **persisted in full** in the envelope and
re-`deserializeModel`'d on every subsequent re-open. The caps bound the *canvas*, not the
*stored envelope size*, so envelope growth across re-edits is unbounded-by-construction.
This is same-origin extension IndexedDB (isolated-world, not page-writable) → defense-in-
depth, not an externally-reachable DoS — consistent with Critical directive §2. **Not a
block; flagged for security-architect's Phase-7 STRIDE re-confirm** to close the loop on
"bounded end-to-end," not just bounded-at-render.

### Finding 3 — Re-open target can diverge from the rendered grid (active-tab / multi-window)

**Severity:** info

**Mechanism:** The grid is rendered from `currentTargetPort()` at popup-open; on click,
`reopenScreenshot` re-resolves `currentTargetPort()` + `activeTab()` **fresh**
(`background.js:78-83,67-70`, using `{active:true,currentWindow:true}`). Port and host
tab are therefore self-consistent *at click time*, but if the active target changed
between render and click — a tab switch, or a multi-window setup where the SW's
`currentWindow` resolves to a different window than the one whose popup was shown — the
handler reads index *N* of the **now-current** target's report, which may be a different
target than the thumbnails the user is looking at. Largely mitigated because Chrome closes
the browser-action popup on focus loss, so a deliberate tab switch usually dismisses the
popup first. Recorded as a conscious assumption ("the active target does not change
between grid render and tile click"), not an actionable defect.
