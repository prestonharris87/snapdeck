---
sequence: 0001
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:14:34Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
---

✅ **decompose-one-feature complete** — `w1-draggable-toolbar-toggle/feature.md` overwritten (stub → full Shape B), grounded entirely in the locked scope.md (verified against HEAD 6e42464). No invented ACs/scope.

**Path:** `thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/feature.md`

**H2 sections present (dashboard contract, in order):**
Summary · User-facing behavior · UX patterns / interaction notes · Acceptance criteria (12 `- [ ]`) · E2E test spec (written by Product Owner) · In scope · Out of scope · Stories (populated by architects) — empty · Defects — empty.

**E2E spec:** 4 Given/When/Then scenarios from the scope's coverage hints — (1) grab-handle drag repositions toolbar, no annotation/selection side-effect; (2) position persists in `chrome.storage.local` + restores clamped-to-viewport on next `openEditor()`; (3) toggle hides `annLayer` **and** `selectLayer` chrome non-destructively with zero undo-history impact; (4) pointer-isolation — handle+toggle never leak into the Konva stage. Ends with `Motion E2E: n/a` + one-line reason (vanilla-JS Konva chrome, no component-library motion tokens; consistent w/ released w0-editor-foundation). Per doctrine I read testing.md § E2E-gotchas before the persistence specs — documented inline that the SPA hard-refresh→re-login gotcha is **inapplicable** (MV3 in-page editor, no login screen; "re-open" = fresh `openEditor()`, `chrome.storage.local` persists with no re-auth).

**Frontmatter:** `status: planned`, `frontend_lane: N/A`, added `skip_ui_designer: true` (matches scope.md + released w0 sibling), `depends_on: [w0-editor-foundation]`, `wave: 1`, `visual_references: []`, `last_run_id: run-20260619-042600-10898`.

⚠️ **One flag (not a blocker), your call:** you instructed `status: planned`, which I set. Per the template lifecycle (`planning` post-feature-scope → `planned` post-`/mat_write_feature`) and my w0-editor-foundation lesson, decompose is the *first* step of `/mat_write_feature` (architects + security haven't run), so the lifecycle-correct mid-flight value is `planning`, with `planned` stamped after security-finalize. If you intended that lifecycle, say the word and I'll revert to `planning`; otherwise I'll leave it `planned` as instructed.

**Story-domain foresight (for architects):** FE-heavy — all real work is in `editor.js` (toolbar grab-handle DOM-drag + position serialize/clamp; `bar.onToggleVisibility` + `annLayer`/`selectLayer` visibility flip) + a small `overlay.css` touch for the handle/toggle affordance + cursor. Likely a **pure-logic module** extracted for position-clamp/serialize + toggle visibility-state (`*.test.mjs`, mirroring `editor-model.js`), per scope's test convention. Expect **BE + DB sentinels** (no server/schema work — position is `chrome.storage.local`, `storage` permission already granted). **DO:** likely a sentinel UNLESS the architect extracts a new content-script file (then a manifest-registration story like w0's STORY-do-001) — flag at STORIES_LOCKED. Scope also notes implement is **BOSS-serialized with w1-text-box-autofit** (both edit `editor.js`, distinct regions) — surface line-level overlap at STORIES_LOCKED.

Going idle — not shutting down. Awaiting your next mode transition.
