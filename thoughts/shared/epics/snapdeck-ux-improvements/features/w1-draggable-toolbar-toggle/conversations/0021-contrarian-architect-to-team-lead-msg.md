---
sequence: 0021
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:38:48Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

Phase 5.5 stress-test complete for **w1-draggable-toolbar-toggle**. **No `block` findings** — arbitration is not gated. Counts: **1 concern, 4 info, 0 block.**

**Stories touched (5):** STORY-do-001, STORY-fe-001, STORY-fe-002, STORY-fe-003 (each got a `## Contrarian Findings` block). STORY-be-001 / STORY-db-001 (sentinels) — no findings; their premises don't gate anything.
Feature-level: `…/w1-draggable-toolbar-toggle/stress-test.md`.

**The one concern (most actionable for PO arbitration):**
- **do-001 Finding 1 / fe-001 Finding 1 [concern]** — the manifest **load-order regression test has no owner**. do-001 calls the `editor-model < editor-chrome < editor` ordering "load-bearing, not cosmetic" and promises a `node --test` assertion of it, but puts that assertion in the FE-owned `editor.chrome.test.mjs` while declaring only `manifest.json` in its `files_modified`; fe-001's test list has no manifest-order case. → Owned by neither story. Risk: a future content-script reorder silently makes `window.__snapdeckEditorChrome` undefined and the drag/toggle handlers throw at `openEditor()`-time with no test catching it. Feature still ships correctly today — this is a missing regression net, not a functional defect. **Cheap fix at arbitration:** add the order + path-exists case to fe-001's test list (FE owns the file) and have do-001 reference it. Pick one owner explicitly.

**The 4 info (acknowledge-consciously, no story rewrite):**
- fe-002: async apply-on-open paints centered → jumps to stored position every open (story already calls it acceptable); also flagged the await-the-storage-read requirement so the persistence E2E doesn't flake.
- fe-003 ×2: the toggle hides 2 of 4 Konva layers — `cursorLayer`'s synthetic cursor stays painted over the "raw" capture; and draw/undo-while-hidden accrues an invisible annotation + undo step (acknowledged out-of-scope in the story, surfaced for PO).
- Cross-cutting info: the real `editor.js` serialization seam with `w1-text-box-autofit` is **`buildToolbar()`**, not `finish()` (verified text-box-autofit cites only `:333-365`) — both add toolbar buttons + extend the `bar` API in the same function body; BOSS-serialized, no `bar`-field name collision.

**Independently verified (per the VERIFY rule) against RELEASED HEAD 6e42464** — and these DISMISSED three candidate risks: Done-while-hidden blank-PNG (cancel path returns before `toDataURL` at editor.js:295-298; Done-path guard is correct + non-regressive), pointer-leak (toolbar is a DOM sibling of the stage — structural isolation), and load-order race (globals consumed at `openEditor()` call-time, editor.js:86; UMD wrapper confirmed at editor-model.js:14-21). Full file:line list in stress-test.md § "Claims verified."

**Security:** nothing to escalate — `chrome.storage.local` only, no new permission, no wire-contract change. Noted one item for security-architect's own Phase 7 glance (`parseStoredPos` guards untrusted-storage geometry) in the stress-test summary.

No PO messages were needed (scope was unambiguous). Going idle — staying warm for Phase 6 arbitration; ping me if PO has questions on the concern's mitigation path.
