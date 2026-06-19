---
name: "Register editor-chrome.js content script in manifest"
type: story
id: STORY-do-001
domain: devops
parent_epic: snapdeck-ux-improvements
parent_feature: w1-draggable-toolbar-toggle
assignee: devops-engineer
author_architect: devops-architect
status: validated
created_at: 2026-06-19T15:40:00Z
last_run_id: run-20260619-042600-10898
defects: []
sentinel: false
greenfield: false
effort: 1
diff_estimate: mechanical
files_modified:
  - extension/manifest.json
files_not_modified:
  - extension/content/editor.js
  - extension/content/editor-chrome.js
  - extension/content/editor-model.js
  - extension/content/capture.js
  - extension/content/bridge.js
  - extension/background.js
  - extension/lib/konva.min.js
reuse_patterns:
  - "extension/manifest.json:41 — content_scripts[1].js load-order array (lib/konva.min.js, bridge.js, editor-model.js, editor.js); extend in place, do NOT restructure or add a new entry"
  - "extension/manifest.json:39-44 — content_scripts[1] block shape (matches / run_at / css, isolated default world) to keep consistent"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/stories/STORY-do-001.md — released precedent: identical one-array-element registration of content/editor-model.js"
depends_on: [STORY-fe-001]
---

# STORY-do-001 — Register `content/editor-chrome.js` as a content script

## What we're doing

This feature's pure, node-testable logic (toolbar-position `clampToViewport(pos, dims)`,
serialize/deserialize/guard of the persisted toolbar position, and the annotation-visibility
state helpers) is extracted by **STORY-fe-001** into a new, side-effect-free dual-consumable
module `extension/content/editor-chrome.js` (a UMD wrapper that sets
`globalThis.__snapdeckEditorChrome` in the browser and `module.exports` under `node --test`).
At runtime, `content/editor.js` consumes that logic through the isolated-world global
`window.__snapdeckEditorChrome` — exactly mirroring how it already consumes
`window.__snapdeckEditorModel` (`editor.js:86`). For that global to be live before `editor.js`
runs, the new file must be registered in the manifest's existing `document_idle`
content-script entry, **ordered before `content/editor.js`** (and after the already-registered
`content/editor-model.js`). This story is that one manifest registration — nothing else.

This is the same shape as the released **w0 STORY-do-001**, which registered
`content/editor-model.js`. The only manifest touch is one added `js`-array element; the
`storage` permission that backs `chrome.storage.local` toolbar-position persistence is already
granted (`manifest.json:6`), so there is **no** permission, `host_permissions`, or
`web_accessible_resources` change.

## Existing behavior baseline

> Verified: 2026-06-19 — opened `extension/manifest.json` at HEAD (post-w0-release).

- **Cited config file:** `extension/manifest.json`, the **second** `content_scripts` entry
  (the `document_idle`, isolated default-world one — lines 39-44). Its current `js` array
  (line 41) is:
  ```json
  ["lib/konva.min.js", "content/bridge.js", "content/editor-model.js", "content/editor.js"]
  ```
- **Current behavior at the modification point:** on any `http://localhost/*` or
  `http://127.0.0.1/*` page, Chrome injects those four scripts in array order into one
  isolated world at `document_idle`. `editor-model.js` sets `globalThis.__snapdeckEditorModel`
  before `editor.js` reads it (`editor.js:86`). The **first** `content_scripts` entry
  (`content/capture.js`, `world: MAIN`, `run_at: document_start`, lines 33-38) is separate and
  unrelated.
- **No-regression assertion:** this story inserts **exactly one** array element
  (`"content/editor-chrome.js"`) into the existing `document_idle` entry's `js` array,
  immediately before `"content/editor.js"`. It does **not** change the entry's `matches`,
  `run_at`, `css`, or world; does **not** add or remove any other entry; does **not** touch the
  MAIN-world `capture.js` entry; and adds **no** permission / `host_permissions` /
  `web_accessible_resources` / `commands` / `externally_connectable`. Existing injection order
  and the `__snapdeckEditorModel` round-trip are unchanged.

## What it should look like

In `extension/manifest.json`, the **second** `content_scripts` entry (the `document_idle`,
isolated-world one — NOT the MAIN-world `capture.js` entry) gains `"content/editor-chrome.js"`
in its `js` array, inserted immediately **before** `"content/editor.js"` and **after**
`"content/editor-model.js"`:

```json
{
  "matches": ["http://localhost/*", "http://127.0.0.1/*"],
  "js": [
    "lib/konva.min.js",
    "content/bridge.js",
    "content/editor-model.js",
    "content/editor-chrome.js",
    "content/editor.js"
  ],
  "css": ["content/overlay.css"],
  "run_at": "document_idle"
}
```

Constraints:
- **Same entry, same `matches`/`run_at`/world** as `editor.js` — do not add a new
  `content_scripts` entry, do not change the entry's match pattern or timing.
- **Order is load-bearing, not cosmetic.** Content scripts in one entry execute in array order
  within the **same isolated world**, so the `globalThis.__snapdeckEditorChrome` global that
  `editor-chrome.js` sets is visible to `editor.js` only if it runs first. Place it after
  `editor-model.js` and before `editor.js`.
- **No other manifest change**: no new permission, no new `host_permissions`, no
  `web_accessible_resources`, no `commands` block, no `externally_connectable`. Konva is already
  vendored and listed; `storage` (for `chrome.storage.local`) is already granted.

## How we're doing it

- Touch only `extension/manifest.json`. The new file itself is authored by **STORY-fe-001**
  (FE domain) — do **not** create or edit `content/editor-chrome.js`, `content/editor.js`, or
  `content/editor-model.js` here.
- This is an unpacked MV3 extension with **no build system and no bundler**, so there is no
  build target to update and no manifest is generated — the hand-edited `manifest.json` is the
  shipping artifact.
- Validate the manifest the way this project's no-build stack allows (there is **no** project
  CI pipeline and **no** schema-lint step in-repo — confirmed: the only workflow YAMLs live
  under `.claude/`, which is framework infra, not the project CI surface):
  - `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"`
    must exit 0 (well-formed JSON after the edit).
  - Every path in each `content_scripts[].js` array must exist on disk — in particular
    `extension/content/editor-chrome.js` must be present (this is why this story
    `depends_on: STORY-fe-001`; registering a path to a missing file makes Chrome log
    "Could not load javascript 'content/editor-chrome.js' for content script" on load).

## How we validate

- [ ] **Manifest loads clean:** load the unpacked extension at `chrome://extensions`; the editor
      content scripts inject on a `http://localhost/*` page with **no** "Could not load
      javascript …" error in the extension's console.
- [ ] **Global ordering holds:** on a captured localhost page, `globalThis.__snapdeckEditorChrome`
      is defined by the time `editor.js` first reads it (FE's consumer stories exercise this;
      this story only guarantees the load-order that makes it possible).
- [ ] **No scope creep:** `git diff extension/manifest.json` shows **exactly one** added array
      element (`"content/editor-chrome.js"`) in the second `content_scripts` entry and nothing
      else — no permission/host/command/world delta. (devops-validator auto-rejects any unrelated
      manifest change.)
- [ ] **JSON valid + path exists + order correct:**
      `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"` exits 0,
      `extension/content/editor-chrome.js` resolves on disk, and its index in the `document_idle`
      `js` array is **greater than** `content/editor-model.js` and **less than**
      `content/editor.js`.

## Unit tests

For a no-build manifest change, the headless test is JSON validity + path existence + load-order
(pure `fs` I/O, fits the `node --test` lane this feature already ships):

```bash
# manifest parses as valid JSON
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"

# every registered content-script path exists; editor-chrome precedes editor and follows editor-model
node --test extension/*.test.mjs
```

Assertion shape (mockable with `fs`): read `manifest.json`, find the `document_idle`
content-script entry, assert its `js` contains `content/editor-chrome.js`, assert
`index(editor-model) < index(editor-chrome) < index(editor)`, and assert each `js` path resolves
to an existing file under `extension/`. No network, no browser — pure file I/O.

> **Ownership (resolved at arbitration — see Revisions / contrarian Finding 1):** this
> manifest load-order + path-exists assertion is **owned by and lives in STORY-fe-001's
> `extension/editor.chrome.test.mjs`** (FE owns that test file). This story does **NOT**
> author or edit that file — the devops-engineer **references** the guard by running
> `node --test extension/*.test.mjs` as the validate step below. This keeps the
> manifest edit (`extension/manifest.json`, the only `files_modified` entry) free of any
> undeclared cross-domain FE-test edit the devops-validator would reject.

## Observability / API surface

- **No separate observability story is owed.** Snapdeck has no logging/metrics/tracing stack to
  extend, and a content-script registration emits no runtime telemetry of its own. The behavioral
  round-trip this registration enables (drag/persist + visibility toggle) is covered by the PO
  E2E specs in `feature.md` and the feature's `node --test` module suite. (This is the same
  disposition as released w0 STORY-do-001 — stated explicitly, not skipped: there is simply no
  telemetry surface in this project to instrument.)
- **No API-spec / doc update owed.** This changes no HTTP surface. The lossy `annotations`
  projection and `/report/save` payload remain frozen (owned by released `w0-editor-foundation`);
  toolbar position rides `chrome.storage.local`, not any wire contract.

## Dependencies

- `STORY-fe-001` — authors `extension/content/editor-chrome.js` (the pure, node-importable
  dual-consumable module that sets `globalThis.__snapdeckEditorChrome`). The manifest entry must
  point at an existing file, so this registration depends on that file landing first. FE's
  runtime-consumer stories (toolbar drag/persistence + visibility toggle, which read
  `window.__snapdeckEditorChrome` inside `editor.js`) in turn `depends_on` **STORY-do-001**
  because they need the global live at runtime — yielding the clean acyclic chain
  `fe-001 → do-001 → fe-consumers` (fe-001's own node tests import the file from disk and do not
  depend on the manifest). This mirrors w0's `fe-005 → do-001 → fe-003/fe-004`.

## Cross-domain contract

- **Contract:** register `extension/content/editor-chrome.js` in `manifest.json`
  `content_scripts[1].js` (the `document_idle` isolated-world entry), ordered
  `editor-model.js` → `editor-chrome.js` → `editor.js`. Runtime global:
  `window.__snapdeckEditorChrome`.
- **Confirmed with frontend-architect** (this run; mirrored to
  `thoughts/shared/epics/snapdeck-ux-improvements/conversations/`): FE introduces the new file
  under **STORY-fe-001**, proposed the exact js array above, and consumes it via
  `window.__snapdeckEditorChrome` (parallel to `__snapdeckEditorModel` at `editor.js:86`). FE
  will set their two editor.js consumer stories' `depends_on` to **STORY-do-001**. The `storage`
  permission is already present, so `chrome.storage.local` persistence needs no manifest change.

## Contrarian Findings

### Finding 1 — The manifest load-order regression guard has no clear owner and may be silently dropped

**Severity:** concern
**Mechanism:** This story twice calls the load order "load-bearing, not cosmetic"
and its `## Unit tests` section commits to a `node --test` assertion of
`index(editor-model) < index(editor-chrome) < index(editor)` — but it places that
assertion **inside the FE-owned `extension/editor.chrome.test.mjs`** ("this story
contributes the manifest-shape assertions to it"), while this story's frontmatter
`files_modified` lists **only `extension/manifest.json`** (the test file is not
declared). Cross-checking the producer: STORY-fe-001's test spec enumerates nine
cases (clamp / serialize / parse / visibility) and **none** assert manifest order.
So the ordering guard is owned by neither file as written. Two concrete failure
modes at implement time: (a) the devops-engineer edits `editor.chrome.test.mjs` to
add it — an **undeclared cross-domain file edit** the devops-validator may reject (it
"auto-rejects any unrelated manifest change" and an FE-test edit is outside this
story's declared surface); or (b) everyone assumes the other story owns it and the
assertion is **never written** — leaving no automated guard. The latter is the real
risk: a future content-script reorder (or a dropped `editor-chrome.js` entry) would
make `window.__snapdeckEditorChrome` `undefined`, and since fe-002/fe-003 consume it
at `openEditor()`-time, the **editor's drag + toggle handlers throw at runtime with
no test catching the regression**. The feature ships fine *today* either way (the
runtime works once the manifest is correct); the gap is the missing regression net
on a seam the story itself flags as load-bearing.
**Recommendation:** acknowledge + assign one owner at arbitration. Cheapest fix:
add the `index(editor-model) < index(editor-chrome) < index(editor)` + path-exists
case to **STORY-fe-001's** test list (FE owns `editor.chrome.test.mjs`), and have
this story reference it rather than "contribute" to a file it doesn't declare.
Alternatively, declare `extension/editor.chrome.test.mjs` in this story's
`files_modified` so the devops-validator expects the edit. Pick one explicitly — do
not leave the guard's ownership implicit.

## Security Review

### Finding 1 — Manifest change widens no privilege; isolated-world registration adds no surface (clean)

**Severity:** info (FYI — no finding, no action)
**Threat (STRIDE: Elevation of privilege).** A manifest edit is the one place this
feature could widen the extension's attack surface, so it was checked explicitly:
- **No permission widening:** exactly one `js`-array element
  (`content/editor-chrome.js`) is inserted into the **existing** `document_idle`
  entry. No new `permissions`, `host_permissions`, `web_accessible_resources`,
  `commands`, or `externally_connectable`. `storage` (backing the toolbar-position
  persistence) is already granted (`manifest.json:6`). Per the lessons file, adding
  a permission triggers Chrome's auto-update permission-disable — this story
  correctly avoids that by reusing the already-declared surface. ✓
- **Isolated world preserved:** the target entry has no `"world"` key → injects in
  the **isolated** content-script world (verified `manifest.json:34-43`; only
  `capture.js` is `world: MAIN`). So `editor-chrome.js`'s
  `globalThis.__snapdeckEditorChrome` is **not page-reachable** — a web page cannot
  read or overwrite it. The new module is also pure/side-effect-free (fe-001), so it
  adds no runtime surface regardless. ✓
- **No host-guard change:** the localhost host-guard in `addScreenshot()`
  (`background.js`) and the `matches: http://localhost/*, http://127.0.0.1/*`
  patterns are untouched. ✓
- **Load-order guard is a robustness net, not security:** the
  `index(editor-model) < index(editor-chrome) < index(editor)` assertion (owned by
  fe-001's test) protects against a runtime `undefined` global, not an attacker.
**Recommendation:** none. Disposition: **clean — accept.** The `git diff` no-scope-creep
validate item (devops-validator auto-rejects any unrelated manifest change) is the
right guard and aligns with the security posture.

**PO disposition:** ACCEPT_AS_RECOMMENDATION — Finding 1 (INFO, clean): the manifest edit widens no privilege — exactly one `js`-array element into the existing `document_idle` (isolated-world) entry, no new `permissions`/`host_permissions`/`web_accessible_resources`/`commands`/`externally_connectable`, `storage` already granted, host-guard untouched, and `__snapdeckEditorChrome` is not page-reachable (isolated world). The `git diff` no-scope-creep validate item is the right enforcement. No action.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**CONCERN resolved (Finding 1) — guard owner = STORY-fe-001; this story references,
does not edit.** Per team-lead arbitration direction, the manifest load-order +
path-exists regression assertion is owned by and authored in **STORY-fe-001's**
`extension/editor.chrome.test.mjs` (FE owns that file). This story's only
`files_modified` stays **`extension/manifest.json`** (one added `js`-array element);
the devops-engineer **must NOT** edit the FE test file. The devops side **references**
the guard by running `node --test extension/*.test.mjs` as a validate step — so the
load-order net exists and runs, with no undeclared cross-domain edit for the
devops-validator to reject. Reconciled the `## Unit tests` wording from "this story
contributes the manifest-shape assertions to it" → "references the FE-owned guard."

**Ratified — `diff_estimate: mechanical` is correct.** One manifest `js`-array element
inserted between `editor-model.js` and `editor.js`, matching the released w0
STORY-do-001 precedent (identical one-element registration of `editor-model.js`). No
permission / `host_permissions` / `web_accessible_resources` / `commands` delta. No
change. Status `pending → approved`.

## History

2026-06-19T16:00:00Z — implemented (inserted `"content/editor-chrome.js"` into `extension/manifest.json` `content_scripts[1].js` array between `editor-model.js` and `editor.js`; JSON valid; `node --test extension/*.test.mjs` 75/75 pass including load-order guard #49)

## Engineer Notes

- **Diff:** exactly one `js`-array element added to the `document_idle` isolated-world entry. No permission, `host_permissions`, `web_accessible_resources`, `commands`, or world changes.
- **Load-order guard (#49):** previously staged/if-present (file was absent); now fires and passes — `index(editor-model) < index(editor-chrome) < index(editor)` and all four `js` paths resolve on disk.
- **Full suite:** 75/75 pass — no regressions.

## Validation

- result: validated
- devops-validator: validated — exactly one js-array element (content/editor-chrome.js) in correct order (editor-model < editor-chrome < editor); no permission/host/world/commands scope creep; manifest valid JSON; suite green.
- honesty-check-validator: passed — only manifest.json + story touched; fe-001 load-order test unmodified and now fully fires (idxModel<idxChrome<idxEditor); 77 tests/88 assertions, 0 fail.

## History

- 2026-06-19T16:27:38Z — orchestrator — validate validated (devops-validator)
- 2026-06-19T16:27:38Z — orchestrator — honesty passed (honesty-check-validator)
- 2026-06-19T16:27:38Z — orchestrator — status in-progress → validated
