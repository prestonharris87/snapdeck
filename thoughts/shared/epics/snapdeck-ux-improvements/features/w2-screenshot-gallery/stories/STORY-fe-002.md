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
status: validated
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
`extension/background.js`. It re-opens a stored screenshot (**by stable identity
`sid`**, never array index — see fe-001 "Stable-identity addressing") in the
**released** in-page editor on its stored `original` PNG via the
`ANNOTATE { image, model }` seam, and on `✓ Done` **replaces** that one record in
`report:<port>` — re-reading the record, **matching it by `sid`**, and taking ONLY
`model` / `annotated` / `annotations` from the editor response while **preserving**
`original` / `console` / `network` / meta from the **pre-edit stored record**; if the
`sid` no longer resolves (the shot was deleted while the overlay was open), the re-save
is a **fail-safe no-op**. This story owns the **re-save preserve-from-record contract**
(the field-preserve corruption lock), the **stable-identity re-save** (the wrong-record
corruption lock — fe-002 Finding 1), the graceful no-host / busy paths, and the bounded
arbitrary-model re-open (security — guards inherited, never re-implemented).

## What it should look like

A new `case` in the existing `handle()` switch dispatching to two new helpers; the
re-open uses the **released** editor seams verbatim. The host tab is the **current
target tab** (= the active tab — the gallery shows that target's report and
`editor.js` is registered on localhost there; Critical directive §5 resolved).

### `REOPEN_SCREENSHOT` — pre-flight host check (so the popup can surface no-host)

```js
case "REOPEN_SCREENSHOT":
  return reopenScreenshot(msg.sid);

async function reopenScreenshot(sid) {
  const port = await currentTargetPort();
  if (port == null) return { error: "no current Snapdeck target tab" };
  const r = await getReport(port);
  const index = indexOfScreenshotId(r, sid);     // resolve STABLE identity → current position
  const shot = r.screenshots[index];
  if (index < 0 || !shot) return { error: "no such screenshot" };  // not in current target → fail-safe
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
  // Pass the STABLE sid (not index) to the deferred re-save — the array may splice
  // (mid-edit sibling delete) before Done resolves.
  chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE", image: shot.original, model: shot.model })
    .then((resp) => resaveScreenshot(port, sid, resp))
    .catch(() => { /* tab navigated/closed mid-edit → record left unchanged (no partial write) */ });
  return { ok: true, opening: true };
}
```

### `resaveScreenshot` — the preserve-from-record contract (corruption lock)

```js
async function resaveScreenshot(port, sid, resp) {
  if (!resp || resp.cancelled) return;          // Cancel OR busy ({cancelled:true,busy:true}) → stored record UNCHANGED
  const r2 = await getReport(port);             // re-read fresh (robust to SW wake AND to a mid-edit splice)
  const index = indexOfScreenshotId(r2, sid);   // match by STABLE identity, NOT a held array position
  const target = r2.screenshots[index];
  if (index < 0 || !target) return;             // shot deleted while overlay open → FAIL-SAFE no-op (edit discarded; NO wrong-record write)

  // Take ONLY from the editor response:
  target.model       = resp.model ?? null;      // model-byte lossless envelope {version:1, items:[…]}
  target.annotated   = resp.annotated;          // re-rendered PNG; editor returns null when items.length===0
  target.annotations = resp.annotations || [];  // re-projected lossy annotations

  // PRESERVE from the pre-edit record (NEVER read from resp):
  //   target.original, target.console, target.network,
  //   target.url, target.title, target.captured_at, target.viewport
  // (left untouched by construction — we only overwrite the three fields above; and
  //  because original+captured_at are preserved, the matched record's sid is UNCHANGED)

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

Stable-identity note (**corrects** the original, false "index-stability" claim):
the in-page editor overlay is page-world DOM (`editor.js:33-40`) and does **NOT**
disable the browser-action popup — the user **can** re-open the popup (toolbar icon)
while the overlay is still `active`, and `refresh()` → `refreshGallery()` then exposes a
working `Delete`. The editor's `active` guard (`editor.js:15`) blocks only a second
ANNOTATE/capture; it has **zero** visibility into the SW `DELETE_SCREENSHOT` handler. So
a held **array index is NOT stable** across the long-lived re-edit: a confirmed delete of
a lower-index sibling splices the array, and a naive `r2.screenshots[index]` re-save would
overwrite a **bystander** record — silent corruption (fe-002 Finding 1, severity
**block**). The fix (this revision) is to address by **stable identity (`sid`)**, never
array position: `resaveScreenshot` re-reads the report and re-matches the record via
`indexOfScreenshotId(r2, sid)`; if the shot was itself deleted mid-edit the `sid` no longer
resolves and the re-save is a **fail-safe no-op** (edit discarded, no wrong-record write).
Because `sid` derives from `original` + `captured_at` — both **preserved** by this very
re-save — the identity is also stable across re-saves.

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
- **Address by stable identity (`sid`), never array index.** Re-open and re-save use
  the `screenshotId` / `indexOfScreenshotId` helpers authored in **STORY-fe-001**
  (same `background.js`; this story's `depends_on: [STORY-fe-001]` serializes the landing
  order). A `sid` that no longer resolves (shot deleted mid-edit / wrong target) ⇒ a
  fail-safe no-op, never a wrong-record write. This is the wrong-record corruption lock
  (fe-002 Finding 1); the field-preserve contract below is the *which-fields* lock — both
  are required.
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

- [ ] Re-open resolves the shot **by `sid`** (`indexOfScreenshotId`) and sends
  `{ type:"ANNOTATE", image: shot.original, model: shot.model }` to the active tab —
  `shot.model` passed through **verbatim** (no SW-side sanitization/mutation); a `sid`
  not in the current target's report returns `{error:"no such screenshot"}`, no sendMessage.
- [ ] No content-script host (PING rejects) → returns the graceful
  "could not open the annotation overlay (reload the page so the content script
  loads): …" error (mirrors `background.js:280`); the stored record is unchanged.
- [ ] On `✓ Done`, the record **matched by `sid`** (re-read fresh, `indexOfScreenshotId`)
  is **replaced**: `model` model-byte identical to `resp.model`, `annotated` +
  `annotations` re-rendered from `resp`, while `original` / `console` / `network` /
  `url` / `title` / `captured_at` / `viewport` are **preserved from the pre-edit record**
  (NOT the editor's fresh/live values). **No** other screenshot is touched.
- [ ] **Mid-edit corruption lock (fe-002 Finding 1):** if a **lower-index sibling** is
  deleted while the overlay is open, the array splices but the re-save still re-matches
  the edited record by `sid` and writes it correctly — the bystander record is
  **byte-unchanged**. If the **edited shot itself** is deleted mid-edit, `sid` no longer
  resolves and the re-save is a **fail-safe no-op** (no record created/overwritten).
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
  seed `report:5101[1]` with `original:'O'`, `captured_at:'CA1'`, `model:{version:1,items:[…]}`;
  capture `sid1 = screenshotId(shot)`; call `REOPEN_SCREENSHOT {sid:sid1}`; stub
  `chrome.tabs.sendMessage` to capture args (PING resolves `{ok:true}`, ANNOTATE
  captured); assert the ANNOTATE call args are
  `{ type:"ANNOTATE", image:'O', model:<stored model verbatim> }`.
- `extension/background.reopen.test.mjs` — `reopen_noHost_returnsReloadError_noMutation` —
  stub the first `sendMessage` (PING) to reject; assert `{error}` includes "reload
  the page", and `report:5101` is byte-unchanged.
- `extension/background.reopen.test.mjs` — `reopen_nonTarget_returnsError` — tab
  `about:blank`; assert `{error:"no current Snapdeck target tab"}`, no sendMessage.
- `extension/background.reopen.test.mjs` — `reopen_unknownSid_returnsError` — seed 2
  shots, `REOPEN_SCREENSHOT {sid:"nope"}`; assert `{error:"no such screenshot"}`, no sendMessage.
- `extension/background.reopen.test.mjs` — `resave_preservesCaptureFields_takesOnlyEditorModel` —
  **(the field-preserve corruption-lock assertion)** seed `report:5101[1]` = `{ original:'O',
  console:['c'], network:['n'], url:'U', title:'T', captured_at:'CA',
  viewport:{w:9,h:9}, model:{version:1,items:[{old:true}]}, annotated:'OLD',
  annotations:[{old:true}] }`; capture `sid = screenshotId(that record)`; call
  `resaveScreenshot(5101, sid, { model:{version:1,
  items:[{new:true}]}, annotated:'NEW', annotations:[{new:true}], original:'ECHO',
  meta:{url:'FRESH',title:'FRESH',captured_at:'FRESH',viewport:{w:1,h:1}},
  console:['LIVE'], network:['LIVE'] })`; assert the stored record =
  `{ original:'O', console:['c'], network:['n'], url:'U', title:'T',
  captured_at:'CA', viewport:{w:9,h:9}, model:{version:1,items:[{new:true}]},
  annotated:'NEW', annotations:[{new:true}] }` — i.e. model/annotated/annotations
  took the editor values; original/console/network/meta were **preserved** (NOT
  'ECHO'/'LIVE'/'FRESH'). (Because original+captured_at are preserved, `sid` is unchanged.)
- `extension/background.reopen.test.mjs` — `resave_siblingDeletedMidEdit_matchesBySid_noBystanderCorruption` —
  **(the wrong-record corruption-lock assertion — fe-002 Finding 1 block)** seed 3 shots
  with distinct `captured_at`; capture `sidB = screenshotId(shot#2)`; **delete the
  lower-index shot #1** (splice) so the edited record shifts from index 2 → 1; then call
  `resaveScreenshot(5101, sidB, {model:{version:1,items:[{new:true}]}, annotated:'NEW', …})`;
  assert the record now at index 1 (the one whose `sid===sidB`) got the new model/annotated,
  and the **bystander** record (former #0, now index 0) is byte-unchanged across
  model/annotated/annotations/original/console/network/meta.
- `extension/background.reopen.test.mjs` — `resave_selfDeletedMidEdit_failSafeNoOp` —
  seed 2 shots; capture `sidX = screenshotId(shot#0)`; **delete shot#0** so `sidX` no
  longer resolves; call `resaveScreenshot(5101, sidX, {model:…, annotated:'NEW'})`; assert
  the report still holds the surviving 1 shot byte-unchanged and **no** record was created
  or overwritten (fail-safe no-op).
- `extension/background.reopen.test.mjs` — `resave_cancelled_noMutation` — call
  `resaveScreenshot(5101, sid, { cancelled:true })`; assert record byte-unchanged.
- `extension/background.reopen.test.mjs` — `resave_busy_noMutation` — call with
  `{ cancelled:true, busy:true }`; assert record byte-unchanged (no double-write).
- `extension/background.reopen.test.mjs` — `resave_doesNotEmitCountTick` — assert
  no `storage.session.set` captured during a re-save (count unchanged).
- `extension/background.reopen.test.mjs` — `resave_twoPortIsolation` — seed
  `report:5101` + `report:5102`; `resaveScreenshot(5101, <sid of a 5101 shot>, …)`; assert
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

- 2026-06-20T18:47:07Z — orchestrator — validate validated + honesty passed (BOSS-mode implement, Wave-2); node --test 144/144
- 2026-06-20 — created by frontend-architect (effort=2, depends on STORY-fe-001)
- 2026-06-20T00:00:00Z — implemented (commit: a50f982); node --test 144/144 pass; all 12 new reopen tests green

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

## Revisions

### 2026-06-20 — product-owner (arbitrate, run-20260620 w2-screenshot-gallery)

**Finding 1 (block) — RESOLVED BY REVISION (stable-identity addressing), NOT
`## Acknowledged Risk`.** This is silent data corruption (a re-save overwrites a
*bystander* record after a mid-edit sibling delete), the fix is cheap and **already in
scope** (the API was spec'd "by index/**id**"), and it needs **no released-code change** —
verified against `background.js:284-295` that the capture record stores `captured_at` +
`original` (no `id`), both **preserved** by `resaveScreenshot`, so they synthesize a stable
identity. The block disposition is therefore *resolve*, not *accept* — acknowledging silent
corruption when a cheap, in-scope, no-released-change fix exists would be the wrong call.
Revised:
- `REOPEN_SCREENSHOT` now takes `msg.sid`, resolves the shot via `indexOfScreenshotId`
  (fe-001 helper), and passes the **`sid`** (not a held index) into the deferred re-save.
- `resaveScreenshot(port, sid, resp)` re-reads the report and **re-matches the record by
  `sid`**; a `sid` that no longer resolves ⇒ **fail-safe no-op** (edit discarded; no
  wrong-record write). The field-preserve contract is unchanged (still overwrites only
  `model`/`annotated`/`annotations`; preserves `original`/`console`/`network`/meta).
- **Corrected the now-false story claim**: the old "Index-stability note" asserted "while
  the overlay is open the popup is closed (no concurrent delete)" — the contrarian verified
  (and I confirmed against `editor.js:13-16,33-40`) the popup **is** re-openable while the
  overlay is active and the `active` guard has zero visibility into `DELETE_SCREENSHOT`.
  Rewrote it as the "Stable-identity note" explaining why index is unsafe and `sid` is the fix.
- Validate checklist + unit tests updated: re-open/resave by `sid`;
  **`resave_siblingDeletedMidEdit_matchesBySid_noBystanderCorruption`** (the wrong-record
  lock) + **`resave_selfDeletedMidEdit_failSafeNoOp`**.
Paired lock-step with fe-001 (emits `sid` + `screenshotId`/`indexOfScreenshotId` helpers)
and fe-003 (popup passes `sid`). `depends_on` graph unaffected. Promoted to a feature.md AC
+ a Konva-lane mid-edit E2E so the guard is validator-enforceable.

**Finding 2 (info) — DEFERRED to security-architect Phase 7 STRIDE.** `resaveScreenshot`
persists `resp.model` verbatim (correct for model-byte losslessness), so a model
*bounded-at-render* by the inherited caps is nonetheless stored in full and
re-deserialized on the next re-open — envelope growth across re-edits is
unbounded-by-construction. Same-origin extension IndexedDB (isolated-world, not
page-writable) ⇒ defense-in-depth, not an externally-reachable DoS. This is the
correct Phase-7 question ("bounded **end-to-end**," not just bounded-at-render); it's
already in the stress-test § Security pointer. **Standing guardrail: do NOT weaken the
inherited `RENDER_ITEM_CAP=500` / `RENDER_TEXT_CAP=10000` caps** — the bounded-re-open AC
and Konva-lane E2E depend on them. No code change at arbitrate; flagged for security.

**Finding 3 (info) — ACCEPTED (conscious assumption); HARDENED as a side effect of the
Finding-1 fix.** With identity-addressing, if the active target changes between grid render
and tile click, `reopenScreenshot` resolves the clicked `sid` against the *now-current*
target's report and almost always finds **no match** ⇒ a fail-safe `{error}` no-op, rather
than silently re-opening shot *N* of a different target (the index-addressing failure mode).
The residual (two different targets both holding a shot with identical `captured_at` +
`original` — effectively impossible across distinct captures) is accepted; Chrome's
focus-close of the popup already mitigates the trigger. Recorded; no further change.

**Status:** pending → approved.

## Security Review

_security-architect, Phase 7 STRIDE, 2026-06-20. Verified end-to-end against RELEASED
code on disk (`editor.js`, `editor-model.js`, `manifest.json`, `background.js`) — file:line
cited. This story is the consumer that `w0-editor-foundation` STORY-fe-004 (render guard) and
`w1-text-box-autofit` STORY-fe-002 / DEFECT-001 r2 **forward-flagged** as "the first feature
to re-open ARBITRARY stored models through the render boundary." This is the close-out._

### Finding S1 — Bounded arbitrary-model re-open (THE load-bearing verdict) — CONFIRMED bounded

**Severity:** info (security-positive — affirms an inherited control; no change required)

**Threat (STRIDE — Denial of Service / resource exhaustion):** re-opening a maliciously-
crafted or corrupted stored `model` (arrow + box + text + rectangle, with numerically-hostile
geometry `NaN`/`Infinity`/`1e308`/wrong-type, oversized item count, multi-megabyte text)
could throw, hang, or spew `console.error` if the gallery re-open path weakened or bypassed
the released render guards.

**Verification (RELEASED code, end-to-end trace):**
- Re-open sends `{ type:"ANNOTATE", image: shot.original, model: shot.model }` **verbatim**
  (this story, line 72) — no SW-side pre-process/sanitize/reshape — into the **same** seam
  `addScreenshot` already uses (`background.js:278`). → `editor.js` isolated-world listener
  (`editor.js:14`) → `openEditor(image, model)` (`:16`) → `deserializeModel` (`:165` →
  `editor-model.js:86-95`, opaque pass-through, returns `[]` for a non-v1 envelope, **never
  throws**) → guarded `render()` (`editor.js:176-189`).
- **Item-count cap:** `render()` slices `model.slice(0, RENDER_ITEM_CAP)` with
  `RENDER_ITEM_CAP = 500` (`editor.js:179, :192`). An oversized item count is bounded at the
  canvas. ✓
- **Numerically-hostile geometry:** `renderArrow` skips non-finite (`editor.js:223`);
  `renderText` skips non-finite or `≤0` width/height (`:253-254`); `renderBox` skips
  non-finite or `≤0` (`:324-325`). `NaN`/`Infinity`/`1e308`/wrong-typed coords → item
  skipped, no throw. ✓
- **Oversized text:** capped to `RENDER_TEXT_CAP = 10000` chars **before any measurement**
  (`editor.js:256, :193`); auto-fit is bounded by the min-overflow short-circuit (1
  measurement, `:210`) + a binary search (~7 measurements, `:212-218`).
- **The lesson-99 slow-band fix is APPLIED:** the degenerate short-circuit now keys on the
  **clamped inset** `innerW`/`innerH` (`editor.js:286`, `if (innerW < TEXT_AUTOFIT_MIN ||
  innerH < TEXT_AUTOFIT_MIN)`), not the raw `item.width`. The old ≈12–18px raw-dim slow band
  is closed; the residual worst case is `innerW = 6px` over the length-capped text — finite
  and **terminating**, not a hang.

**Verdict:** **BOUNDED end-to-end — no throw, no hang, no `console.error`.** The gallery
re-open **inherits the released caps verbatim with NO bypass, fork, or re-implementation** —
confirmed by this story's byte-unchanged assertion for `editor.js`/`editor-model.js` (lines
155-159) and feature.md "Out of scope" (editor render-boundary guards consumed as released).
Reachability is **defense-in-depth only**: `editor.js` is registered with **no `"world"`
key** (`manifest.json:39-44` → isolated world; only `capture.js` is `"world":"MAIN"`,
`:36`), and there is **no `externally_connectable`** in the manifest — so the `model`
originates ONLY from the extension's own IndexedDB (`report:<port>`), which is **not
page-writable and not network-reachable**. A hostile model can arrive only via the
extension's own corruption, a future bug, or a devtools-planted value (= already-local-
compromise). **Not an externally-reachable DoS.**

**Recommendation:** none — affirm. The Konva-lane E2E ("Bounded re-open of a hostile /
oversized stored model") is the right enforcement and must stay green.

### Finding S2 — Bounded-at-render ≠ bounded-envelope (fe-002 Finding 2 carried from arbitration) — ACCEPTED defense-in-depth

**Severity:** low (defense-in-depth; accept-risk — no change)

**Threat (Tampering / DoS — persisted envelope size):** the render caps bound the *canvas*,
not the *stored envelope*. On `✓ Done` the editor emits `serializeModel(model)`
(`editor.js:486` → `editor-model.js:33-35`), which serializes the **full** deserialized
`model` (deserialize returns `clone(payload.items)` **unsliced**, `editor-model.js:92`; only
`render()` slices to 500). `resaveScreenshot` then persists `target.model = resp.model`
**verbatim** (this story, line 90). So a model bounded *at render* by the 500/10000 caps is
nonetheless **persisted in full** and re-`deserializeModel`'d on every subsequent re-open —
the envelope is whatever the model is, render-time caps do not shrink it.

**Verdict:** **ACCEPTABLE.** The persisted envelope is extension-own IndexedDB data
(isolated-world, not page-writable, not network — same grounding as S1). This is
defense-in-depth resilience against the extension's own corruption / a future bug / a
devtools-planted value, **NOT an externally-reachable DoS**. There is no programmatic loop
that multiplies items across re-edits — growth is bounded by user pointer gestures
(`model.push` on draw, `editor.js:414,418,426`), so "unbounded-by-construction" is the
theoretical envelope shape, not a runaway amplifier. Persisting the full model verbatim is
*required* for the model-byte-lossless AC; shrinking it would break losslessness.

**Recommendation:** **acknowledge**, and record the **standing guardrail: do NOT weaken the
inherited `RENDER_ITEM_CAP = 500` / `RENDER_TEXT_CAP = 10000` caps** (`editor.js:192-193`).
The bounded-re-open AC, the S1 verdict, and the Konva-lane E2E all rest on them; any future
edit that lowers/removes a cap re-opens the DoS axis and must come back through security.

### Finding S3 — Re-open / re-save handler entry-point hygiene — CLEAN

**Severity:** info

- **EoP / privilege:** additive `case` on the existing `handle()` switch
  (`background.js:231`), no new top-level listener, no `manifest.json`/permission change
  (manifest already grants `tabs`/`scripting`/`storage`; `:6`). ✓
- **Spoofing / two-port isolation:** `reopenScreenshot`/`resaveScreenshot` resolve the port
  **internally** via `currentTargetPort()` (the boundary-anchored localhost gate,
  `background.js:81`); callers pass `sid` only, never a port. A `sid` absent from the
  current target's report → `indexOfScreenshotId` → -1 → **fail-safe no-op** (this story,
  lines 57, 87), never a cross-port write (write-key ≡ read-key). ✓ The Finding-1
  stable-identity fix also closes the silent wrong-record corruption path.
- **Injection:** `shot.model` is never used as an IDB key, never `eval`'d, never string-
  concatenated; the IDB key is `report:${int port}` from the localhost-gated resolver. ✓

**Recommendation:** none.

**PO disposition (S1 — bounded arbitrary-model re-open, CONFIRMED):** ACCEPT_AS_RECOMMENDATION — security CONFIRMED the load-bearing verdict (bounded end-to-end, caps inherited verbatim, no bypass/fork; defense-in-depth, not externally-reachable). Already validator-enforced by the feature.md "Bounded arbitrary-model re-open (security)" + "Overlay reuse, inherited guards" (caps-not-weakened / no-bypass) ACs and the Konva-lane hostile-model E2E + fe-002's bounded-render validate item; this AC was promoted at decompose, so no new AC (no double-promote). The Konva-lane E2E must stay green. Not gating.

**PO disposition (S2 — bounded-at-render ≠ bounded-envelope LOW):** ACCEPT_AS_RECOMMENDATION — this closes the fe-002 Finding 2 item I deferred to Phase 7; security confirms it is acceptable defense-in-depth (extension-own IndexedDB, isolated-world, not externally-reachable; persisting the full model verbatim is REQUIRED for the model-byte-lossless AC). Standing guardrail (already a feature.md AC): do NOT weaken `RENDER_ITEM_CAP=500` / `RENDER_TEXT_CAP=10000` — any future cap lowering re-opens the DoS axis and must return through security. Not gating.

**PO disposition (S3 — re-open/re-save entry-point hygiene, CLEAN):** ACCEPT_AS_RECOMMENDATION — security-positive; the port-internal resolution, fail-safe-no-op on absent `sid`, and no-injection properties are already covered by the block-fix two-port-isolation ACs and fe-002's validate items. Not gating.

## Validation

- 2026-06-20T18:47:07Z — result: **validated** (honesty: passed)
- frontend-validator: validated (15 ACs; REOPEN by sid via released ANNOTATE seam, caps inherited; re-save in-place preserve-from-record; sibling/self-deleted-mid-edit fail-safe no-op). honesty: passed (additive; corruption-prevention tests genuinely exercise stale-sid paths). node --test 144/144.
