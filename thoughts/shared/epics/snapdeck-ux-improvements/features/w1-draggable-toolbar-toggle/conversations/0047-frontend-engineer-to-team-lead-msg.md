---
sequence: 0047
from: frontend-engineer
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T16:40:11Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

**STORY-fe-003 complete** — commit `e4816cf`

**Files changed:** `extension/content/editor.js` only (+30 lines, `overlay.css` untouched per `files_not_modified`).

**Changes in 5 targeted edits:**

1. **`buildToolbar()`** — `sepVis` separator + `toggle = btn("Hide", ...)` inserted between Select and sep1. Final toolbar order: `[grip][➤ Arrow][T Text][Box][⤢ Select][sepVis][Hide/Show][sep1][↶ Undo][↷ Redo][sep2][✓ Done][✕ Cancel]`
2. **`buildToolbar()` api** — `onToggleVisibility: null` + `setVisibility(shown)` method (flips label + `.snapdeck-active` class; reuses existing CSS — no new CSS).
3. **`buildToolbar()` onclick** — `toggle.onclick` wired through `api.onToggleVisibility`.
4. **`openEditor()` toolbar wiring** — `var annShown = true;` view-state flag (never in model/past/future); `bar.onToggleVisibility` handler flips `annLayer`/`selectLayer`/`cursorLayer` via `ec.nextVisibility` + `ec.layerVisibility`; **no `snapshot()`, no `model` mutation, no `render()`**; `bar.setVisibility(true)` init.
5. **`finish()`** — export guard: `annLayer.visible(true); selectLayer.visible(true); cursorLayer.visible(true);` before `stage.toDataURL()` — no-op in common path; ensures Done-while-hidden exports annotated PNG. Cancel branch returns before this line (guard is Done-path only, per contrarian verified-sound note).

**Export guard reasoning:** `render()` at line 392 rebuilds annotation canvas contents even when layers are hidden (Konva draws to the layer's offscreen canvas regardless of `visible()`). Export guard then restores visibility. `toDataURL()` then composites all visible layers → fully annotated PNG, byte-identical to never-toggled path.

**Test results:**
```
node --test extension/*.test.mjs → 88/88 pass, 0 fail, 0 regression
```

**Smoke:** dev server not running — deferred to Phase 5 browser-tester E2E.

**All 3 FE stories (fe-001, fe-002, fe-003) now implemented. Idle — ready for Phase 5 gates.**
