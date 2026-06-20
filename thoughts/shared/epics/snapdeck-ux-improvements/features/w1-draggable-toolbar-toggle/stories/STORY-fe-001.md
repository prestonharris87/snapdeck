---
type: story
id: STORY-fe-001
name: "Pure editor-chrome module: clamp + pos serialize + visibility-state + node tests"
domain: frontend
parent_feature: w1-draggable-toolbar-toggle
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: released
depends_on: []
greenfield: true
created_at: 2026-06-19T15:40:00Z
last_run_id: run-20260619-042600-10898
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: Pure editor-chrome module (`editor-chrome.js`) + node tests

## What we're doing

Author a NEW, side-effect-free, dual-consumable pure module
`extension/content/editor-chrome.js` that holds all the node-testable logic for
this feature: toolbar-position viewport-clamp math, toolbar-position
serialize/deserialize/guard helpers (for the `chrome.storage.local` round-trip),
and the annotation-visibility-state helpers. The module exposes NO chrome /
window / document / Konva references and runs NO top-level side effects, so it
is importable under `node --test`. It mirrors the released
`extension/content/editor-model.js` UMD pattern exactly (sets
`globalThis.__snapdeckEditorChrome` in-browser, `module.exports` under node).
This story ALSO ships the one feature-distinct test file
`extension/editor.chrome.test.mjs`. The two editor.js consumer stories
(fe-002 drag/persistence, fe-003 visibility toggle) consume this module at
runtime via `window.__snapdeckEditorChrome`.

## What it should look like

A new file `extension/content/editor-chrome.js`, structured identically to the
released `editor-model.js` UMD wrapper (`editor-model.js:14-21`). Exported API:

```
// --- toolbar position ---
clampToViewport(pos, dims) -> { left, top }
//   pos  = { left:Number, top:Number }            (desired toolbar top-left, fixed-viewport px)
//   dims = { vw, vh, tw, th }                      (viewport w/h, toolbar w/h)
//   Returns { left, top } clamped so the toolbar rect stays fully on-screen:
//     left in [0, max(0, vw - tw)], top in [0, max(0, vh - th)].
//   If the toolbar is wider/taller than the viewport, clamp the offending axis to 0.
//   Non-finite inputs on an axis fall back to 0 for that axis (never NaN out).

serializeToolbarPos(pos) -> { left, top } | null
//   Validates pos has finite numeric left/top; returns a plain {left, top}
//   object suitable for chrome.storage.local.set, or null when invalid.

parseStoredPos(raw) -> { left, top } | null
//   Guards a value read back from chrome.storage.local; returns {left, top}
//   when raw is an object with finite numeric left/top, else null (never throws).

// --- annotation visibility ---
nextVisibility(shown) -> Boolean          // pure toggle: !shown
layerVisibility(shown) -> { annVisible:Boolean, selectVisible:Boolean }
//   Derives the desired layer-visible booleans from one "annotations shown"
//   flag. Contract: selectVisible tracks annVisible (selection chrome is hidden
//   whenever annotations are hidden). When shown===false → both false.
```

The return shape and field names above are the contract fe-002/fe-003 consume —
do not rename.

## How we're doing it

- Copy the UMD wrapper boilerplate from `editor-model.js:14-21` verbatim (the
  `(function (root, factory) { ... })(...)` shape). Swap the browser global to
  `root.__snapdeckEditorChrome` and keep `module.exports = api` for node.
- Implement the five pure functions above. No `chrome.*`, no `window`, no
  `document`, no `Konva` — the module must `import` cleanly under node (that's
  the whole reason it lives outside `editor.js`, which runs
  `chrome.runtime.onMessage.addListener` at load and therefore cannot be
  imported by the test runner — see `editor-model.js:1-12` header note).
- `clampToViewport`: `Math.max(0, Math.min(left, Math.max(0, vw - tw)))` per
  axis; guard non-finite inputs to 0 before clamping.
- `parseStoredPos` / `serializeToolbarPos`: use a small finite-number check
  (`typeof v === "number" && isFinite(v)`), mirroring `editor.js:115`
  `isFiniteNum`. Return `null` on any invalid input — never throw.
- This story does NOT register the file in `manifest.json` — that is
  STORY-do-001 (devops). This story does NOT modify `editor.js` — that is
  fe-002/fe-003. Keep the file pure and standalone.
- **Icons / labels:** n/a — this module has no DOM/UI surface.

## How we validate it was done correctly

- [ ] `extension/content/editor-chrome.js` exists and contains NO references to
      `chrome`, `window`, `document`, or `Konva`, and no top-level side effects
      (importable under node).
- [ ] The UMD wrapper sets `globalThis.__snapdeckEditorChrome` when no
      `module.exports` is present and `module.exports` under node — same shape as
      `editor-model.js:14-21`.
- [ ] `clampToViewport` returns in-bounds positions unchanged and clamps
      off-screen positions back into the viewport on both axes (and clamps to 0
      when the toolbar exceeds the viewport on an axis).
- [ ] `serializeToolbarPos` / `parseStoredPos` round-trip a valid `{left, top}`
      and return `null` (no throw) for null / garbage / non-finite input.
- [ ] `nextVisibility` flips the boolean; `layerVisibility(false)` returns
      `{annVisible:false, selectVisible:false}` and `layerVisibility(true)`
      returns both `true` (selectVisible tracks annVisible).
- [ ] `node --test extension/editor.chrome.test.mjs` passes; the cumulative
      `node --test extension/*.test.mjs` run still passes (no filename collision
      with the existing `editor.model.test.mjs` / `background.*.test.mjs`).
- [ ] **Manifest load-order guard** (added at arbitration — see Revisions): the test
      file reads `extension/manifest.json` and asserts the `document_idle`
      content-script `js` array contains `content/editor-chrome.js` with
      `index(editor-model) < index(editor-chrome) < index(editor)`, and that every
      registered `js` path resolves to an existing file under `extension/`. Pure `fs`
      read **inside the test file only** — the `editor-chrome.js` module under test
      stays chrome/window/document/Konva-free.

## Motion contract

`n/a` — pure data-transform module, no UI surface, no animation.

## Unit tests

Ship one feature-distinct file `extension/editor.chrome.test.mjs` (mirror the
import + structure of `editor.model.test.mjs:17-21` — `node:test` +
`node:assert/strict`, ESM importing the CJS UMD module as the default export).
Filename is feature-distinct so the dir-level `node --test extension/*.test.mjs`
run does not collide with siblings.

- `extension/editor.chrome.test.mjs` — `clampToViewport returns in-bounds position unchanged` — a position fully inside the viewport is returned as-is.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps off-right / off-bottom back into view` — `left > vw-tw` clamps to `vw-tw`; `top > vh-th` clamps to `vh-th`.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps negative left/top to 0` — negative coords pull back to 0.
- `extension/editor.chrome.test.mjs` — `clampToViewport clamps to 0 when toolbar exceeds viewport on an axis` — `tw > vw` ⇒ left 0; `th > vh` ⇒ top 0.
- `extension/editor.chrome.test.mjs` — `clampToViewport coerces non-finite input to 0 per axis (never NaN)` — `{left: NaN}` ⇒ left 0, other axis preserved.
- `extension/editor.chrome.test.mjs` — `serializeToolbarPos round-trips valid pos, returns null on garbage` — `{left:10,top:20}` ⇒ `{left:10,top:20}`; `null`/`{}`/`{left:"x"}` ⇒ `null`, no throw.
- `extension/editor.chrome.test.mjs` — `parseStoredPos guards stored values` — valid object ⇒ `{left,top}`; null / non-object / non-finite ⇒ `null`, never throws.
- `extension/editor.chrome.test.mjs` — `nextVisibility flips boolean` — `true→false`, `false→true`.
- `extension/editor.chrome.test.mjs` — `layerVisibility derives both flags (selectVisible tracks annVisible)` — `true` ⇒ both true; `false` ⇒ both false.
- `extension/editor.chrome.test.mjs` — `manifest registers editor-chrome.js in correct load order` — reads `extension/manifest.json` via `fs`, finds the `document_idle` content-script entry, asserts its `js` array contains `content/editor-chrome.js` with `index(editor-model) < index(editor-chrome) < index(editor)`, and asserts every `js` path resolves to a file on disk under `extension/`. No network, no browser — pure file I/O in the test file (the module under test stays chrome/window-free). _[added at arbitration; owns the load-order regression net flagged by contrarian do-001 Finding 1 / fe-001 Finding 1.]_

## Dependencies

none — net-new standalone pure module (greenfield). It is the producer that
STORY-do-001 (manifest registration) and fe-002/fe-003 (runtime consumers)
depend on; it depends on nothing itself.

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on none; greenfield pure module + node test file)
- 2026-06-19T00:00:00Z — implemented (commit: 8881b02) — Manual verification deferred — pure data-transform module, no UI surface, no chrome/window/Konva references; browser-tester smoke is inapplicable.
2026-06-19T22:19:58Z — BOSS: status: 'validated' -> 'released' (Released via Wave-1 PR #2 (8c340a6))

## Contrarian Findings

### Finding 1 — This file owns the test suite that STORY-do-001's manifest-order guard wants to live in

**Severity:** concern (cross-ref STORY-do-001 Finding 1)
**Mechanism:** STORY-do-001 commits to a `node --test` assertion that
`index(editor-model) < index(editor-chrome) < index(editor)` in the manifest, and
states it "contributes the manifest-shape assertions" to **this story's**
`extension/editor.chrome.test.mjs`. But this story's `## Unit tests` enumerates nine
cases (clamp / serialize / parse / visibility) with **no manifest-order case**, and
do-001's `files_modified` does not declare the test file — so the load-order
regression guard (on a seam do-001 itself calls "load-bearing, not cosmetic") is
owned by neither story as written. See STORY-do-001 → Contrarian Findings → Finding
1 for the full mechanism and failure modes.
**Recommendation:** the cleanest resolution at arbitration is to add the
manifest-order + path-exists assertions to **this story's** test list (FE owns the
file), and have do-001 reference rather than "contribute to" it. Decide explicitly;
do not leave it implicit.

## Security Review

### Finding 1 — Untrusted `chrome.storage.local` toolbar position: parse + clamp guards are present and adequate (confirm)

**Severity:** low (defense-in-depth; the store is extension-owned, not page-writable — see disposition)
**Threat (STRIDE: Tampering / DoS).** This story is the home of the only trust
boundary in the feature: a value read back from `chrome.storage.local`
(`snapdeckEditorToolbarPos`) is applied to the toolbar's `left/top`. A
corrupt/tampered/stale value (`NaN`/`Infinity`/`1e308`, wrong-typed geometry,
`{left:"x"}`, `null`, an off-viewport coordinate after a window resize) must not
(a) throw at `openEditor()`, (b) strand the toolbar off-screen, or (c) reach the
`bar.el.style.left/top` sink as a non-numeric value that could inject CSS.
**Assessment — guards confirmed adequate.** The API contract closes all three:
- `parseStoredPos(raw)` returns `null` (never throws) for null / non-object /
  non-finite / wrong-typed input via the `typeof v === "number" && isFinite(v)`
  check (mirrors `editor.js:115` `isFiniteNum`) — closes the throw-at-open vector.
  The `## Unit tests` case `parseStoredPos guards stored values` exercises exactly
  this. ✓
- `clampToViewport` coerces non-finite per-axis input to `0` and clamps off-screen
  coordinates back into `[0, max(0, vw-tw)]` × `[0, max(0, vh-th)]` — closes the
  strand-off-screen vector. Cases `clamps … back into view` /
  `coerces non-finite input to 0 per axis (never NaN)` cover it. ✓
- **Style-injection sub-vector closed transitively (verified):** `editor.js`
  has **no `innerHTML`/`insertAdjacentHTML` sink** (grep, HEAD) — the only style
  writes are numeric `.style.X = <n> + "px"` concatenations (e.g.
  `editor.js:197-198`). Because `parseStoredPos`/`clampToViewport` guarantee the
  applied `left/top` are **finite numbers**, the downstream `bar.el.style.left =
  left + "px"` sink (fe-002) cannot carry an injected CSS string. The finite-number
  guard IS the XSS/CSS-injection guard — keep `serializeToolbarPos` (write path)
  and `parseStoredPos` (read path) BOTH enforcing finiteness so a malformed value
  can never round-trip back as a string.
**Why LOW, not MEDIUM/HIGH.** `chrome.storage.local` is written/read in the
**isolated content-script world** (the `document_idle` manifest entry has no
`"world"` key → isolated; only `capture.js` is `world: MAIN`, verified
`manifest.json:34-43`). A web page cannot write or read this key — the only writer
is the extension itself. So this is a robustness/defense-in-depth boundary against
the extension's own corruption / a future bug / devtools tampering, not a
page-reachable attack surface. This mirrors the w0 render-boundary robustness
pattern (fe-004 malformed-model tolerance) and the lessons-file guidance that a
first-party-source guard rates LOW.
**Recommendation:** no story change — guards are specified correctly and the test
cases pin them. Disposition: **accept as adequate.** One forward-looking note for
the engineer: ensure the apply-on-open path actually routes through
`parseStoredPos` → `clampToViewport` (not a raw `JSON.parse`/direct apply) so the
guards are on the live path, not just unit-tested in isolation (fe-002 already
specifies this; flagged here for symmetry).

### STRIDE checklist disposition (feature-level, recorded once here)

Recorded so the PO sees the default checklist was **applied, not skipped** — most
items are N/A for a local, no-network Chrome-extension editor-chrome module:
- **Authn/authz, CSRF, CORS, rate-limiting:** N/A — no HTTP endpoint, no server
  surface (be-001 sentinel confirms). The extension's only access control (the
  localhost host-guard in `addScreenshot()`, `background.js:112`) is untouched.
- **Input validation:** the one untrusted input (stored toolbar pos) is validated
  — see Finding 1. ✓
- **Secrets:** none introduced; no credentials, tokens, or env config touched.
- **Audit columns / soft-delete:** N/A — no server entity table (db-001 sentinel).
- **Injection / parameterization:** N/A — no DB query; no string concatenation into
  a query (the only concatenation is numeric `…+"px"`, guarded above).
- **Output encoding / XSS:** N/A — no `innerHTML` sink; new chrome is CSS-painted
  grip + plain-text button label (fe-002/fe-003). ✓
- **Permission widening:** none — `storage` already granted (`manifest.json:6`);
  no new permission / `host_permissions` / `commands` / `externally_connectable`
  (do-001).
- **Multi-tenant isolation:** N/A — single-user local tool, no tenancy model.

**PO disposition:** PROMOTE_TO_AC — Finding 1 (LOW, untrusted `chrome.storage.local` toolbar position) is the feature's **sole trust boundary**, so I elevate the parse+clamp guards from a unit-test detail to a mandatory, validator-checkable contract. Wired: firmed the feature.md clamp AC to name the never-throw / coerce-garbage robustness + default-centered fallback, and added a feature.md PO E2E (corrupt/non-finite stored value → safe fallback, no console error) that proves the guards sit on the **live** apply-on-open path (the security-architect's "ensure the guards are on the live path, not just unit-tested in isolation" concern). No new test authored here — the PROMOTE points at this story's existing validate items + named node tests (`parseStoredPos guards stored values`, `clampToViewport coerces non-finite … never NaN`), which already pin the guards; keep BOTH the write (`serializeToolbarPos`) and read (`parseStoredPos`) paths enforcing finiteness so the finite-number guard remains the CSS-injection guard (`editor.js` has no `innerHTML` sink).
**PO disposition:** ACCEPT_AS_RECOMMENDATION — feature-level STRIDE checklist: recorded as applied-not-skipped; every item is N/A or covered (no HTTP/server surface per be-001, no DB entity per db-001, no permission widening per do-001, the one untrusted input handled by Finding 1). No action.

## Engineer Notes

- **Smoke verification:** this story is a pure node-importable module (`editor-chrome.js`) with no DOM/UI surface and no browser interaction. No browser-tester smoke run is applicable — `Manual verification deferred — pure data-transform module, no UI surface, no chrome/window/Konva references; browser-tester smoke is inapplicable.`
- **Manifest load-order test (ordering-IF-present):** the `manifest registers editor-chrome.js in correct load order` test uses a conditional approach — it always asserts every currently-registered `js` path exists on disk, and additionally asserts `index(editor-model) < index(editor-chrome) < index(editor)` only when `content/editor-chrome.js` is present in the manifest. Since do-001 has not landed yet, the ordering branch is skipped and a diagnostic note is logged. The test will go fully green once do-001 registers the file. See test comment for detail.
- **`clampToViewport` non-finite semantics:** per the story spec ("guard non-finite inputs to 0 **before** clamping"), `Infinity`/`-Infinity`/`NaN` in a `pos` field all fall back to 0 prior to the clamp step — they do NOT pass through to `Math.min/max`. This is intentional and correct: an infinite position is treated as "unknown/corrupt" and reset to the safe 0, not clamped to a natural viewport bound. Test case `clampToViewport coerces non-finite input to 0 per axis (never NaN)` verifies this.
- **`parseStoredPos` array guard:** `Array.isArray` check added explicitly — arrays pass the `typeof === "object"` check but are not valid stored positions. Test case verifies.
- **Consumer contract frozen:** field names `clampToViewport`, `serializeToolbarPos`, `parseStoredPos`, `nextVisibility`, `layerVisibility` and their return shapes are the frozen contract for fe-002/fe-003. Do NOT rename.
- **Cumulative test run:** `node --test extension/*.test.mjs` — 75/75 pass, zero regression.

## Revisions

### 2026-06-19 — product-owner (arbitrate, run-20260619-042600-10898)

**CONCERN resolved — manifest load-order regression guard assigned to this story (FE
owns the test file).** Per team-lead arbitration direction and the contrarian
recommendation (do-001 Finding 1 / fe-001 Finding 1): the
`index(editor-model) < index(editor-chrome) < index(editor)` + path-exists assertion
is **owned here** because FE authors and owns `extension/editor.chrome.test.mjs`.
Added: (1) a `## How we validate` checklist item, and (2) a `## Unit tests` case
(`manifest registers editor-chrome.js in correct load order`). The assertion is a
pure `fs` read of `extension/manifest.json` **inside the test file** — it does NOT
add `chrome`/`window`/`document`/`Konva` to the `editor-chrome.js` module, which
stays side-effect-free and node-importable (the story's core constraint is intact).
STORY-do-001 now **references** this guard (it runs `node --test extension/*.test.mjs`
as a validate step) rather than "contributing to" a file it doesn't own/declare —
closing the no-owner gap without an undeclared cross-domain edit by the
devops-engineer. Status `pending → approved`.

## Validation

- result: validated
- frontend-validator: validated — module pure (no chrome/window/document/Konva), UMD matches editor-model.js, parseStoredPos/clampToViewport trust-boundary guards verified, 19/19 + 75/75 no regression.
- honesty-check-validator: passed — net-additive, no skip/deletion/weakening; 4 pre-existing test files unmodified; manifest load-order test is staged (if-present), not suppressed.
- Verdicts: .claude/state/checker-verdicts/feat-w1-draggable-toolbar-toggle/{frontend-validator,honesty-check-validator}--STORY-fe-001.json

## History

- 2026-06-19T16:23:21Z — orchestrator — validate validated (frontend-validator)
- 2026-06-19T16:23:21Z — orchestrator — honesty passed (honesty-check-validator)
- 2026-06-19T16:23:21Z — orchestrator — status in-progress → validated
