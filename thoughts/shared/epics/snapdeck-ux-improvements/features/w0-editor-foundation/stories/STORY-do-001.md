---
name: "Register editor-model.js content script in manifest"
type: story
id: STORY-do-001
domain: devops
parent_epic: snapdeck-ux-improvements
parent_feature: w0-editor-foundation
assignee: devops-engineer
author_architect: devops-architect
status: approved
created_at: 2026-06-19T03:30:00Z
last_run_id: run-20260619-021434-24507
defects: []
sentinel: false
effort: 1
diff_estimate: mechanical
files_modified:
  - extension/manifest.json
files_not_modified:
  - extension/content/editor.js
  - extension/content/editor-model.js
  - extension/content/capture.js
  - extension/content/bridge.js
  - extension/background.js
  - extension/lib/konva.min.js
reuse_patterns:
  - "extension/manifest.json:32 — content_scripts[1].js load-order array (lib/konva.min.js, bridge.js, editor.js); extend in place, don't restructure"
  - "extension/manifest.json:23-36 — content_scripts block shape (matches / run_at / css) to keep consistent"
depends_on: [STORY-fe-005]
---

# STORY-do-001 — Register `content/editor-model.js` as a content script

## What we're doing

The HYBRID test ruling moves the editor's pure serialize/project/deserialize logic out of
the side-effect-bearing `content/editor.js` IIFE into a new, side-effect-free module
`content/editor-model.js` (created by **STORY-fe-005**) so `node --test` can import it
headlessly. At runtime, `editor.js` consumes that logic through a shared isolated-world
global (`globalThis.__snapdeckEditorModel`) that `editor-model.js` sets on load. For that
global to be live before `editor.js` runs, the new file must be registered in the manifest's
existing content-script entry, **ordered before `content/editor.js`**. This story is that one
manifest registration — nothing else.

## What it should look like

In `extension/manifest.json`, the **second** `content_scripts` entry (the `document_idle`,
isolated-world one — NOT the MAIN-world `capture.js` entry) gains `"content/editor-model.js"`
in its `js` array, inserted immediately **before** `"content/editor.js"`:

```json
{
  "matches": ["http://localhost/*", "http://127.0.0.1/*"],
  "js": [
    "lib/konva.min.js",
    "content/bridge.js",
    "content/editor-model.js",
    "content/editor.js"
  ],
  "css": ["content/overlay.css"],
  "run_at": "document_idle"
}
```

Constraints:
- **Same entry, same `matches`/`run_at`/`world`** as `editor.js` — do not add a new
  `content_scripts` entry, do not change the entry's match pattern or timing.
- **Order is load-bearing, not cosmetic.** Content scripts in one entry execute in array
  order within the **same isolated world**, so the `globalThis.__snapdeckEditorModel` global
  that `editor-model.js` sets is visible to `editor.js` only if it runs first. Place it after
  `bridge.js` and before `editor.js`.
- **No other manifest change**: no new permission, no new `host_permissions`, no
  `web_accessible_resources`, no `commands` block. Konva is already vendored and listed
  (verified `lib/konva.min.js` ships the full Transformer, so no re-vendor).

## How we're doing it

- Touch only `extension/manifest.json`. The new file itself is authored by **STORY-fe-005**
  (FE domain) — do **not** create or edit `content/editor-model.js` or `content/editor.js`
  here.
- This is an unpacked MV3 extension with **no build system and no bundler**, so there is no
  build target to update and no manifest is generated — the hand-edited `manifest.json` is the
  shipping artifact.
- Validate the manifest the way this project's no-build stack allows (there is no CI pipeline
  and no schema-lint step in-repo — confirmed: the only workflow YAMLs live under `.claude/`,
  which is framework infra, not the project CI surface):
  - `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"`
    must exit 0 (well-formed JSON after the edit).
  - Every path in each `content_scripts[].js` array must exist on disk — in particular
    `extension/content/editor-model.js` must be present (this is why the story
    `depends_on: STORY-fe-005`; registering a path to a missing file makes Chrome log
    "Could not load javascript 'content/editor-model.js' for content script" on load).

## How we validate

- [ ] **Manifest loads clean:** load the unpacked extension at `chrome://extensions`; the editor
      content script injects on a `http://localhost/*` page with **no** "Could not load
      javascript …" error in the extension's console.
- [ ] **Global ordering holds:** on a captured localhost page, `globalThis.__snapdeckEditorModel`
      is defined by the time `editor.js`'s `ANNOTATE` handler runs (FE's fe-003/fe-004 exercise
      this; this story only guarantees the load-order that makes it possible).
- [ ] **No scope creep:** `git diff extension/manifest.json` shows exactly one added array element
      (`"content/editor-model.js"`) in the second `content_scripts` entry and nothing else — no
      permission/host/command delta. (devops-validator auto-rejects any unrelated manifest change.)
- [ ] **JSON valid + path exists:** `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"`
      exits 0, and `extension/content/editor-model.js` resolves on disk, ordered **before**
      `content/editor.js` in the `document_idle` entry.

## Unit tests

For a no-build manifest change, the headless test is JSON validity + path existence:

```bash
# manifest parses as valid JSON
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"

# every registered content-script path exists, and editor-model precedes editor
node --test  # (or a small assert script)
```

Assertion shape (mockable with `fs`): read `manifest.json`, find the `document_idle`
content-script entry, assert `js` contains `content/editor-model.js`, assert its index is
**less than** the index of `content/editor.js`, and assert each `js` path resolves to an
existing file under `extension/`. No network, no browser — pure file I/O, fits the HYBRID
`node --test` lane.

## Observability / API surface

- **No observability story owed.** Snapdeck has no logging/metrics/tracing stack to extend;
  a content-script registration emits no runtime telemetry. The behavioral round-trip it
  enables is covered by the PO E2E specs in `feature.md` and FE's `node --test` module suite.
- **No API-spec/doc update owed.** This changes no HTTP surface; the lossy `annotations`
  projection and `/report/save` payload remain byte-frozen, and the `model` rides the internal
  editor→background resolve message channel.

## Dependencies

- `STORY-fe-005` — authors `content/editor-model.js` (the pure, node-importable module that
  sets `globalThis.__snapdeckEditorModel`). The manifest entry must point at an existing file,
  so this registration depends on that file landing first. FE's runtime-consumer stories
  (`STORY-fe-003` finish()-serialize, `STORY-fe-004` hydration) in turn `depends_on`
  `STORY-do-001` because they need the global live at runtime — yielding the clean chain
  `fe-005 → do-001 → fe-003/fe-004` (no cycle; fe-005's own node tests import the file from
  disk and do not depend on the manifest).

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified the load-order contract: `editor-model.js` must be
  registered in the **`document_idle` isolated-world** entry, immediately **before** `editor.js`, so
  `globalThis.__snapdeckEditorModel` is live when fe-003/fe-004 run. Confirmed `depends_on: [STORY-fe-005]`
  is correct (the registered path must exist on disk first) and the chain `fe-005 → do-001 → fe-003/fe-004`
  is acyclic. **Frontmatter conformance fixes** (no behavior change): added the required `domain: devops`
  field (drives devops-validator selection), renamed `epic`/`feature` → `parent_epic`/`parent_feature` to
  match the story schema + siblings, added `created_at`/`last_run_id`/`defects: []`. **Converted "How we
  validate" prose bullets to a `- [ ]` checklist** and added an explicit JSON-valid + path-exists +
  load-order check item. **Promoted `pending → approved`.**

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **INFO**

**INFO — clean, no expanded attack surface (EoP review).** Verified against the actual
`extension/manifest.json`: the new `content/editor-model.js` is added to the **second**
`content_scripts` entry — the `document_idle`, **isolated-world** one (default world; NOT the MAIN-world
`capture.js` entry). Consequences that keep the surface flat:
- The `__snapdeckEditorModel` global is set on the **isolated-world** `globalThis`, so it is **not
  reachable from page JS** (the page's `window` is a separate world). A malicious `http://localhost`
  page can neither read nor overwrite the model transforms. *Confirmed: the entry has no `"world":
  "MAIN"`, unlike the `capture.js` entry.*
- The `matches` stay exactly `http://localhost/*` + `http://127.0.0.1/*` — the **localhost-only guard is
  not weakened**. No new host, no `<all_urls>`, no `https`.
- **No new permission, no `host_permissions` delta, no `web_accessible_resources`, no
  `externally_connectable`, no `commands` change** — the story's own "No scope creep" check
  (`git diff` shows exactly one added array element) already locks this; devops-validator auto-rejects
  any unrelated manifest change. This also avoids Chrome's auto-update permission-disable that a
  permission widening would trigger.

**Recommendation:** none beyond what's already specified. Keep the "exactly one added array element"
diff assertion as the gate. Spoofing/Tampering/Repudiation/DoS: N/A for a load-order manifest edit.

**PO disposition:** ACCEPT_AS_RECOMMENDATION. No action — the isolated-world placement, unchanged
`localhost`/`127.0.0.1` matches, and zero permission/host/`web_accessible_resources`/`externally_connectable`
delta are already locked by the story's existing "exactly one added array element" diff gate (devops-validator
auto-rejects any unrelated manifest change). No new AC, no STORY-sec.
