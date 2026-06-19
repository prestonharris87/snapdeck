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
status: pending
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

## History

- 2026-06-19 — created by frontend-architect (effort=2)
- 2026-06-19 — revised by frontend-architect for BOSS HYBRID ruling: hydrate via pure deserializeModel (STORY-fe-005); depends_on now [STORY-fe-001, STORY-fe-003, STORY-fe-005, STORY-do-001, STORY-be-001]
