---
type: story
id: STORY-fe-004
name: "Model hydration on editor open via pure deserializeModel"
domain: frontend
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: [STORY-fe-001, STORY-fe-003, STORY-fe-005, STORY-do-001, STORY-be-001]
created_at: 2026-06-19T03:30:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
diff_estimate: substantive
files_modified:
  - extension/content/editor.js
files_not_modified:
  - extension/content/editor-model.js
  - extension/editor.model.test.mjs
  - extension/background.js
  - extension/manifest.json
  - extension/content/overlay.css
reuse_patterns:
  - "extension/content/editor-model.js — deserializeModel(payload)→model (STORY-fe-005): call this to hydrate; do NOT re-implement the guard inline"
  - "extension/content/editor.js:12-19 — ANNOTATE message listener: where to thread the optional incoming model"
  - "extension/content/editor.js:63 — model initialization (`var model = []`): where to seed from deserializeModel"
  - "extension/content/editor.js:74-81 — render(): already reconstructs Konva nodes from the model; no change needed beyond seeding"
defects: []
---

# Story: Model hydration on editor open via pure deserializeModel

## What we're doing

Give the editor the **capability to hydrate from a persisted `model`** when it opens — the read side that
completes the round-trip identity `model → persist → load → model`. The ANNOTATE message gains an optional
`model` field; `openEditor` seeds its internal `model` from it by calling
`window.__snapdeckEditorModel.deserializeModel(...)` (the pure, guarded reader from **STORY-fe-005**)
instead of starting empty, and the existing `render()` reconstructs the arrows/boxes/text. The
**user-facing re-open trigger** (the gallery that lets a dev pick a stored screenshot to re-edit) is
**w2-screenshot-gallery**; the stored `model` it reads back is produced by **STORY-fe-003** and stored by
**STORY-be-001**. For w0 the round-trip is exercised by the browser-tester re-sending ANNOTATE with the
stored `screenshots[].model`.

## What it should look like

- **ANNOTATE handler** (`editor.js:12-19`): read the optional `msg.model` and pass it through —
  `openEditor(msg.image, msg.model).then(sendResponse)`.
- **`openEditor(imageDataUrl, initialModel)`** (`editor.js:24`): seed the internal model via the pure
  reader at `editor.js:63`:
  ```js
  var model = window.__snapdeckEditorModel.deserializeModel(initialModel);   // [] when absent/invalid
  ```
  `deserializeModel` already enforces the version/shape guard (`version===1 && Array.isArray(items)`),
  deep-clones items, and returns `[]` for `null` / missing / bad shape — so hydration is a single call,
  no inline guard. `past`/`future` stay `[]` (`editor.js:66`): the hydrated model is the undo baseline.
- **Reconstruction is automatic:** `render()` (`:74-81`) already dispatches `arrow`/`box`(STORY-fe-001)/
  `text` to their renderers, so a hydrated model draws with no extra code. Geometry loads **verbatim** in
  the stored `meta.viewport` coordinate space (stage/CSS px); cross-viewport rescaling is **out of scope**
  (the w0 round-trip test reloads at the same viewport).
- **Global access:** `window.__snapdeckEditorModel` is live because STORY-do-001 registers
  `editor-model.js` before `editor.js`.

## Existing behavior baseline

- **Currently:** `extension/content/editor.js:12-19` — the ANNOTATE listener calls `openEditor(msg.image)`
  with **no model parameter**; `editor.js:24` — `openEditor(imageDataUrl)`; `editor.js:63` —
  `var model = []` (always starts empty); `editor.js:66` — `past=[], future=[]`.
- **Currently:** `editor.js:74-81` — `render()` reconstructs Konva nodes from whatever is in `model`.
- **Dispatch path / call graph:** (re-open) STORY-be-001 store `screenshots[].model` → ANNOTATE carries
  `model` → `openEditor(image, model)` → `deserializeModel` seed (`:63`) → `render()` (`:74-81`) → Konva
  nodes. On Done, STORY-fe-003's `serializeModel` re-emits → identity.
- **No-regression assertion:** opening **without** a model (the normal capture flow, `msg.model` absent)
  behaves **exactly** as today — `deserializeModel(undefined)` returns `[]`, so the editor starts empty;
  arrow/box/text draw unaffected; undo baseline empty. The capture path (`background.js:110-141`) sends
  ANNOTATE without `model`, so live capture is unchanged.
- **Explicitly changing:** ANNOTATE reads optional `msg.model`; `openEditor` accepts an optional
  `initialModel` and seeds the internal model via the pure `deserializeModel`.
- **Verified:** 2026-06-19

## How we're doing it

- Single file: `extension/content/editor.js`. Thread `msg.model` from the listener (`:12-19`) into
  `openEditor`, and seed `model` at `:63` via `window.__snapdeckEditorModel.deserializeModel(initialModel)`.
- **Do NOT re-implement** the version/shape guard or the clone in `editor.js` — `deserializeModel`
  (STORY-fe-005) owns it (`files_not_modified` here). The manifest registration is STORY-do-001.
- **Re-open trigger is NOT in this story.** Do not add a gallery/list UI (w2) and do not add a re-open
  command to `background.js` (w2 / BE surface). This story ships only the editor's hydration capability;
  `background.js` is `files_not_modified`.
- **Verification:** delegate to `bt` — after a Done that stored a `model` (STORY-fe-003 + STORY-be-001),
  re-send ANNOTATE with that stored `screenshots[].model` and confirm the reconstructed editor matches.
  See `.claude/onboarding/frontend.md` §"Mandatory smoke-test protocol"; confirm the extension is loaded
  in a user-owned Chrome first.

## How we validate it was done correctly

- [ ] **Round-trip identity:** ANNOTATE with `model = { version:1, items:[arrow, box] }` reconstructs the
      arrow (endpoints) and box (`{x,y,width,height}`) at the stored geometry; Done re-emits a
      `model.items` that deep-equals the input — `model → persist → load → model` is identity.
- [ ] `openEditor` seeds via `window.__snapdeckEditorModel.deserializeModel(...)` — **no** inline
      version/clone guard in `editor.js`.
- [ ] **No-model default:** ANNOTATE **without** `model` opens an empty editor (current capture behavior,
      unchanged).
- [ ] **Guard tolerance:** ANNOTATE with `model` = `null` / missing `version` / non-array `items` opens
      empty with **no console error** (deserializeModel returns `[]`).
- [ ] **Box geometry fidelity:** a hydrated box renders at exactly the stored `{x,y,width,height}`.
- [ ] **Undo baseline:** immediately after hydration, Undo does nothing (loaded state is the baseline).
- [ ] **Opaque items:** an unknown/extra field on a hydrated item (a w1/w2 subtype field) survives
      hydration → Done round-trip unchanged.
- [ ] **Malformed-item render tolerance** _(promoted from the security-architect LOW)_: hydrating a
      `version:1` payload whose items carry non-finite or wrong-typed geometry
      (`NaN`/`Infinity`/`1e308`/string `width`) renders **without throwing or emitting a console error**
      (bad items skipped/coerced), **and** an oversized item-count or multi-megabyte `text` is **bounded**
      (item-count cap + text-length cap) so it can't hang/DoS the editor — all at the render dispatch
      (`render()` / `renderBox`/`renderArrow`), keeping `deserializeModel`'s opaque pass-through unchanged.

## Motion contract

`n/a` — hydration/render-seeding logic only; reconstructed annotations appear on initial render with no
transition, `frontend_lane: N/A`, so no reduced-motion-affected animation.

## Unit tests

> **HYBRID lane.** The pure round-trip + guard invariants are covered by the `node --test` suite at
> **`extension/editor.model.test.mjs`** (authored in STORY-fe-005 — `round-trip identity`,
> `deserializeModel guards invalid payloads`, `opaque subtype fields survive round-trip`). This story's own
> verification is the browser-tester E2E lane: the round-trip THROUGH the real editor (open → hydrate →
> render → Done). NO Konva/DOM in the `.test.mjs`.

**browser-tester E2E (integration lane — through the real editor):**
- `extension/e2e/w0-editor-foundation.spec.ts` — `hydration round-trips arrow + box through the editor` —
  ANNOTATE with a stored model reconstructs both; Done re-emits an identical `model.items`.
- `extension/e2e/w0-editor-foundation.spec.ts` — `no model opens empty editor` — ANNOTATE without `model`
  starts empty (capture behavior unchanged).
- `extension/e2e/w0-editor-foundation.spec.ts` — `invalid model opens empty without console error` —
  `null` / bad-version / non-array `items` defaults to empty, no console error.
- `extension/e2e/w0-editor-foundation.spec.ts` — `hydrated box renders at stored geometry` — box draws at
  exactly the persisted `{x,y,width,height}`.

## Dependencies

- STORY-fe-001 — needs the `box` renderer to reconstruct box items.
- STORY-fe-003 — shares the `{version, items}` envelope this story reads (and the wiring pattern).
- STORY-fe-005 — calls its `deserializeModel` to hydrate.
- STORY-do-001 — registers `editor-model.js` so `window.__snapdeckEditorModel` is live at runtime.
- STORY-be-001 — reads back the `screenshots[].model` that backend stores (the source of the round-trip).

## Revisions

- 2026-06-19 — **product-owner arbitration.** Verified the **read** side that closes the round-trip:
  `deserializeModel` guard tolerance (`null`/bad-version/non-array → `[]`, no throw) and opaque pass-through
  of unknown w1/w2 subtype fields; hydration seeds the model with no inline guard; the no-model capture path
  is unchanged. Confirmed `depends_on` correctly cites every producer in the chain (fe-001 renderer, fe-003
  envelope, fe-005 reader, do-001 manifest, be-001 store). **Strengthened the matching feature.md round-trip
  E2E to assertion-grade** — `done2.model.items deepEquals done1.model.items` + post-hydration Undo-no-op —
  so the PO E2E proves `model → persist → load → model` identity, not just "looks the same". No
  story-content change. **Promoted `pending → approved`.**
- 2026-06-19 — **product-owner security-finalize.** Dispositioned the security-architect's LOW
  (render-boundary robustness on hydration) as **PROMOTE_TO_AC**: added a "Malformed-item render
  tolerance" item to the validates checklist above, plus a matching AC + PO E2E in `feature.md`. Harden at
  the render dispatch (`render()`/`renderBox`/`renderArrow`), NOT in `deserializeModel` (the opaque
  forward-compat pass-through stays intact). See the `**PO disposition:**` line in `## Security Review`.

## History

- 2026-06-19 — created by frontend-architect (effort=2)
- 2026-06-19 — revised by frontend-architect for BOSS HYBRID ruling: hydrate via pure deserializeModel (STORY-fe-005); depends_on now [STORY-fe-001, STORY-fe-003, STORY-fe-005, STORY-do-001, STORY-be-001]

## Security Review

> security-architect · STRIDE pass · 2026-06-19 · highest severity in this story: **LOW**

**Trust-boundary framing (why this is not HIGH).** `deserializeModel(msg.model)` consumes the
ANNOTATE `model` payload, which in w0 originates from `screenshots[].model` in the extension's **own**
service-worker IndexedDB — written by the extension's own `serializeModel` (STORY-fe-003), not by any
page. Three facts make this a first-party path, not an untrusted-input boundary:
- The manifest declares **no `externally_connectable`**, so no web page can `chrome.runtime.sendMessage`
  the editor — ANNOTATE only arrives from the extension's background worker (same-extension origin,
  Chrome-enforced). **Spoofing of the `model` payload: N/A.**
- The extension's IndexedDB (`snapdeck`/`kv`, service-worker origin) is **isolated from page-origin
  storage** — a malicious `http://localhost` page cannot write the `model` the editor later hydrates.
- Text renders via **`Konva.Text` (canvas)** and is edited through a textarea `.value`, never
  `innerHTML` — so a `text` item carrying markup is **not a DOM-XSS vector** (Info-disclosure /
  Tampering via script injection: N/A). *Confirmed against `editor.js:111-128`.*

**LOW — Tampering/DoS (defense-in-depth, not exploitable today): item-level robustness on hydration.**
`deserializeModel` guards the **envelope** (`version===1 && Array.isArray(items)`) and — correctly, by
the ratified forward-compat contract — passes **items opaquely** (so w1/w2 subtype fields survive). But
that means a *structurally-valid* payload (`version:1`, array `items`) whose item fields are numerically
hostile — `width: 1e308`, `x: NaN`, `height: "120"`, a multi-megabyte `text` string, or thousands of
items — flows straight into `Konva.Rect`/`Konva.Text`/`Konva.Arrow` at the render boundary
(`editor.js:74-81`) with no clamp, type-check, or count bound. The current "guard tolerance" AC only
exercises the **envelope** failures (`null` / bad-version / non-array → `[]`). It does not cover a
well-formed envelope with garbage *items*.

Today this is non-exploitable (first-party source, single-user local tool). It matters **forward**:
**w2-screenshot-gallery** will let a dev re-open arbitrary *stored* screenshots, so a model that was
corrupted on disk (manual edit, partial write, a future buggy producer) re-enters Konva through this
exact path — and a thrown render would break the editor for that screenshot.

**Recommendation (do NOT tighten `deserializeModel` — that would break the opaque forward-compat
contract; harden at the *render boundary* instead):** add one AC to "How we validate it was done
correctly":
- [ ] **Malformed-item tolerance:** hydrating a `version:1` payload whose items carry non-finite or
      wrong-typed geometry (`NaN`/`Infinity`/string `width`) renders **without throwing or emitting a
      console error** — bad items are skipped or coerced at the render dispatch (`render()` /
      `renderBox`/`renderArrow`), keeping `deserializeModel`'s opaque pass-through unchanged.

**PO disposition:** PROMOTE_TO_AC (per team-lead steer + security-architect recommendation: harden at
the *render boundary*, NOT in `deserializeModel` — tightening the pure module would break the ratified
opaque forward-compat contract). The fix lives in this feature's render dispatch
(`render()`/`renderBox`/`renderArrow` in `editor.js`, which fe-001/fe-004 already modify), so promotion is
**scope-clean, not creep**. Wired downstream per the PROMOTE_TO_AC rule: (1) added the malformed-item
render-tolerance item to this story's "How we validate it was done correctly" checklist above; (2) added a
matching acceptance criterion **and** a PO E2E scenario ("malformed-item hydration renders without
throwing") to `feature.md`. The assertion is Konva-render-dependent, so it belongs in the **browser-tester
E2E lane** — NOT the pure `node --test` module (fe-005's opaque pass-through must stay intact); the
engineer adds the render-guard assertion at implementation time. **Rationale for promoting a LOW:**
**w2-screenshot-gallery** will re-open arbitrary *stored* models, so a disk-corrupted / partial-write /
future-buggy-producer model re-enters Konva through this exact path — a thrown render would brick that
screenshot's editor. The wave-0 foundation should not ship the hydration path unguarded.

Disposition is the PO's call in Phase 7.5: either (a) accept-risk now + carry this AC into
w2-screenshot-gallery where untrusted-on-disk models are actually re-opened, or (b) add the small
render-boundary guard now (cheap, ~5 lines, no contract impact). **This is a LOW — it does not gate
delivery of w0.**

**Repudiation / EoP / Info-disclosure:** N/A here — no audit-trail surface (client-side ephemeral
store), no new permission/host, and the hydrated geometry never leaves the machine (the `model` is
excluded from `/report/save`, enforced by STORY-fe-003 / STORY-be-001).
