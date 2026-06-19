---
type: feature
slug: w0-editor-foundation
wave: 0
parent_epic: snapdeck-ux-improvements
status: released
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-041432-92808
depends_on: []
frontend_lane: N/A
skip_ui_designer: true
visual_references: []
released_at: 2026-06-19T15:01:25Z
pr_url: https://github.com/prestonharris87/snapdeck/pull/1
---

# Feature: Annotation editor foundation (box model + lossless persistence + shared transformer)

## Summary

This is the wave-0 structural spine of the annotation editor (`extension/content/editor.js`).
The editor keeps a rich internal `model` while you draw but throws it away on commit — `finish()`
emits only the lossy `{from,to}` / `{x,y,text}` projection (`resp.annotations`), so a captured
screenshot can never be re-opened and edited without geometry/content loss. This feature lays three
foundations the rest of the editor cluster builds on: a **box-shaped annotation primitive** carrying
`{x, y, width, height}` geometry; **lossless persistence** of the full internal `model` on the
resolve payload (additive, alongside the byte-frozen projection) and on the per-screenshot record in
`background.js`; and a single shared **`Konva.Transformer` move/resize** mechanism for box-shaped
annotations. Four dependents consume these contracts (w1-text-box-autofit, w1-draggable-toolbar-toggle,
w2-rectangle-tool, w2-screenshot-gallery). It is a mechanism refactor — no new screens, no styling.

## User-facing behavior

The "user" here is the developer/tester capturing screenshots in the in-page Konva editor (this is a
developer-facing annotation tool, not the project's component-library UI; `skip_ui_designer: true`).

- The dev draws annotations as before. In addition to arrows, the editor now supports a **box-shaped
  annotation** with rectangular `{x,y,width,height}` geometry (the concrete box subtype shipped to
  exercise the machinery is an architect decision — see Stories).
- In **select mode** the dev clicks an existing box-shaped annotation; it becomes selected and shows
  standard `Konva.Transformer` resize handles. Dragging a handle resizes the box; dragging the body
  moves it. The change is undoable (Undo restores the prior geometry).
- On **✓ Done**, the screenshot is saved to the in-progress report exactly as before — the downstream
  report→defects consumer sees an identical lossy projection. Invisibly, the editor now also persists a
  lossless `model` on the stored record, so the same screenshot can later round-trip back into the
  editor with no geometry/content loss (the re-open UI itself is w2-screenshot-gallery).
- All existing arrow behavior (draw, endpoint-anchor drag, whole-arrow move, undo/redo) is unchanged.

## UX patterns / interaction notes

- **Two interaction modes on box-shaped annotations:** *draw/create* mode (drag out a new annotation)
  vs. *select* mode (click an existing annotation to select it and reveal resize handles). Selecting
  is distinct from creating — clicking in select mode never starts a new annotation.
- **Resize-handle interaction:** a single shared `Konva.Transformer` is attached to the selected box
  node only; deselecting (click empty canvas, Escape, or switching tools) detaches it. `rotateEnabled:
  false` for v1 — only move + resize, no rotation handle.
- **One shared transformer instance**, reused across box subtypes — not one transformer per tool. The
  w1 text-box and w2 rectangle tools attach to the same helper rather than rolling their own.
- Visual styling of box annotations (fill/outline/text colors, handle theming) is **deferred to w1**;
  this feature ships only the default `Konva.Transformer` handle chrome and the geometry mechanism.

## Acceptance criteria

- [ ] The editor's internal `model` represents arrows AND at least one box-shaped annotation primitive
      carrying `{x, y, width, height}` geometry (top-left origin, stage/CSS px in the `meta.viewport`
      coordinate space `{w,h,dpr}` already on the record).
- [ ] On ✓ Done, the editor→background resolve payload carries the existing lossy `annotations`
      projection **unchanged** AND a new **additive** lossless `model` field representing every
      annotation (arrows + box-shaped). Envelope **ratified & frozen** (STORIES_LOCKED) as
      `{ version: 1, items: [ {id,type:"arrow",x1,y1,x2,y2} | {id,type:"box",x,y,width,height} |
      {id,type:"text",x,y,text} ] }`; `items` are plain JSON and are stored **opaquely** so w1/w2
      box-subtype fields survive with zero backend change.
- [ ] The lossy `annotations` projection and the upstream `/report/save` payload are **byte-for-byte
      identical** to pre-feature output for the same set of annotations — same field names, same
      coordinate rounding (`Math.round`), same `meta.viewport`. The only new field on the resolve
      payload is `model`.
- [ ] `background.js` stores the lossless `model` on the per-screenshot record in the local in-progress
      report store (e.g. `screenshots[].model`), and does **not** add `model` to the upstream
      `/report/save` payload.
- [ ] A **select mode** exists, distinct from draw/create: clicking a box-shaped annotation in select
      mode selects it and attaches a single shared `Konva.Transformer` showing resize handles
      (`rotateEnabled: false`); exactly one transformer is ever attached at a time.
- [ ] Drag-resizing or moving a selected box via the transformer writes the new `{x,y,width,height}`
      back to that `model` item and commits a `snapshot()`, so the change participates in undo/redo.
- [ ] The shared transformer move/resize is exposed as an internal `editor.js` helper that the w1
      text-box and w2 rectangle tools attach to — a single shared mechanism, not one per tool.
- [ ] **Round-trip identity:** persisting the `model` then reloading it back into the editor
      reconstructs box + arrow annotations with no geometry or content drift (`model → persist → load →
      model` is identity).
- [ ] Existing arrow behavior is preserved with **no regression**: arrow draw, endpoint-anchor
      drag/edit, whole-arrow move, undo, and redo all behave exactly as before.
- [ ] No new editor page/tab, no change to capture, no change to the localhost-only guard, and no
      report-store re-keying (that is w0-per-target-reports).
- [ ] **Malformed-item render tolerance (hydration):** hydrating a structurally-valid `model`
      (`version:1`, array `items`) whose item fields are numerically hostile
      (`NaN`/`Infinity`/`1e308`/wrong-type geometry) renders **without throwing or emitting a console
      error** — bad items are skipped or coerced at the render boundary (`render()`/`renderBox`/
      `renderArrow`) — **and** a pathological model (oversized item count or multi-megabyte `text`) is
      **bounded** at render (item-count cap + text-length cap) so it cannot hang or DoS the editor, while
      `deserializeModel`'s **opaque item pass-through stays unchanged** (forward-compat for w1/w2 subtype
      fields). _[promoted from the security-architect LOW on STORY-fe-004 — w2-screenshot-gallery will
      re-open arbitrary stored models through this exact path.]_

## In scope

- Internal `model` gains a **box-shaped annotation primitive** carrying `{x, y, width, height}`
  geometry (top-left origin, stage/CSS px at the capture viewport, `meta.viewport.{w,h,dpr}`),
  alongside the existing arrow item.
- On commit, `editor.js` persists the **full internal `model` losslessly** in the editor→background
  resolve payload (new additive `model` field) **in addition to** the existing lossy `annotations`
  projection — the projection is byte-for-byte unchanged.
- `background.js` stores the lossless `model` on the per-screenshot record in the local in-progress
  report store so a stored screenshot can later round-trip back into the editor exactly.
- A single shared **`Konva.Transformer`-based move/resize mechanism** for box-shaped annotations,
  exposed as an internal helper the text-box (w1) and rectangle (w2) tools reuse.
- A **select mode** in which a box-shaped annotation can be clicked to select and shows resize handles,
  distinct from the create/draw interaction.
- Round-trip identity: `model → persist → load → model` reconstructs box and arrow annotations with no
  geometry/content loss.
- Existing **arrow draw / endpoint-edit / move / undo / redo behavior is preserved** (no regression).

## Out of scope

- The lossy projection schema and the upstream `/report/save` payload are **unchanged** — the
  downstream report→defects consumer sees no difference. The lossless `model` is persisted in the local
  in-progress store only.
- **Text auto-fit / wrap / styling** (white fill, red outline, black text, capped font auto-size,
  double-click-to-edit semantics) — that is **w1-text-box-autofit**, built on this foundation.
- **The rectangle tool** (user-facing red-outline rectangle) — that is **w2-rectangle-tool**.
- **Toolbar drag + annotation-visibility toggle** — that is **w1-draggable-toolbar-toggle**.
- **The popup gallery / re-open / delete UI** — that is **w2-screenshot-gallery** (this feature only
  guarantees the persisted `model` that feature will consume).
- **Rotation** of box annotations — the shared transformer ships with `rotateEnabled: false` for v1;
  the geometry contract reserves no rotation field.
- No new editor page/tab; no change to capture or the localhost-only guard; no report-store
  **re-keying** (that is w0-per-target-reports — coordinate so the per-screenshot `model` field
  survives the re-keyed store).

## E2E test spec (written by Product Owner)

These run against the in-page content-script editor via the browser-tester's Playwright harness; the
assertion targets are the editor→background resolve payload and the stored per-screenshot record in the
local in-progress report store (an extension service-worker store — there is no login screen and no page
reload involved, so no re-auth step applies to the round-trip).

### Test: arrow-only Done emits a byte-identical lossy projection (no regression)

**Given** the in-page editor is open on a captured localhost screenshot and a reproducible fixture of two
arrows drawn at known coordinates (no box-shaped annotations)
**When** the dev draws those arrows and clicks "✓ Done"
**Then** the resolve payload's `annotations` array **`deepEquals`** the frozen expected fixture
`[{ id, type:"arrow", from:[<round x1>,<round y1>], to:[<round x2>,<round y2>] }, …]` — identical field
names, order, and `Math.round` coordinates in the `meta.viewport.{w,h,dpr}` space — **and**
`Object.keys(resolvePayload).sort()` differs from the pre-feature key set by exactly the one added key
`"model"` (nothing else added, removed, or reshaped) — **and** the subsequent `/report/save` body's
`screenshots[0]` key set is **exactly** the 9 frozen projection fields
(`url,title,captured_at,viewport,original_png_b64,annotated_png_b64,annotations,console,network_failures`)
with **no** `model` key (upstream payload byte-identical to pre-feature).

### Test: existing arrow interactions are preserved

**Given** the editor is open with one arrow already drawn
**When** the dev drags an arrow endpoint anchor to a new position, then drags the whole arrow body,
then presses Undo twice and Redo once
**Then** each interaction behaves exactly as in the current editor — the endpoint follows the anchor,
the arrow moves as a unit, and undo/redo step through the `snapshot()` history correctly — with no
console errors.

### Test: box draw → select → resize updates geometry and is undoable

**Given** the editor is open and one box-shaped annotation has been drawn
**When** the dev switches to select mode, clicks the box (Transformer handles appear), drags a corner
handle to enlarge it, then presses Undo
**Then** after the resize the box's `model` item reflects the new `{x, y, width, height}`, exactly one
shared `Konva.Transformer` is attached to the selected node (`rotateEnabled: false`), and Undo restores
the box to its pre-resize geometry (the resize committed a `snapshot()`).

### Test: lossless model round-trips through persistence (model → persist → load → model)

**Given** the dev has drawn one arrow and one box-shaped annotation and resized the box in select mode
(producing a known `{x,y,width,height}`), then clicked "✓ Done" — call the emitted resolve payload `done1`
**When** `done1.model` is stored at `screenshots[].model` (via ADD_SCREENSHOT), read back from the local
in-progress report store, re-sent into a fresh editor via ANNOTATE `{ image, model }`, and that editor is
immediately committed with "✓ Done" — call the second emitted payload `done2` (no page reload / no
re-login: the store is the extension's own service-worker IndexedDB, which is not auth-gated)
**Then** the stored record carries BOTH `annotations` (the lossy projection) AND `model`
(`{ version:1, items:[…] }`); **`done2.model.items` `deepEquals` `done1.model.items`** — the arrow
endpoints and the box `{x,y,width,height}` survive verbatim with zero geometry/content drift, so
`model → persist → load → model` is identity; **and** immediately after hydration Undo is a no-op (the
hydrated state is the undo baseline).

### Test: malformed-item hydration renders without throwing (render-boundary robustness)

**Given** a structurally-valid persisted `model` — `{ version:1, items:[…] }` — carrying both
numerically-hostile geometry (e.g. `{type:"box", x:NaN, y:0, width:"120", height:Infinity}`) **and** a
pathological payload (an item with a multi-megabyte `text` and/or an `items` array far above any sane
annotation count) alongside a well-formed arrow
**When** the editor is opened via ANNOTATE `{ image, model }` with that payload
**Then** the editor mounts and `render()` completes (does **not** hang) with **no thrown exception and no
console error** — malformed-geometry items are skipped/coerced, the rendered item count and `text` length
are **bounded by the render-boundary cap**, and the well-formed arrow renders normally — while
`deserializeModel` is unchanged (items still pass through opaquely). _[proves the STORY-fe-004 render-guard
AC promoted from the security-architect LOW; Konva-render-dependent → browser-tester E2E lane, not a
`node --test` case.]_

### Motion E2E

`Motion E2E: n/a` — `frontend_lane: N/A`, `skip_ui_designer: true`. This is a mechanism refactor of a
vanilla-JS Konva canvas editor with no project component-library motion tokens. The only new visible
affordance is standard `Konva.Transformer` resize-handle chrome, which appears on selection without a
branded animation/transition. Animated text/box styling is owned by w1-text-box-autofit.

## Stories (populated by architects)

Listed in dependency/execution order (the `fe-005 → do-001 → fe-003 → be-001 → fe-004` chain plus the
independent box + transformer stories). All `approved` after PO arbitration 2026-06-19.

- [ ] STORY-fe-001 — Box annotation primitive: model item, render, draw tool (frontend-engineer) · depends_on: []
- [ ] STORY-fe-005 — Pure model-transform module + node:test (serialize/project/deserialize) (frontend-engineer) · depends_on: [STORY-fe-001]
- [ ] STORY-do-001 — Register editor-model.js content script in manifest (devops-engineer) · depends_on: [STORY-fe-005]
- [ ] STORY-fe-002 — Shared Konva.Transformer move/resize + box select mode (frontend-engineer) · depends_on: [STORY-fe-001]
- [ ] STORY-fe-003 — Wire finish() serialize via pure module (projection frozen) (frontend-engineer) · depends_on: [STORY-fe-001, STORY-fe-005, STORY-do-001]
- [ ] STORY-be-001 — Persist lossless editor model on screenshot record (backend-engineer) · depends_on: [STORY-fe-003]
- [ ] STORY-fe-004 — Model hydration on editor open via pure deserializeModel (frontend-engineer) · depends_on: [STORY-fe-001, STORY-fe-003, STORY-fe-005, STORY-do-001, STORY-be-001]
- [ ] STORY-db-001 — Sentinel: no database changes (database; pruned at plan-lock) · depends_on: []

## Defects (populated as found)

- (none yet)

## No-work domains

Domains an architect explicitly decided needed no work for this feature. The sentinel stories that recorded these decisions were pruned at the end of `/mat_write_feature`; the rationale is preserved here.

- **database** — **No database changes required for this feature.**

## History

2026-06-19T04:15:17Z — orchestrator: status: 'planned' -> 'in-progress' (started via /mat_implement_feature (BOSS-mode))
2026-06-19T15:01:25Z — BOSS: status: 'in-progress' -> 'released' (PR #1) (Wave 0 released via PR #1 (merge 5526403); BOSS-coordinated wave landing; node --test 56/56)
