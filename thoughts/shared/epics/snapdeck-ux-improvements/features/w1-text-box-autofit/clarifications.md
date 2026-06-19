---
type: clarifications
scope: feature
parent_feature: w1-text-box-autofit
parent_epic: snapdeck-ux-improvements
---

## Q1 — Auto-fit determinism: store the fitted font size on the model item, or recompute on render?

- **From:** frontend-architect
- **Phase:** /mat_write_feature Phase 5 (FE decompose)
- **Status:** auto-resolved
- **Context:** `scope.md` §"Auto-fit determinism" explicitly leaves this to the architect, requiring only
  that the round-trip reconstruct identical wrapping/sizing and that re-fit be deterministic on resize.
- **Options:**
  - **A — Store `fontSize` on the text item:** the commit-time fit is persisted. Faster render (skip the
    fit loop on hydrate), but adds a derived field that must be re-derived identically on reload to keep
    `done2.model.items deepEquals done1.model.items`; any drift breaks the lossless-round-trip AC.
  - **B — Recompute on render from `{width,height,text,cap}`:** the item carries geometry + text only
    (`{id,type:"text",x,y,width,height,text}`); the fit is a pure function recomputed each `render()`
    pass via Konva canvas measurement. Round-trip is trivially lossless (no derived field to drift);
    resize re-fit is automatic (`transformend → render()`); render does an extra bounded fit loop.
- **Recommendation:** **B (recompute on render).** `render()` already `destroyChildren()`s and rebuilds
  nodes every pass, so the fit loop is on the existing render path; the loop is bounded by
  `(TEXT_AUTOFIT_MAX - TEXT_AUTOFIT_MIN)` ≈ 42 iterations on already-length-capped text (negligible).
  Eliminating the stored field removes the determinism trap entirely and keeps the model minimal.
- **Decided by:** frontend-architect on 2026-06-19T15:35:00Z
- **Decision:** Recompute-on-render; text item stores geometry + text only (no `fontSize`/fit field).
  Confirmed compatible with the BE sentinel (backend-architect msg 0099 — plain-JSON, structured-clone-safe).

## Q2 — Where does the auto-fit logic live: inline in editor.js, or a new pure shared module?

- **From:** frontend-architect
- **Phase:** /mat_write_feature Phase 5 (FE decompose)
- **Status:** auto-resolved
- **Context:** The w0 "hybrid" lesson (frontend-architect-lessons.md) shows a pushed-for `node --test`
  unit lane can force pure logic OUT of `editor.js` into a registered module (`editor-model.js`) — which
  then requires a `manifest.json` content-script registration (a devops story). I evaluated whether
  auto-fit should follow that pattern.
- **Options:**
  - **A — Extract auto-fit to a registered pure module:** node-testable in isolation; BUT requires a
    manifest entry (devops story + dependency) AND — fatally — Konva wraps text using **canvas text
    metrics**, which a pure node module cannot faithfully replicate, so the "pure" module could not
    actually compute the wrap/fit. It would be a fake abstraction.
  - **B — Keep auto-fit inline in editor.js:** the fit loop uses live Konva text measurement; verified in
    the browser-tester E2E lane (consistent with w0's renderBox/renderArrow being E2E-tested). No new
    browser module, no manifest change, no devops dependency. The pure DATA invariants (projection strips
    width/height; geometry-bearing text item round-trips) go in a small new `node --test` file
    (`extension/editor.textbox.test.mjs`) that imports the **unmodified** `editor-model.js`.
- **Recommendation:** **B (inline).** Auto-fit is inherently canvas-dependent; extracting it would be a
  non-functional abstraction that buys a manifest change for nothing. The genuinely-pure invariants are
  testable without touching the content-script registration.
- **Decided by:** frontend-architect on 2026-06-19T15:35:00Z
- **Decision:** Auto-fit stays inline in `editor.js`; no new browser module; **no manifest change**
  (devops no-work — confirm pending from devops-architect, my read independently verified against
  `extension/manifest.json` lines 39-44 which already register `editor.js`). New pure node test file
  `extension/editor.textbox.test.mjs` covers the projection-strip + round-trip data invariants.

## Q3 — No JS unit runner for editor.js: which test lane covers the Konva-dependent behavior?

- **From:** frontend-architect
- **Phase:** /mat_write_feature Phase 5 (FE decompose)
- **Status:** auto-resolved
- **Context:** `extension/` has no jest/vitest; the only JS test convention is Node's built-in
  `node --test` (zero-dep, ESM), used by `editor.model.test.mjs` / `background.*.test.mjs`. The Konva
  editor (`editor.js`) is an IIFE that registers `chrome.runtime.onMessage` at load, so it cannot be
  node-imported; its behavior (draw, render, auto-fit, transformer, re-edit) is browser-only.
- **Options:** (no genuine fork — this records the established split so the validator and `bt` align.)
- **Recommendation:** Konva/DOM-dependent behavior (drag-to-draw, wrap, auto-fit, white/red/black visual,
  transformer resize re-fit, single-vs-double-click, hostile-geometry render guard, through-the-editor
  round-trip) → **browser-tester Playwright E2E** lane (`extension/e2e/w1-text-box-autofit.spec.ts`,
  authored by `bt` against the feature.md E2E spec). Pure data invariants → `node --test`
  (`extension/editor.textbox.test.mjs` + the existing `editor.model.test.mjs:185` opaque-field test).
- **Decided by:** frontend-architect on 2026-06-19T15:35:00Z
- **Decision:** Same hybrid split w0 used. Story `## Unit tests` sections name the E2E assertions for the
  Konva behavior and the node assertions for the data invariants; no node runner is stood up for
  `editor.js` (out of scope; devops infra).
