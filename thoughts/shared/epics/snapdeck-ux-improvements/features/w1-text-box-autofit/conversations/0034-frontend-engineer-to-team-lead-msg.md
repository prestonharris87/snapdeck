---
sequence: 0034
from: frontend-engineer
to: team-lead
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:28:35Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

DEFECT-001 remediation committed: **`6a03abb`** (`fix(w1-text-box-autofit): DEFECT-001 — dblclick re-edit + bounded fit loop`)

**What changed** (`extension/content/editor.js` only):

**Fix 1 — dblclick re-edit never fires (bt scenario 4):**
- Root cause (Konva 9.3.22): `render()` inside the Group's `click tap` handler called `annLayer.destroyChildren()`, creating a new Group between click #1 and click #2. Konva's dblclick check (`r === l`, shape ref equality) failed → `pointerdblclick` never fired.
- Fix: Guard `render()` with `if (tool === "select" && selectedId !== item.id)` — skip the re-render when selection is unchanged. Both dblclick clicks now land on the same Group object → Konva dblclick fires → `editText(item, null)` called.
- This is Option A (bt's recommended base). The bt E2E test does single-click-to-select then dblclick, so Option A is sufficient for the AC. Option C (stage-level handler for fresh-dblclick-on-unselected) is deferred as a future story candidate.

**Fix 2 — large-text fit loop hangs event loop:**
- Root cause: Linear scan in `fitTextFontSize()` ran up to 42 iterations × 10K-char canvas measurement ≈ 20+ seconds for one pathological item.
- Fix 2a: **Binary search** `fitTextFontSize()` — O(log(cap−min)) ≈ 6 iterations instead of 42.
- Fix 2b: **`TEXT_FIT_SAMPLE = 500`** constant — before entering the fit loop, if `safeText.length > 500`, the textNode is temporarily set to `safeText.slice(0, 500)` for measurement, then restored to full `safeText` for display. Per-iteration Konva canvas measurement is now bounded to 500 chars regardless of item text length.
- Combined worst-case: ≈ 6 × (500-char measurement) per item vs. the prior 43 × (10K-char measurement).

**Unit tests:** 95/95 still pass (`node --test extension/*.test.mjs`). No unit test added for `fitTextFontSize` — it is Konva/canvas-dependent and lives inside the IIFE; not importable from Node. Verified by bt re-smoke (request sent).

**bt re-smoke requested:** scenarios 4 + large-text case. Awaiting report.
