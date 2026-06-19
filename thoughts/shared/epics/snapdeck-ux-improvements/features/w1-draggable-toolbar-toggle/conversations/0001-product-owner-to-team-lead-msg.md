---
sequence: 0001
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:16:27Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

feature.md written (Shape B) for w1-text-box-autofit — `features/w1-text-box-autofit/feature.md`. scope_check: single feature, NOT an epic (a text-tool rework on an existing editor, as expected).

**Counts:** 15 acceptance criteria; 5 E2E scenarios + Motion E2E (n/a, justified); all 9 required H2s present in dashboard-contract order, plus an extra `## Critical directives` section preserving the inherited-contract directives verbatim.

**Grounded in real source** (read `editor.js` + `editor-model.js` directly, not just w0 feature.md): the current text tool is click-to-place (`stage.on("click tap")`, fixed red bold `fontSize:18`, no box) — this rewrites it to drag-to-create-a-box + auto-fit/wrap; `attachBoxTransformer(node,item)` (frozen, bakes scaleX/scaleY→width/height on transformend then snapshot();render()), `RENDER_TEXT_CAP=10000`/`RENDER_ITEM_CAP=500`, and the byte-frozen `projectAnnotations` text shape `{id,type:"text",x,y,text}` are all cited concretely.

**E2E coverage** (assertion target = resolve payload `model`/lossy `annotations` + per-screenshot record): (1) draw-a-box auto-fit/wrap (≥2 lines, font ≤ cap, white-fill/red-outline/black-text); (2) commit round-trip — single spec asserts BOTH `done2.model.items deepEquals done1.model.items` (no flatten) AND projection key-set `["id","text","type","x","y"]` (no width/height leak) + no `model` on `/report/save`; (3) resize re-fit + undoable; (4) double-click re-edit vs single-click select; (5) hostile/oversized text-item hydration renders w/o throw/console error (extends w0 fe-004 guard into auto-fit). Motion E2E n/a, consistent w/ released w0 sibling.

**Frontmatter:** preserved `parent_epic`, `slug`, `wave:1`, `depends_on:[w0-editor-foundation]`, `frontend_lane:N/A`; added `skip_ui_designer:true` (matches scope + w0).

**One flag for you:** per your instruction I left `status: stub` unchanged — but it now holds full Shape-B content. Dashboard keys on H2 names (not status) so rendering is fine, but the lifecycle wants stub→planning. Promote when you're ready; I didn't guess.

**No scope ambiguities needing user input** — the only open call (store fitted fontSize vs recompute on render) is explicitly an architect decision per scope.md; my round-trip E2E is robust to either choice. No clarifications.md filed. Going idle.
