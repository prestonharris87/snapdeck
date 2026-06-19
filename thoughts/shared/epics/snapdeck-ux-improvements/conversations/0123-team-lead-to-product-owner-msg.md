---
sequence: 0123
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260619-042600-10898
timestamp: 2026-06-19T15:39:57Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to mode: arbitrate. Read every story under thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/stories/ (incl. each `## Contrarian Findings` block) + the feature-level stress-test.md. Inputs: scope.md, feature.md (same feature dir). The 4 architects + contrarian are warm if you need a clarification ping.

Contrarian result: **0 block** (not gated), **1 concern**, **4 info**. Specific arbitration items:

1) **CONCERN — manifest load-order regression test has no owner** (do-001 Finding 1 / fe-001 Finding 1). do-001 promises a `node --test` assertion that content-scripts load `editor-model → editor-chrome → editor` (so `window.__snapdeckEditorChrome` exists before editor.js consumes it) but parks it in FE-owned `editor.chrome.test.mjs` while declaring only manifest.json in files_modified; fe-001's test list omits it. **Resolve:** assign the order + path-exists case to **fe-001** (FE owns the test file); have do-001 reference it. Document via `## Revisions` on both.

2) **INFO — disposition each consciously** (no rewrite needed unless you judge otherwise; record your call in `## Revisions`):
   - fe-002 async apply-on-open: toolbar paints centered then jumps to stored pos each open (story calls it acceptable). Also ensure the persistence E2E **awaits the async `chrome.storage.local` read** so it doesn't flake.
   - fe-003: when "hidden", the synthetic **`cursorLayer` stays painted** over the raw capture (it's not an annotation, but the AC says "no annotations drawn over it" — decide: accept as-is, or have fe-003 also hide cursorLayer for a truly raw view; trivial either way).
   - fe-003: draw/undo **while hidden** accrues an invisible annotation + undo step (architect marked out-of-scope) — confirm accept.
   - cross-cutting: real editor.js serialization seam with w1-text-box-autofit is **`buildToolbar()`** (both add toolbar buttons + extend the `bar` API), not finish(). No `bar`-field name collision. BOSS serializes implement — just note it.

3) **E2E gap flagged by FE (add to feature.md):** the current E2E specs don't cover **Done-while-hidden**. fe-003 adds an export guard (restore `annLayer.visible(true)` before `stage.toDataURL`) as an AC; add a matching E2E scenario to feature.md's `## E2E test spec` — "hide annotations → ✓ Done → saved/annotated PNG includes the annotations" — so the guard is covered. (Contrarian verified the guard is correct + the cancel path returns before toDataURL — this E2E just locks it in.)

4) do-001 `diff_estimate: mechanical` is correct (one manifest array element, matches released w0 STORY-do-001) — ratify, no change.

When done: append `## Revisions` to touched stories (never silently rewrite), promote EVERY story frontmatter `status: pending → approved` (sentinels be-001/db-001 are trivial promotions), and reply with a summary (stories revised, the concern resolution, info dispositions, the E2E added, any `## Arbitration Block` deadlock). Then go idle — do NOT shut down.
