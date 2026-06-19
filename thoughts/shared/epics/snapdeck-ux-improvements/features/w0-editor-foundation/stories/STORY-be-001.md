---
type: story
id: STORY-be-001
name: "Persist lossless editor model on screenshot record"
domain: backend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
depends_on: [STORY-fe-003]
diff_estimate: substantive
files_modified: [extension/background.js, extension/background.editormodel.test.mjs]
files_not_modified: [extension/content/editor.js, extension/content/capture.js, extension/popup/popup.js, extension/manifest.json, extension/background.test.mjs, controller/snapdeck_controller/reports.py]
reuse_patterns:
  - "extension/background.js:129-139 — addScreenshot() per-screenshot push-object literal (the record shape to extend, in place)"
  - "extension/background.js:26-37 — idbSet()/setReport() structured-clone .put(val,key) data-access path the record flows through unchanged"
  - "extension/background.js:159-163 — saveReport() upstream /report/save field whitelist (the FROZEN projection; model must NOT appear here)"
  - ".claude/scripts/__tests__/channel-size-warn.test.js:16-29 — repo's node:test + node:assert/strict idiom to mirror"
  - "extension/background.js:81-84 — chrome.runtime.onMessage.addListener registration: the test-seam to capture (drive addScreenshot/saveReport through this listener, as Chrome does)"
created_at: 2026-06-19T03:05:00Z
last_run_id: run-20260619-021434-24507
defects: []
---

# Story: Persist lossless editor model on screenshot record

## What we're doing

The in-page editor (`editor.js`, STORY-fe-003) will emit a new **additive `model` field** on the
editor→background `ANNOTATE` resolve payload — a lossless representation of every annotation. This
story stores that `model` **verbatim** on the per-screenshot sub-record in the local in-progress
report store, so a captured screenshot can later round-trip back into the editor with no
geometry/content loss (the read side is STORY-fe-004). The change is strictly additive and opaque:
one new property on the object literal that `addScreenshot()` already pushes. The lossy `annotations`
projection and the upstream `/report/save` payload are **untouched** — the downstream
report→defects consumer sees an identical bytestream.

## What it should look like

This is an MV3 service-worker **message contract**, not an HTTP endpoint. The relevant "operation"
is the `ADD_SCREENSHOT` runtime message → `addScreenshot()` handler.

**Auth requirement (stated explicitly):** there is **no HTTP auth scheme** on this path — it is
internal `chrome.runtime` extension messaging (same-extension origin enforced by Chrome). The
existing `localhost`/`127.0.0.1` URL guard at `background.js:112` is **unchanged**, and the upstream
controller is **loopback-only (`127.0.0.1`) with no auth scheme by design** (binds `127.0.0.1`,
per backend-architect lessons). This story neither adds nor relaxes any guard.

**Input — the resolve payload (`resp`)** returned by `chrome.tabs.sendMessage(tab.id, {type:"ANNOTATE", ...})`.
After STORY-fe-003 it carries a new top-level sibling `model` (alongside the unchanged
`original`/`annotated`/`annotations`/`meta`/`console`/`network`). Agreed wire shape (FE owns the
internal schema; BE treats it as **opaque**):

```js
model: {
  version: 1,
  items: [
    { id, type: "arrow", x1, y1, x2, y2 },   // existing arrow geometry, now persisted
    { id, type: "box",   x, y, width, height }, // foundation box primitive
    { id, type: "text",  x, y, text }          // existing point-anchored text, carried
  ]
}
```

Guaranteed present on every non-cancelled resolve from the w0 editor (empty editor → `{version:1, items:[]}`).
Plain JSON-serializable — no class instances, functions, or Konva nodes — so it survives IndexedDB
structured-clone untouched.

**Stored per-screenshot record** (the only change is the final line):

```js
r.screenshots.push({
  url: resp.meta.url,
  title: resp.meta.title,
  captured_at: resp.meta.captured_at,
  viewport: resp.meta.viewport,
  original: resp.original,
  annotated: resp.annotated,
  annotations: resp.annotations || [],
  console: resp.console || [],
  network: resp.network || [],
  model: resp.model ?? null,   // NEW — lossless, opaque, verbatim
});
```

`resp.model ?? null` is a **forward-compat defensive default**: it substitutes an explicit `null`
only when the *entire* `model` field is absent (an older content script predating FE-003). It never
inspects, enumerates, or whitelists any internal item/subtype field — `null` over `undefined` for
structured-clone round-trip stability. Against the w0 build this branch never fires (FE-003
guarantees presence).

**Upstream `/report/save` payload — UNCHANGED.** `saveReport()` (`background.js:144-173`) maps each
record through an explicit field whitelist that does **not** include `model`; it stays exactly as-is:

```js
screenshots: r.screenshots.map((s) => ({
  url: s.url, title: s.title, captured_at: s.captured_at, viewport: s.viewport,
  original_png_b64: s.original, annotated_png_b64: s.annotated,
  annotations: s.annotations, console: s.console, network_failures: s.network,
}))
// NO model key — downstream report→defects projection stays frozen.
```

## Existing behavior baseline

- **Currently:** `extension/background.js:128-140` — `addScreenshot()` builds the per-screenshot
  record from the resolve payload and pushes it onto `r.screenshots`; today's fields are
  `url/title/captured_at/viewport/original/annotated/annotations/console/network`.
- **Currently:** `extension/background.js:156-164` — `saveReport()` maps each stored record into the
  upstream `/report/save` payload via an explicit field whitelist; `model` is absent and must stay
  absent.
- **Dispatch path / call graph:** `editor.js` (content script, FE-003) →
  `chrome.tabs.sendMessage({type:"ANNOTATE"})` resolve `resp` (`background.js:123`) →
  `addScreenshot()` (`background.js:110`) → `getReport()` → push record → `setReport()` →
  `idbSet("report", r)` structured-clone `.put` (`background.js:26-37`) → [later, on user save]
  `SAVE_REPORT` → `saveReport()` → `POST /report/save`.
- **No-regression assertion:** the upstream `/report/save` payload (saveReport whitelist, lines
  159-163) is **byte-for-byte unchanged** for the same annotations; the existing 9 record fields keep
  identical values and shape; `addScreenshot()` and `saveReport()` stay **zero-arg** (resolve the
  active tab internally — no port param).
- **Explicitly changing:** add a single `model` property to the `addScreenshot()` push-object literal
  (`background.js:129-139`). Nothing else.
- **Verified:** 2026-06-19 — opened `extension/background.js` and cited `addScreenshot()` (110-142)
  and `saveReport()` (144-173) from the file, not from memory.

## How we're doing it

1. In `extension/background.js`, in the `r.screenshots.push({...})` object literal inside
   `addScreenshot()` (lines 129-139), add one property: `model: resp.model ?? null`. Store the object
   **opaquely** — do NOT iterate, enumerate, validate, or whitelist its contents (w1/w2 add box
   subtype fields later and must persist with zero backend change).
2. **Do NOT touch `saveReport()`** (lines 144-173) — the upstream payload whitelist stays frozen so
   `model` never reaches `/report/save`.
3. **Do NOT** add a `db.version` bump, object store, or migration — adding a field to a
   structured-clone *value* does not alter the `kv` store definition (`onupgradeneeded` stays at v1).
   Confirmed with database-architect (sentinel STORY-db-001; no DB-domain work).
4. **Merge-compat with w0-per-target-reports (same wave — fixed external context, do NOT
   renegotiate):** that feature re-keys the report store from key `"report"` → `report:<browserPort>`
   in the SAME IndexedDB store (`snapdeck`/`kv`) and carries the whole report object (incl.
   `screenshots[].model`) via structured-clone with **no field whitelist**. Their edit touches
   `getReport`/`setReport` (lines 34-37); **my edit touches the push-object literal in
   `addScreenshot()` (lines 129-139)** — an **orthogonal region**. Both functions stay zero-arg.
   **Storage-owner (w0-per-target-reports) lands first; this story rebases on top.** Because
   `addScreenshot()` writes through `getReport()`/`setReport()`, the re-key is transparent to this
   change — `model` rides inside `screenshots[]` and survives the re-key untouched.

## How we validate it was done correctly

- [ ] After `addScreenshot()` with a resolve payload carrying `model`, the stored record's
      `screenshots[last].model` deep-equals the resolve payload's `model` **verbatim** (same
      `version`, every item, every field) — no enumeration/whitelisting.
- [ ] When the resolve payload omits `model` entirely, the stored record's `model` is exactly `null`
      (not `undefined`, not absent).
- [ ] The 9 pre-existing record fields
      (`url/title/captured_at/viewport/original/annotated/annotations/console/network`) are unchanged
      in name, value, and shape.
- [ ] The `/report/save` payload produced by `saveReport()` contains **no** `model` key on any
      screenshot and is byte-identical to pre-feature output for the same annotations (the whitelist
      at lines 159-163 is untouched).
- [ ] `addScreenshot()` and `saveReport()` remain zero-arg; no `db.version` bump / migration /
      new object store was introduced.

## Motion contract

n/a — service-worker storage change, no UI.

## Unit tests

Runner: **`node --test extension/`** (BOSS hybrid ruling — zero-dep Node built-in `node:test` +
`node:assert/strict`, ESM `*.test.mjs`, exactly as `.claude/scripts/__tests__/channel-size-warn.test.js`
and w0-keyboard-shortcuts' `STORY-be-001` establish; no `package.json`, no jest/vitest). The E2E lane
(browser-tester, real SW + IndexedDB) stays in addition to this unit lane. unit-tester Phase 5a runs
`node --test extension/`.

**Test file: `extension/background.editormodel.test.mjs`** — a **distinct** file, NOT
`extension/background.test.mjs`. That latter file is created/owned by the same-wave
w0-keyboard-shortcuts `STORY-be-001` (status: approved), which also edits `extension/background.js`.
Using a separate `*.test.mjs` avoids a new-file merge collision; `node --test extension/` discovers
both. Each `*.test.mjs` runs in its own process with a fresh `globalThis` + module cache, so the two
files' stubs don't interfere. Mirror the keyboard-shortcuts file's harness shape (hand-written stubs;
capture the registered listener).

Because `background.js` is a non-exporting **classic** MV3 service-worker script, it loads cleanly as
CommonJS via `await import(...)` from the ESM test; drive the real functions through the
**`chrome.runtime.onMessage` listener seam** rather than refactoring exports:

1. Before importing, install hand-rolled stubs on `globalThis`: `chrome` (with
   `runtime.onMessage.addListener` capturing the registered callback into a test-held variable;
   `tabs.query`/`tabs.captureVisibleTab`/`tabs.sendMessage`), an in-memory `indexedDB` fake, `fetch`,
   `setTimeout`/`clearTimeout`, `AbortController`, and `URL`.
2. `await import('../extension/background.js')` — its top-level
   `chrome.runtime.onMessage.addListener(...)` (`background.js:81-84`) runs against the stub and is
   captured. (MV3 listeners are top-level by design, so the import re-binds them.)
3. Per test, reset the in-memory idb backing store and reconfigure the `chrome`/`fetch` stubs, then
   invoke the captured listener with `{type:"ADD_SCREENSHOT"}` / `{type:"SAVE_REPORT"}` and a
   `sendResponse` wrapped in a promise — exactly as Chrome dispatches. Assert on the idb stub's stored
   record and the resolved response.

This exercises the **real** `addScreenshot()`/`saveReport()` with **zero production refactor** (no
exports added, no `node:vm`, the frozen `saveReport` mapping untouched, the SW stays a classic
script). The fake IndexedDB is a small in-memory hand-written stub kept **inside the test file** (per
testing-conventions §"hand-written stub classes for infrastructure interfaces") — engineer-authored
unit-test code, NOT test-runner config or a new project skeleton, so it is not devops-domain infra
setup. Do NOT add `export`/`import`/`"type":"module"` to `background.js` (whole-file strict-mode/
scoping regression risk — see backend-architect lessons).

- `extension/background.editormodel.test.mjs` — `addScreenshot_storesModelVerbatim_onScreenshotRecord` —
  arrange a localhost active tab + a resolve payload whose `model` is
  `{version:1, items:[{id:'a',type:'arrow',x1:1,y1:2,x2:3,y2:4},{id:'b',type:'box',x:5,y:6,width:7,height:8}]}`;
  dispatch `{type:"ADD_SCREENSHOT"}` through the captured listener; assert the stored record's
  `screenshots[0].model` `deepStrictEqual`s that object exactly (lossless, opaque).
- `extension/background.editormodel.test.mjs` — `addScreenshot_defaultsModelToNull_whenResolveOmitsModel` —
  resolve payload has no `model` property; assert `screenshots[0].model === null` (strictEqual), not
  `undefined`.
- `extension/background.editormodel.test.mjs` — `addScreenshot_preservesExistingNineFields_whenAddingModel` —
  assert the 9 pre-existing fields are present with the resolve payload's values (no-regression on the
  record shape).
- `extension/background.editormodel.test.mjs` — `saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel` —
  seed a report whose screenshot carries a `model`; stub `fetch` so `/resolve` returns `{ok:true}`
  (controller discovery) and capture the `POST /report/save` body; assert the parsed body's
  `screenshots[0]` has **no** `model` key, and that its key set is **exactly** the 9 frozen projection
  fields `["url","title","captured_at","viewport","original_png_b64","annotated_png_b64","annotations","console","network_failures"]`
  (assert `Object.keys(screenshots[0]).sort()` deep-equals that sorted list — locks the
  byte-frozen-upstream invariant at the storage layer).
- `extension/background.editormodel.test.mjs` — `saveReport_upstreamPayloadByteIdentical_forSameAnnotations` —
  build a record, capture the serialized POST body, and assert it equals the pre-feature expected
  payload object (regression guard proving the projection bytes did not drift).

## Dependencies

- **STORY-fe-003** — "Lossless `model` serialization on the resolve payload." Produces the `resp.model`
  field this story consumes; the field does not exist until FE-003 ships. (Correct producer→consumer
  direction: FE-003 produces, BE-001 stores, FE-004 reads back.)
- No database dependency — the `snapdeck`/`kv` store already exists; this is a value-shape change only
  (database-architect confirmed; sentinel STORY-db-001).
- No DevOps dependency — loopback-only extension, no env vars / connection strings / feature flags.

## Cross-domain contract

Established via SendMessage rounds with `frontend-architect` and `database-architect` (2026-06-19):

- **Wire shape (FE→BE):** `model` is a top-level sibling of `annotations` on the `ANNOTATE` resolve
  payload, shape `{ version: 1, items: [...] }`, plain JSON-serializable, **always present** on a
  non-cancelled w0-editor resolve. BE stores it **verbatim/opaque** at `screenshots[].model` — no
  field whitelist — so w1 (text-box) and w2 (rectangle) subtype fields persist with zero backend
  change. BE adds `?? null` only as a forward-compat default for the whole-field-absent case.
- **Read side:** STORY-fe-004 (hydration) `depends_on: [STORY-be-001, STORY-fe-001, STORY-fe-003]`.
- **Frozen projection:** `model` is NOT added to the `/report/save` payload; the saveReport whitelist
  (`background.js:159-163`) stays byte-frozen — downstream report→defects projection unchanged.
- **No DB work:** structured-clone value-shape change only; no `db.version` bump, store, index, or
  migration (database-architect; sentinel STORY-db-001).
- **Merge order vs w0-per-target-reports (external locked contract):** orthogonal regions of
  `background.js`; storage-owner re-keys `getReport`/`setReport` and lands first; BE-001 rebases on
  top. `model` survives the re-key transparently (whole `screenshots[]` carried as-is).
- **Shared-file coordination vs w0-keyboard-shortcuts (same wave):** that feature's `STORY-be-001`
  (approved) also edits `extension/background.js` (adds a top-level `chrome.commands.onCommand`
  listener — an orthogonal region from my push-literal edit at lines 129-139) and creates
  `extension/background.test.mjs`. To avoid a new-file collision, this story's tests live in a
  **distinct** file `extension/background.editormodel.test.mjs`; `node --test extension/` runs both. The
  three same-wave editors of `background.js` (keyboard-shortcuts `onCommand`, per-target-reports
  `getReport`/`setReport` re-key, my `addScreenshot()` push literal) are non-overlapping line regions;
  BOSS sequences the merge window at push time.

## History

- 2026-06-19 — created by backend-architect (effort=1, depends_on [STORY-fe-003]); wire shape +
  opacity + frozen-projection + merge-compat confirmed with frontend-architect and database-architect
  via SendMessage.
- 2026-06-19 — backend-architect: applied BOSS HYBRID test ruling — adopted zero-dep
  `node --test` `*.test.mjs` unit lane (file `extension/background.editormodel.test.mjs`, distinct from
  w0-keyboard-shortcuts' `background.test.mjs` to avoid collision) covering `model`-persisted-verbatim
  + `model`-absent-from-`/report/save`; browser-tester E2E lane retained. No contract change.
- 2026-06-19 — backend-architect: unit-test filename LOCKED (BOSS-registered to the cohort) as
  `extension/background.editormodel.test.mjs`. Final cohort test-file names: `background.test.mjs`
  (keyboard-shortcuts) / `background.reports.test.mjs` (per-target-reports) /
  `background.editormodel.test.mjs` (this story) — all distinct, `node --test extension/` discovers
  all three.

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified the **consumer** side of the FE→BE wire matches the
  producer (STORY-fe-003) exactly: stores `resp.model ?? null` **verbatim/opaque** at `screenshots[].model`
  with no field whitelist (so w1/w2 subtype fields survive with zero backend change), and the `/report/save`
  whitelist stays byte-frozen — the `saveReport` test locks this with an exact 9-field key-set assertion.
  Confirmed `depends_on: [STORY-fe-003]` is the correct producer→consumer direction. Confirmed the
  orthogonal-region merge story on the shared `extension/background.js` (per-target-reports re-keys
  `getReport`/`setReport`; keyboard-shortcuts adds `onCommand`; this story edits the `addScreenshot()` push
  literal) and the distinct `*.test.mjs` filename — no collision. No story-content change. **Promoted
  `pending → approved`.**

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **INFO**

**INFO — Information disclosure: the upstream exclusion is the right call and is well-locked.** The
load-bearing security property of this story is that the new lossless `model` stays **local only** — it
is stored at `screenshots[].model` in the extension's own IndexedDB but is **excluded from the
`/report/save` upstream payload** (the `saveReport()` whitelist at `background.js:159-163` is untouched).
This is enforced two ways and tested:
- `saveReport_omitsModelFromUpstreamPayload_*` asserts the upstream `screenshots[0]` key set is
  **exactly** the 9 frozen projection fields — a strong, exact-match lock, not just a "no `model`" check.
- STORY-fe-003 cross-checks the same byte-freeze on the producer side.
No **new class** of data is shipped or even newly persisted: `text` content was already stored locally
in `annotations` (`{x,y,text}`); the `model` carries the same text plus arrow/box geometry, still
local. Net effect is privacy-neutral-to-positive (nothing additional leaves the machine).

**INFO — Tampering/EoP: storage path and guards unchanged.** Stored **verbatim/opaque** via the existing
structured-clone `setReport()` path with no field whitelist (correct — w1/w2 subtype fields must
survive). `resp.model ?? null` is a sound forward-compat default. The story adds/relaxes **no** guard:
the `localhost`/`127.0.0.1` URL guard at `background.js:112` is untouched and the loopback-only
(`127.0.0.1`, no-auth-by-design) controller is unchanged. `addScreenshot()`/`saveReport()` stay
zero-arg.

**INFO — DoS (accept-risk, no action): unbounded opaque value.** Because `model` is stored opaquely with
no size/item-count bound and `unlimitedStorage` is granted, a pathological model could grow the local
record. Item count is **human-bounded** in w0 (annotations are hand-drawn), and this is a single-user
local tool, so this is an accept-risk INFO — **no STORY-sec warranted** (consistent with the per-key
IndexedDB growth disposition in prior reviews). If w2-screenshot-gallery later imports models from an
external source, revisit a bound then.

**Spoofing / Repudiation: N/A.** `ADD_SCREENSHOT` is same-extension `chrome.runtime` messaging (no
`externally_connectable`; not web-reachable); no audit-trail surface exists on this client-side ephemeral
store (no entity table → the audit-columns checklist item does not apply here).
