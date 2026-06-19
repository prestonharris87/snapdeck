---
type: story
id: STORY-fe-005
name: "Pure model-transform module + node:test (serialize/project/deserialize)"
domain: frontend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: in-progress
depends_on: [STORY-fe-001]
created_at: 2026-06-19T03:55:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
files_modified:
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
files_not_modified:
  - extension/content/editor.js
  - extension/background.js
  - extension/manifest.json
  - extension/content/overlay.css
reuse_patterns:
  - "extension/content/editor.js:220-223 — the existing inline projection: port its EXACT arrow/text Math.round + field logic into projectAnnotations() byte-for-byte"
  - "extension/content/editor.js:22 — clone() (JSON deep-clone): the lossless deep-copy idiom for serializeModel/deserializeModel"
  - "extension/content/editor.js:63 — internal model item shapes (arrow/box/text) the pure functions operate over"
defects: []
---

# Story: Pure model-transform module + node:test (serialize/project/deserialize)

## What we're doing

Extract the editor's model⇄wire transforms into a **new, pure, side-effect-free module**
`extension/content/editor-model.js` exporting three functions over the plain `model` array — **no Konva,
no DOM, no `chrome`, no `window` deref** — plus the feature's `node --test` suite at
`extension/editor.model.test.mjs`. This is the headless-testable core mandated by the **BOSS HYBRID test
ruling**: `editor.js` is an IIFE with load-time side effects (`chrome.runtime.onMessage.addListener` at
`editor.js:12`), so it cannot be imported under node; the transforms must live in their own importable
file. **STORY-fe-003** (finish serialize) and **STORY-fe-004** (hydration) consume these functions instead
of inlining the logic — the Konva render/interaction layer calls them, it does not re-implement them.
**STORY-do-001** (devops) registers the file in the manifest so it loads in-browser (`depends_on` this
story); this story is pure logic + its node tests, which import the module directly from disk and need no
browser.

## What it should look like

Three pure functions (all operate on plain JSON; `clone` = `JSON.parse(JSON.stringify(x))`):

- **`serializeModel(model) → { version: 1, items: clone(model || []) }`** — the lossless wire envelope.
  `items` is a deep clone of the internal model (independent copy; mutating `model` afterward must not
  change the result). Always returns `version: 1`.
- **`projectAnnotations(model) → annotations[]`** — the **byte-frozen lossy projection**, ported
  byte-for-byte from `editor.js:220-223`:
  - `arrow` → `{ id, type: "arrow", from: [Math.round(x1), Math.round(y1)], to: [Math.round(x2), Math.round(y2)] }`
  - `text`  → `{ id, type: "text", x: Math.round(x), y: Math.round(y), text }`
  - `box`   → **excluded** (filtered out — never projected).
  Field names, order, and `Math.round` MUST match the current inline output exactly.
- **`deserializeModel(payload) → model[]`** — the round-trip read side. Returns `clone(payload.items)`
  when `payload && payload.version === 1 && Array.isArray(payload.items)`; otherwise returns `[]`
  (tolerant of `null` / missing version / bad shape — never throws). Items pass through **opaquely**
  (unknown w1/w2 subtype fields preserved).

**Dual-consumable module shape** (so the SAME file serves the browser content script AND `node --test`) —
recommended UMD-style wrapper; the hard requirements are *side-effect-free at load* + *no ESM `export`
keyword* (a classic content script can't parse ESM) + *node-importable*. The global name
`__snapdeckEditorModel` matches STORY-do-001's manifest contract:

```js
// extension/content/editor-model.js — PURE. No chrome/window/document/Konva. No top-level side effects.
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // node --test (CJS)
  else root.__snapdeckEditorModel = api;                                        // content script (isolated-world global)
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var MODEL_VERSION = 1;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function serializeModel(model) { /* … */ }
  function projectAnnotations(model) { /* … byte-for-byte editor.js:220-223, box excluded … */ }
  function deserializeModel(payload) { /* … guarded … */ }
  return { MODEL_VERSION: MODEL_VERSION, serializeModel: serializeModel, projectAnnotations: projectAnnotations, deserializeModel: deserializeModel };
});
```

In-browser, `editor.js` reads `window.__snapdeckEditorModel` (live because STORY-do-001 lists this file
**before** `editor.js` in `content_scripts`, same isolated world). The test imports the module directly:
`import editorModel from "./content/editor-model.js";` (default import of the CJS export) then destructures
— note the test sits at `extension/` root, so the relative path is `./content/editor-model.js`.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:220-223` — the lossy projection is **inline** in `finish()`
  (`.map` → arrow `{from,to}` rounded, fallthrough text `{x,y,text}` rounded); `editor.js:226-237`
  serializes inline; there is **no deserialize** path and **no pure module**.
- **Currently:** `editor.js` is `(function(){…})()` (`:5`) and registers `chrome.runtime.onMessage`
  at load (`:12`) → importing it under node executes those side effects and references `chrome`/`window`
  → **not node-importable**. That is *why* the transforms must be extracted.
- **Dispatch path / call graph:** (after extraction) `editor.js` finish/open → `__snapdeckEditorModel.{serializeModel,projectAnnotations,deserializeModel}` → plain data. The node test imports `content/editor-model.js` directly off disk.
- **No-regression assertion:** `projectAnnotations(model)` output MUST be **byte-identical** to the current
  inline projection (`:220-223`) for arrow/text models — same field names, same order, same `Math.round`.
  This story does NOT change `editor.js` (the wiring is STORY-fe-003/004), so runtime behavior is
  unchanged until those land; `editor.js` is `files_not_modified` here.
- **Explicitly changing:** add the new pure module file + the feature's node-test suite. No edit to
  `editor.js`, `background.js`, or `manifest.json` in this story.
- **Verified:** 2026-06-19

## How we're doing it

- Create `extension/content/editor-model.js` per the dual pattern above. **Purity is the contract** — the
  module must not reference `chrome`, `window`, `document`, `Konva`, or run any side effect at load. Use a
  local `clone`; do not import anything.
- Port `projectAnnotations` from `editor.js:220-223` **verbatim** (the rounding/field logic is frozen),
  adding only the `box` exclusion (filter `type==="box"` out before mapping).
- Create `extension/editor.model.test.mjs` (feature-prefixed per the cohort naming convention — avoids the
  shared `background.test.mjs` collision owned by w0-keyboard-shortcuts) using the built-in node test
  runner (`import { test } from "node:test"; import assert from "node:assert/strict";`) — **zero
  dependencies**, no Konva/DOM. `unit-tester` runs it via `node --test extension/*.test.mjs` (Phase 5a).
- Leave the `editor.js` wiring to STORY-fe-003 (finish) and STORY-fe-004 (open) and the manifest
  registration to STORY-do-001 — keep this story's diff to the two new files.

## How we validate it was done correctly

- [ ] `editor-model.js` is **importable under node with zero side effects** — importing it does not throw
      and does not require `chrome`/`window`/`document`/`Konva`.
- [ ] `projectAnnotations` output is **byte-identical** to the legacy inline projection (`editor.js:220-223`)
      for arrow-only and arrow+text models (same fields, order, `Math.round`); `box` items are excluded.
- [ ] **Round-trip identity:** `deserializeModel(serializeModel(model))` deep-equals the original `model`
      for a model containing arrow + box (+ text) items — no geometry/content drift.
- [ ] `serializeModel` returns `{ version: 1, items: [...] }` where `items` is a **deep clone** (mutating
      the source `model` after the call does not change the returned payload).
- [ ] `deserializeModel` returns `[]` for `null`, a missing/wrong `version`, or non-array `items`, and
      never throws.
- [ ] **Opaque items:** an item carrying an unknown extra field survives `serializeModel → deserializeModel`
      unchanged (forward-compat for w1/w2 subtype fields).
- [ ] `node --test extension/*.test.mjs` passes (all `extension/editor.model.test.mjs` cases green).

## Motion contract

`n/a` — pure data-transform module; no UI, no animation, `frontend_lane: N/A`.

## Unit tests

> **`node --test`, zero-dependency, `extension/editor.model.test.mjs`, NO Konva/DOM** — the BOSS HYBRID
> lane. This story AUTHORS the file and OWNS the headless invariants; `unit-tester` runs them via
> `node --test extension/*.test.mjs` in Phase 5a. The through-the-real-editor round-trip stays in the browser-tester
> E2E lane (STORY-fe-003/004). STORY-fe-003 references these same cases as the unit coverage of its
> serialize/projection wiring.

- `extension/editor.model.test.mjs` — `round-trip identity (serialize→deserialize)` —
  `deserializeModel(serializeModel(m))` deep-equals `m` for arrow + box (+ text) items.
- `extension/editor.model.test.mjs` — `projection byte-frozen vs fixture` — `projectAnnotations(m)`
  deep-equals a fixed expected fixture (same `Math.round`, field names/order); box excluded.
- `extension/editor.model.test.mjs` — `serializeModel returns versioned deep clone` — result is
  `{version:1, items}`; mutating `m` after the call does not change the result.
- `extension/editor.model.test.mjs` — `deserializeModel guards invalid payloads` — `null` / bad-version /
  non-array `items` → `[]`, no throw.
- `extension/editor.model.test.mjs` — `opaque subtype fields survive round-trip` — an item with an extra
  field round-trips unchanged.

## Dependencies

STORY-fe-001 (the `box` item shape that `projectAnnotations` excludes and `serializeModel` carries is
established there). Consumed at runtime by STORY-fe-003 / STORY-fe-004; registered in the manifest by
STORY-do-001 (which `depends_on` this story — the file must exist before it is registered).

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified this is the headless pure core mandated by the BOSS
  HYBRID ruling — `serializeModel`/`projectAnnotations`/`deserializeModel` are side-effect-free, node-
  importable, and own the round-trip-identity + byte-frozen-projection + guard invariants in
  `extension/editor.model.test.mjs`. Confirmed the `__snapdeckEditorModel` global name matches do-001's
  manifest contract and the test filename does not collide with the cohort's other `*.test.mjs` files.
  This module is the load-bearing dependency of the `fe-005 → do-001 → fe-003/fe-004` chain. No
  story-content change. **Promoted `pending → approved`.**

## Engineer Notes

Smoke verification: pure module — no browser/Konva dependencies. `node --test extension/*.test.mjs` passed with **56/56** tests (31 new editor.model tests + 25 pre-existing).

Implementation notes:
- UMD wrapper: CJS branch (`module.exports`) for node --test; `root.__snapdeckEditorModel` for browser content script.
- `projectAnnotations`: ported byte-for-byte from editor.js:220-223 (original inline projection) with `box` exclusion via type-specific forEach (arrow→push arrow projection, text→push text projection, box→skip).
- `deserializeModel`: envelope-only guard (`version===1 && Array.isArray(items)`) → clone; items pass through opaquely (no per-field validation per the ratified forward-compat contract). One-line security comment explains the intentional split.
- `serializeModel`: deep clone via `JSON.parse(JSON.stringify())` — prevents functions/prototypes in the wire payload; same idiom as editor.js clone() at line 22.
- Test note: NaN/Infinity values become null via JSON round-trip (JSON spec); test verifies `deserializeModel` does not throw and preserves item count — the render-boundary guard handles null at renderBox/renderArrow time.
- One auto-resolved clarification: `deserializeModel` must not throw on oversized arrays or oversized text (count/text caps are render-layer concerns per the ratified contract); verified in test cases 55-56.

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on STORY-fe-001; pure-logic core for the BOSS HYBRID node:test lane)
- 2026-06-19 — implemented (commit: 4e29db1)

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **INFO**

**INFO — the deserialize guard scope is correct; document the boundary split.** `deserializeModel`'s
two-line envelope guard (`payload && payload.version === 1 && Array.isArray(payload.items)` → else `[]`,
never throws) is the **right** check for this module and is the load-bearing reason hydration
(STORY-fe-004) can't be crashed by a malformed *envelope* (`null` / missing version / non-array). The
deliberate **opaque pass-through of item contents** (no per-field validation) is also correct — it is
the ratified forward-compat contract that lets w1/w2 box-subtype fields survive. Do **not** add
per-item validation here; that would break the contract.

The corollary is just that this module does **not** (and should not) defend against
*structurally-valid-but-numerically-hostile* items — that robustness belongs at the Konva **render
boundary**, tracked as the LOW in STORY-fe-004's Security Review. Suggest a one-line code comment in
`deserializeModel` stating the intentional split ("envelope validated here; item-field sanity is a
render-layer concern — items pass through opaquely for w1/w2 forward-compat") so a future maintainer
doesn't "harden" this function and silently break the opaque contract.

**Spoofing / Tampering / Info-disclosure / EoP: N/A.** Pure, side-effect-free module — no `chrome`,
`window`, `document`, `Konva`, network, or filesystem access at load or call time (this is the story's
own purity contract). It exposes no new attack surface; it is a deterministic data transform over plain
JSON. `serializeModel`'s deep-clone (`JSON.parse(JSON.stringify(...))`) also means the emitted payload
can't carry functions/prototypes — a good implicit sanitization on the *serialize* side.

**PO disposition:** ACCEPT_AS_RECOMMENDATION. The envelope-only guard scope is correct and the opaque
item pass-through MUST stay (ratified forward-compat contract — do NOT add per-item validation here).
Accept the suggested one-line code comment in `deserializeModel` ("envelope validated here; item-field
sanity is a render-layer concern — items pass through opaquely for w1/w2 forward-compat") as a
**non-blocking implementation guardrail** so a future maintainer doesn't "harden" the function and
silently break the contract — it's a comment, not a new validates item, and no STORY-sec. The
render-boundary robustness this finding points at is handled by the **PROMOTE_TO_AC on STORY-fe-004**.
