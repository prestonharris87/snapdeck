---
sequence: 0193
from: team-lead
to: fe
step: inline-msg
run_id: run-20260619-161353-46977
timestamp: 2026-06-19T16:36:45Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

fe-002 validated. Now implement **STORY-fe-003** — non-destructive annotation visibility toggle (the final story).

Story: thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/stories/STORY-fe-003.md — read it + feature.md ACs in full. Rebase on your fe-002 `buildToolbar()` additions (commit 76e97c0; `bar.el`/`bar.grip` exist; you add `onToggleVisibility`/`setVisibility` — no collision).

**Edits:** `extension/content/editor.js` (+ overlay.css if the toggle button needs styling).

Key requirements (story authoritative):
- Add a **toggle button** to `buildToolbar()` via the existing `btn()` pattern, wired through a new `bar.onToggleVisibility` callback.
- Toggle flips visibility of **all 3 overlay layers — `annLayer`, `selectLayer`, AND `cursorLayer`** (per PO arbitration: a truly "raw" view) — `bgLayer` stays visible. Use `window.__snapdeckEditorChrome.nextVisibility` / `layerVisibility` for the state.
- **Non-destructive / view-only**: NEVER mutate `model`, NEVER destroy/recreate nodes, NEVER call `snapshot()` — toggling must NOT add an undo/redo step (undo history identical before/after). Reuse the existing `annVisible`-style flag; pure `layer.visible()` + redraw.
- When hidden, selection chrome (transformer on `selectLayer`) is hidden too so no handles float; restored on show.
- **Export guard (Done-while-hidden)**: in `finish()`, BEFORE `stage.toDataURL()` (editor.js:301), restore all 3 overlay layers to visible so the saved/annotated PNG includes the annotations — byte-identical to the not-hidden case. The cancel path returns before toDataURL (no guard needed there, per contrarian). Also handle the new feature.md E2E "Done while hidden saves a PNG WITH annotations".
- Toggle state is NOT persisted (resets to shown each open).
- Pointer isolation: the toggle button is a normal toolbar button (click), must not start an annotation.

Constraints: frozen w0 model/editor-model.js untouched; NO regression to arrow/box/text/undo/redo. Story ACs FROZEN (append `## History` + `## Engineer Notes` only). Run `node --test extension/*.test.mjs` (no regression).

**Atomic pathspec commit** (`git commit -- extension/content/editor.js [overlay.css] <story md>`). No push. Reply with diff summary, test results, the export-guard handling, and `## Engineer Notes`. Then go idle — this is the last story; I'll run the Phase-5 gates next.
