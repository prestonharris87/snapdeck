---
sequence: 0273
from: team-lead
to: product-owner
step: inline-msg
run_id: run-20260620-161818-88519
timestamp: 2026-06-20T17:00:04Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Switch to **mode: arbitrate**. Read every story under `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/stories/` — including the `## Contrarian Findings` blocks and the feature-level `stress-test.md` — and arbitrate. Then promote each story's frontmatter `status: pending → approved` and reply with a summary. The 4 architects are warm/idle on the team if you need a clarification ping.

Inputs:
- stories_directory: `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/stories/`
- scope_file_path: `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/scope.md`
- feature_md_path: `thoughts/shared/epics/snapdeck-ux-improvements/features/w2-screenshot-gallery/feature.md`

**The one BLOCK you MUST resolve — fe-002 Finding 1 (stale-index re-save silently corrupts the wrong screenshot):**
- Mechanism (contrarian-verified vs released code): re-open/delete/re-save address screenshots by array **index**, but records carry **no stable id** (`background.js:284-295`). The browser-action popup IS re-openable while the in-page editor overlay is live (the `editor.js:15` `active` guard blocks only a 2nd ANNOTATE, not the SW `DELETE_SCREENSHOT` handler). So: re-open editor on a shot → re-open popup → confirm a Delete at a ≤ index → splice shifts the array → editor `Done` → re-save overwrites a **bystander** record. Silent corruption, no throw/console-error.
- **My strong steer: RESOLVE BY REVISION to stable-identity addressing — do NOT accept-the-risk.** This is silent data corruption, the fix is cheap and ALREADY IN SCOPE (the message API was spec'd "by index/**id**"), and it needs **no released-code change**: synthesize a stable identity from already-stored fields (`captured_at` + `original` tiebreak) for `GET_REPORT_SCREENSHOTS` to emit and `DELETE_SCREENSHOT`/`REOPEN_SCREENSHOT`/re-save to address by. Fix site = **fe-001** (owns the fetch/projection → emit identity + address delete by it), **fe-002** (re-save + reopen by identity; also resolves the now-false "popup closed while overlay open" claim), **fe-003** (popup passes identity, not index). An `## Acknowledged Risk` block is the wrong disposition here — only fall back to it if you find the identity-fix genuinely infeasible (you won't). Write `## Revisions` blocks documenting the decision on each affected story; if you revise, the architect's `depends_on` graph is unaffected (still fe-001 ← fe-002 ← fe-003).

**The concern — fe-001 Finding 1:** it's the *fix site* for the block (it owns the projection that must emit the stable identity). Fold it into the same revision.

**Info findings (your disposition, non-gating):**
- fe-003 F2 (unbounded full-res thumbnail payload — no count cap/downscale): worth a cheap mitigation (CSS-scaled `<img>` is already small in DOM, but the data-URL payload is full-res; consider noting a downscale/lazy or accepting for v1). Your call.
- fe-001 F2 (GC removes the key only on delete-to-empty; Save/Clear still write empty records): precision fix — scope the GC claim to "delete-to-empty removes the key" so it's not overstated.
- fe-002 F2 (verbatim `resp.model` persistence; bounded-at-render ≠ bounded-envelope): leave for the **security-architect Phase 7** STRIDE — note "don't weaken the inherited caps."
- fe-002 F3 (active-tab/multi-window divergence): info; note as a known edge or fold a guard if cheap.

When done, reply with: stories revised, how you dispositioned the block (revise vs acknowledge), info dispositions, and confirm all stories promoted to `approved`. Then go idle (stay warm — next is security-finalize after Phase 7).
