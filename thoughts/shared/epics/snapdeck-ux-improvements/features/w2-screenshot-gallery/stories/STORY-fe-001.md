---
type: story
id: STORY-fe-001
name: "Gallery fetch + delete report-screenshot handlers + GC"
domain: frontend
parent_feature: w2-screenshot-gallery
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: pending
depends_on: []
diff_estimate: substantive
frontend_lane: N/A
visual_references: []
created_at: 2026-06-20T16:30:00Z
last_run_id: run-20260620-161818-88519
---

# Story: Gallery fetch + delete report-screenshot handlers + GC

## What we're doing

Add two new **zero-port-arg** message handlers to the extension service worker
(`extension/background.js`) that the popup gallery (STORY-fe-003) consumes:
(1) **`GET_REPORT_SCREENSHOTS`** — returns the current target's `report:<port>`
`screenshots[]` projected to `{ index, thumbnail, light-meta }` for the grid;
(2) **`DELETE_SCREENSHOT`** — removes one screenshot by index from the current
target's report, then emits the `REPORT_COUNT_CHANGED` tick so the icon badge
repaints. Both resolve the current target port **internally** via the released
`currentTargetPort()` — callers pass an **index only, never a port** (write-key ≡
read-key, exactly as `addScreenshot()`/`saveReport()` already do). This story also
owns the **GC home** decision (see "GC helper lock" below): a delete that empties
the report truly removes the `report:<port>` IDB key rather than leaving an empty
record behind.

## What it should look like

Two new `case` branches inside the **existing** `handle(msg)` switch
(`background.js:231-258`), reached through the **existing** single
`chrome.runtime.onMessage` listener (`background.js:112-115`). **No new top-level
listener** is added (a second `onMessage`/`storage.onChanged` registration breaks
the frozen released vm suites — see Unit tests).

### `GET_REPORT_SCREENSHOTS` (read; non-mutating)

```js
case "GET_REPORT_SCREENSHOTS": {
  const port = await currentTargetPort();          // released SSOT; non-target → null
  const r = await getReport(port);                 // port==null → EMPTY_REPORT(), NO idb read
  return {
    port,
    screenshots: r.screenshots.map((s, index) => ({
      index,
      thumbnail: s.annotated || s.original,         // annotated PNG; fall back to original when no annotations
      url: s.url, title: s.title, captured_at: s.captured_at,
      hasAnnotations: !!(s.annotations && s.annotations.length),
    })),
  };
}
```

- **Non-target / empty report** → `currentTargetPort()` returns `null` →
  `getReport(null)` returns `EMPTY_REPORT()` (no IDB read, `background.js:41`) →
  `screenshots: []`. The popup renders its empty state. No throw, no port leak.
- `thumbnail` is the stored base64 data-URL (`annotated` when present, else
  `original`). The popup scales it down with CSS (`object-fit`) — **no SW-side
  resize**. Light meta (`url`/`title`/`captured_at`) is for tile tooltips/labels.

### `DELETE_SCREENSHOT` (mutating; index-scoped; GC home)

```js
case "DELETE_SCREENSHOT": {
  const port = await currentTargetPort();
  if (port == null) return { error: "no current Snapdeck target tab" };  // defensive; popup never reaches this
  const r = await getReport(port);
  const index = msg.index;
  if (!Number.isInteger(index) || index < 0 || index >= r.screenshots.length) {
    return { error: "no such screenshot" };
  }
  r.screenshots.splice(index, 1);                  // remove exactly that one
  if (r.screenshots.length === 0) {
    await deleteReport(port);                       // GC: remove the report:<port> KEY (lock decision)
  } else {
    await setReport(port, r);                       // shrink the record
  }
  emitReportCountChanged(port, r.screenshots.length);  // new count (0 when emptied) → badge repaints
  return { ok: true, count: r.screenshots.length };
}
```

### New IDB + report helpers (additive; released seams untouched)

```js
// mirror idbGet/idbSet (background.js:18-33) — a 'readwrite' delete transaction
async function idbDelete(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite").objectStore("kv").delete(key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// GC: truly remove report:<port>. Null-guarded like setReport (never act on a null port).
async function deleteReport(port) {
  if (port == null) return;
  await idbDelete(reportKey(port));
}
```

## Existing behavior baseline

- **Currently:** `background.js:231-258` — `handle(msg)` switches on `GET_STATE`,
  `SET_NOTE`, `ADD_SCREENSHOT`, `SAVE_REPORT`, `CLEAR_REPORT`; there is **no**
  read-the-screenshots or delete-by-index message. The popup can only read the
  count (`GET_STATE` → `{count, note, port}`, `background.js:233-238`).
- **Dispatch path / call graph:** popup `chrome.runtime.sendMessage`
  (`popup.js:4`) → SW `chrome.runtime.onMessage` listener (`background.js:112-115`)
  → `handle(msg)` → `currentTargetPort()` (`:78-83`, the localhost-gated SSOT) →
  `getReport(port)` (`:40-43`) / `setReport(port, r)` (`:44-47`) /
  `clearReport(port)` (`:48`) → `idbGet`/`idbSet` (`:18-33`) →
  `emitReportCountChanged(port, count)` (`:53-56`) → `chrome.storage.session.set`
  tick consumed by the w1 badge listener (`:468-471`).
- **No-regression assertion:** the released seams stay **byte-identical** —
  `getReport`/`setReport`/`clearReport`/`reportKey`/`EMPTY_REPORT`
  (`:37-48`), `currentTargetPort`/`portOfUrl` (`:59-83`), `addScreenshot`
  (`:261-299`), `saveReport` (`:301-333`), `emitReportCountChanged` (`:53-56`),
  and **every existing `handle()` case**. `clearReport` and its two call sites
  (`SAVE_REPORT` `:328`, `CLEAR_REPORT` `:252`) are **NOT** repointed to the new
  `deleteReport` (scope: the keying contract is consumed unchanged) — `deleteReport`
  is called **only** by the new `DELETE_SCREENSHOT` handler. No new top-level
  listener; no `manifest.json` change. The released vm suites
  (`background.reports.test.mjs`, `background.emit.test.mjs`,
  `background.shortcuts.test.mjs`, `background.icon-badge.test.mjs`) stay green.
- **Explicitly changing:** two additive `handle()` cases
  (`GET_REPORT_SCREENSHOTS`, `DELETE_SCREENSHOT`) + two additive helpers
  (`idbDelete`, `deleteReport`).
- **Verified:** 2026-06-20 — opened `background.js` (full), `editor-model.js`,
  `background.emit.test.mjs`.

### GC helper lock — DECISION (this story owns it)

scope.md §4 wants Delete to be the GC home so the store does not accumulate
empty/stale `report:<port>` entries. The released `clearReport(port)`
(`background.js:48`) does **not** delete the key — it `setReport(port,
EMPTY_REPORT())`, persisting an empty `{note:"", screenshots:[]}` record, which
still occupies a key and is exactly the "stale entry" the per-target LOW-2
forward-flag warns about.

**Decision: add a new `deleteReport(port)` (via new `idbDelete(key)`) and call it
ONLY from the new `DELETE_SCREENSHOT` handler when the splice empties the report —
truly removing the `report:<port>` key.** Released `clearReport` and its existing
call sites (`SAVE_REPORT`, `CLEAR_REPORT`) are **unchanged**.

Rationale:
1. **Fulfills the GC mandate literally.** Removing the key bounds the keyspace; an
   empty record does not. scope §4 / AC "GC — Delete owns cleanup" asks for *no
   stale populated/`report:<port>` entry*.
2. **Observably safe — zero consumer regression.** `getReport(port)` reads a
   missing key as `EMPTY_REPORT()` (`idbGet` → `undefined` → `|| EMPTY_REPORT()`,
   `background.js:42`), so post-delete the report reads `{note:"", screenshots:[]}`,
   `count === 0` — **identical** to the empty-record path. The w1 badge consumer
   (`GET_STATE`/`getReport` → count 0) repaints to green/0 either way.
3. **Minimal + additive.** `idbDelete` mirrors `idbGet`/`idbSet` (a `delete`
   transaction); `deleteReport` mirrors `clearReport`'s null-guard. The released
   keying contract is untouched, satisfying scope's "out of scope: the keying
   contract is consumed unchanged."

Note (accepted, consistent with released `Clear`): a delete-that-empties drops the
report-level `note` (the key is gone; `getReport` reads `note: ""`). This matches
the released `Clear` button, which already wipes the note via `clearReport` →
`EMPTY_REPORT()`. Acceptable: emptying the report is a terminal action.

## How we're doing it

- **File:** `extension/background.js` only (+ a new test file). Add the two
  `case` branches to the existing `handle()` switch and the two helpers near the
  existing IDB/report helpers (`:18-48`). Keep additions **side-effect-free at
  module top level** — function declarations only, no new listeners.
- **Port resolution is internal and released.** Use `currentTargetPort()`
  verbatim; do **not** add a second/looser localhost predicate (the released SSOT
  guards deceptive hosts → null, `:81`). Callers (popup) pass `msg.index` only.
- **Index-scoped isolation.** Because the port is resolved from the active tab
  inside the handler, an index-scoped delete in target A can never touch target
  B's `report:<port>` record (write-key ≡ read-key). Do not accept or read a port
  from `msg`.
- **Emit on count change only.** `DELETE_SCREENSHOT` emits via the released
  `emitReportCountChanged` (its own `port==null` guard at `:54` protects the
  defensive non-target path). `GET_REPORT_SCREENSHOTS` is read-only — **never**
  emits.
- **No manifest change** — `storage`/`tabs`/`activeTab`/`scripting`/
  `unlimitedStorage` are already granted (`manifest.json:6`); the popup + SW are
  already registered. (devops sentinel — confirmed at the Phase-5 peer floor.)

## How we validate it was done correctly

- [ ] `GET_REPORT_SCREENSHOTS` on a target with N screenshots returns
  `screenshots.length === N`, each item `{ index, thumbnail, url, title,
  captured_at, hasAnnotations }`, `index` ascending `0..N-1` in capture order.
- [ ] `thumbnail` equals the screenshot's `annotated` when present, else its
  `original`.
- [ ] `GET_REPORT_SCREENSHOTS` on a non-target tab (`currentTargetPort()` → null)
  returns `{ port: null, screenshots: [] }` with **no** IDB read attempted and
  **no** throw.
- [ ] `DELETE_SCREENSHOT { index: 1 }` on a 3-shot report leaves exactly the
  former `#0` and `#2`, returns `{ ok:true, count:2 }`, and the persisted record
  has 2 screenshots.
- [ ] `DELETE_SCREENSHOT` that removes the **last** screenshot calls
  `deleteReport` → the `report:<port>` key is **absent** from the store
  afterward (`getReport(port)` reads `{note:"", screenshots:[]}`, count 0).
- [ ] A delete (any) emits `REPORT_COUNT_CHANGED { port, count: <new>, ts }` via
  `chrome.storage.session.set`; the emptying delete emits `count: 0`.
- [ ] `DELETE_SCREENSHOT` with an out-of-range or non-integer `index` returns
  `{ error }` and mutates nothing.
- [ ] Released seams unchanged: `clearReport`, `setReport`, `getReport`,
  `addScreenshot`, `saveReport`, every existing `handle()` case, and the w1 badge
  listeners are byte-identical; **no** new top-level listener.
- [ ] Two-port isolation: a delete with target A active never alters
  `report:<B>` (handler resolves the port internally; `msg` carries no port).

## Motion contract

n/a — `frontend_lane: N/A`. This story is service-worker message handling (no UI,
no DOM, no animation). Reduced-motion is not applicable.

## Unit tests

Use the released `node --test` vm-context harness pattern from
`background.emit.test.mjs:30-176` (a `vm.createContext` seeded with hand-written
`chrome` + in-memory `indexedDB` Map-backed kv stub, `vm.runInContext(bgSrc, ...)`,
capture the `onMessage` listener and invoke handlers via it OR call the context's
top-level fns directly). **New, feature-distinct filename** to survive the
dir-level `node --test extension/*.test.mjs` run (a sibling owns
`background.reports.test.mjs`):

- `extension/background.gallery.test.mjs` — `getReportScreenshots_returnsIndexedProjection` —
  seed `report:5101` with 3 screenshots (one with `annotated`, one annotation-less);
  assert the response is `{ port:5101, screenshots:[{index:0,thumbnail:<annotated>,…},…] }`
  in order, `thumbnail` falls back to `original` for the annotation-less shot.
- `extension/background.gallery.test.mjs` — `getReportScreenshots_nonTarget_emptyNoIdbRead` —
  mock tab URL `about:blank`; assert `{ port:null, screenshots:[] }` and the idb
  `get` call-counter did not increment (proves `getReport(null)` short-circuit).
- `extension/background.gallery.test.mjs` — `deleteScreenshot_byIndex_splicesAndEmitsCount` —
  seed 3 shots, `DELETE_SCREENSHOT {index:1}`; assert remaining shots are the
  former `#0` and `#2`, return `{ok:true,count:2}`, and the captured
  `storage.session.set` tick is `{ reportCountChanged:{ port:5101, count:2, ts:<number> } }`.
- `extension/background.gallery.test.mjs` — `deleteScreenshot_lastShot_removesKey_GC` —
  seed 1 shot, delete it; assert the kv stub has **no** `report:5101` key
  (use a `has`/`delete` call-counter or assert `'report:5101' in kv === false`),
  `getReport(5101)` reads `{note:"",screenshots:[]}`, and the tick emits `count:0`.
- `extension/background.gallery.test.mjs` — `deleteScreenshot_outOfRange_noMutation` —
  seed 2 shots, `DELETE_SCREENSHOT {index:9}`; assert `{error}`, kv record
  unchanged (2 shots), **no** tick captured.
- `extension/background.gallery.test.mjs` — `deleteScreenshot_twoPortIsolation` —
  seed `report:5101` (2 shots) + `report:5102` (3 shots), active tab `:5101`,
  delete index 0; assert `report:5101` has 1 shot and `report:5102` is
  byte-for-byte unchanged (count 3).
- `extension/background.gallery.test.mjs` — `moduleLoadsClean_noStorageKey` —
  a second vm context whose `chrome` mock **omits** `storage` (mirrors frozen
  suites): assert `vm.runInContext` does not throw and the `onMessage` listener
  registers (proves the additions add no new top-level listener and the
  `emitReportCountChanged` optional-chain still no-ops).

## Dependencies

none (intra-FE). Consumes the **released** `w0-per-target-reports` seams
(`currentTargetPort`, `getReport`/`setReport`/`clearReport`, `reportKey`,
`emitReportCountChanged`) and `w0-editor-foundation`'s persisted
`screenshots[].model`/`annotated` — both shipped in prior waves, so the linkage is
prose here, not a `depends_on` id (cross-feature ids must not appear in story
`depends_on`; the feature-level edge is `feature.md depends_on:
[w0-per-target-reports, w0-editor-foundation]`).

## Cross-domain contract

- **backend-architect:** controller (`/resolve`, `/report/save`) untouched — this
  handler edits only the local IndexedDB store. (BE sentinel — peer-confirmed
  Phase 5.)
- **database-architect:** `idbDelete`/`deleteReport` are additive value/key ops on
  the existing `snapdeck`/`kv` store — **no** version bump, new store, or index.
  (DB sentinel — peer-confirmed Phase 5.)
- **devops-architect:** no `manifest.json` / permission / build change. (devops
  sentinel — peer-confirmed Phase 5.)

## History

- 2026-06-20 — created by frontend-architect (effort=2, depends on none)
