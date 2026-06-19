---
sequence: 0019
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:27:49Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature: w1-draggable-toolbar-toggle — frontend decompose COMPLETE. Going idle (staying warm for PO Phase 6 arbitration).

## Stories written (3)
- **STORY-fe-001** — *Pure editor-chrome module: clamp + pos serialize + visibility-state + node tests* (effort 2, greenfield). New file `content/editor-chrome.js` (`__snapdeckEditorChrome`, dual-consumable UMD mirroring `editor-model.js`) + the one feature-distinct test `editor.chrome.test.mjs`. `depends_on: []`.
- **STORY-fe-002** — *Toolbar grab handle — DOM drag + persisted position* (effort 3, substantive). Edits `editor.js` + `overlay.css`: CSS-painted grip, DOM-drag, first-drag `translateX(-50%)`→`left/top` conversion, `chrome.storage.local` persistence, clamp-on-open. `depends_on: [STORY-do-001]`.
- **STORY-fe-003** — *Annotation visibility toggle — non-destructive layer flip* (effort 2, substantive). Edits `editor.js`: toggle button + `bar.onToggleVisibility`, flips `annLayer`/`selectLayer` visibility, no snapshot/no model mutation. `depends_on: [STORY-do-001, STORY-fe-002]`.

## Dependency edges (DAG)
`fe-001 → do-001 → fe-002 → fe-003` (mirrors w0's `fe-005 → do-001 → consumers`). do-001 (devops) `depends_on fe-001`. fe-003 also `depends_on fe-002` (intra-file ordering: both edit buildToolbar()+openEditor()). Acyclic.

## New-file vs inline decision
**New pure file** `content/editor-chrome.js` (NOT inlined). The scope's "extract a pure module mirroring editor-model.js + ship one *.test.mjs" requires it (editor.js can't be node-imported — it runs `chrome.runtime.onMessage.addListener` at load). This forces a manifest registration = devops **STORY-do-001** (devops owns it, confirmed). Only manifest touch is one content_scripts js-array entry; `chrome.storage.local` itself needs no manifest change (storage permission already granted).

## Peer messages SENT this run: 4
1. **devops-architect** — new-file-or-inline + manifest registration ownership (→ they wrote STORY-do-001, depends_on fe-001).
2. **devops-architect** — confirmed filename `editor-chrome.js`, authoring story fe-001, existing document_idle isolated-world entry ordered before editor.js.
3. **backend-architect** — confirmed BE sentinel (content-script-side chrome.storage.local, no SW round-trip, ANNOTATE payload frozen). → STORY-be-001 sentinel.
4. **database-architect** — confirmed DB sentinel (chrome.storage.local, not IndexedDB report store / model). → STORY-db-001 sentinel.

## ⚠️ Flag for PO (E2E gap I caught + handled in fe-003)
Hidden coupling: clicking **Done while annotations are hidden** would export a blank-annotation PNG — `finish()`'s `stage.toDataURL` (editor.js:301) rasterizes the hidden `annLayer`, even though the lossless `model` stays intact. fe-003 adds a required export guard (restore `annLayer.visible(true)` before `toDataURL`) + an AC + a validation check + a smoke-test step for it. **The PO E2E specs in feature.md do NOT cover Done-while-hidden** — recommend PO add an E2E asserting the saved PNG includes annotations after a hide→Done. (I did not edit feature.md — PO owns it.)

Cross-domain contract blocks recorded in fe-002/fe-003 bodies citing the conversation thread.
