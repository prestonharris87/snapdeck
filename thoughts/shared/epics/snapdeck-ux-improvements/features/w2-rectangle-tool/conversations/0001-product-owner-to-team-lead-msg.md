---
sequence: 0001
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:26:03Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

✅ **w2-rectangle-tool feature.md (Shape B) on disk.** Going idle / staying warm for later mode transitions (arbitrate, finalize).

**Sections written** (all required H2 present): Summary · User-facing behavior · UX patterns/interaction notes · Acceptance criteria (11) · In scope · Out of scope · E2E test spec (6 scenarios + Motion E2E) · Stories (empty placeholder) · Defects (empty placeholder). Frontmatter preserved (`status: planning`, `depends_on: [w0-editor-foundation, w1-text-box-autofit]`, `frontend_lane: N/A`).

**AC count: 11.** Grounded in actual released source (read `editor.js` renderBox/draw-preview/toolbar, `editor-model.js` projectAnnotations, `editor.model.test.mjs:88-101`), not from memory.

**E2E: 6 specs** — draw-red-rect · sub-threshold-reject · select/move/resize · projection-reaches-/report/save (arrow byte-identical) · lossless round-trip · render-guard malformed-item. **Motion E2E: n/a** (Konva surface, no component-library motion tokens — matches every released w0/w1 sibling; justified inline). Round-trip specs carry an explicit note that the testing.md hard-refresh/re-login gotcha does NOT apply here (ANNOTATE re-open path, no login screen).

**Scope ambiguity flagged for architects** (carried into an `ARCHITECT NOTES` HTML comment at the bottom of feature.md so it doesn't render but is in front of them):
1. **#1 RISK — downstream `/report/save` consumer tolerance.** The projection feeds the out-of-repo Snapdeck **controller** (`deck up`, outside `extension/`). Adding a new annotation type means that consumer must tolerate it. **Architects must VERIFY tolerance before locking the projection contract; if cross-team/out-of-repo → escalate to BOSS.** This is the biggest open item.
2. **Open decision: projected `type` string** (`"rect"` vs `"box"`). I locked the MODEL/wire `type` literal to `"box"` (back-compat for persisted records) but left the *projection* `type` string for architects to ratify with the consumer above.
3. **Frozen released-test coupling.** `editor.model.test.mjs:88-101` assert box-is-EXCLUDED; the projection change MUST update them in the same diff or the 121/121 `node --test extension/*.test.mjs` suite regresses. **Flag: assign test-file ownership to the story that edits `projectAnnotations`** (editor-model.js's test file) — recurring no-owner test-update trap on this epic.

No new constraints invented beyond scope.md. Single-feature decompose — no epic scope-check performed (as instructed). Ready for the architect batch; ping me for arbitrate when stories land.
