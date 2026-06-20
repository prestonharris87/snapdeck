---
sequence: 0253
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:29:27Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

✅ **w2-screenshot-gallery** feature.md expanded **in place** to full Shape-B. Frontmatter preserved byte-for-byte (`status: planning`, `wave: 2`, `depends_on: [w0-per-target-reports, w0-editor-foundation]`, `frontend_lane: N/A`, `skip_ui_designer` semantics honored). `scope_check`: **not an epic** — cohesive popup gallery + 3 message handlers, proceeded normally.

**Sections written:** Summary · User-facing behavior · UX patterns / interaction notes (incl. ASCII grid + empty-state sketch) · Acceptance criteria · In scope · Out of scope · E2E test spec · Stories (placeholder) · Defects (`- (none yet)`).

**Counts:** **12 acceptance criteria** · **7 E2E scenarios** + **Motion E2E n/a** (justified: vanilla popup, no motion tokens, consistent with every released sibling).

**Scope constraints honored:**
- §1 verbatim re-open seam — pinned `ANNOTATE {image, model}` → `openEditor` → `deserializeModel` → guarded `render()`, inherits `RENDER_ITEM_CAP=500`/`RENDER_TEXT_CAP=10000` + text-box clamp, **no bypass** (AC + out-of-scope guard).
- §2 lossless = **model-byte** — every "lossless/exact" AC + E2E framed as `deepEquals(model.items)` / `serializeModel` envelope identity; cross-font pixel identity explicitly out of scope.
- §3 bounded arbitrary-model re-open — AC10 + dedicated **browser-tester Konva-lane** E2E (NaN/Infinity geom + >cap items/text); caps-not-weakened is explicit.
- §4 GC — Delete folds in cleanup; empty-report → clears the record (AC9 + dedicated E2E).

**Two things to flag (one is a real scope ambiguity to relay to the FE-architect):**

1. **GC mechanism contradiction.** scope.md says *"clear the `report:<port>` record (`clearReport(port)`) **rather than** persisting an empty `{note, screenshots:[]}`"* — but the **released `clearReport(port)` DOES persist `{note:"", screenshots:[]}`** (`background.js:48`, `setReport(EMPTY_REPORT())`); it does **not** delete the IDB key. Those two clauses contradict. I wrote AC9 to the robust observable (*no populated/stale entry; `getReport(port).screenshots.length===0`; count 0*) and flagged the **key-remove (new `idbDelete`/`deleteReport`) vs. empty-record-write** choice as an **architect lock**. The architect should pick — and if "no empty entry persisted" is the true intent, that needs a new helper, not `clearReport`.

2. **Re-edit meta/buffers preservation (load-bearing, easy to get wrong).** On Done the **released editor re-emits the HOST tab's live `console`/`network` (`__snapdeckBuffers`) and a fresh `meta` (url/title/captured_at/viewport from `location`/`document`/`new Date()`)** — NOT the originally-captured shot's. So the replace-on-Done handler MUST preserve `original`+`console`+`network`+meta **from the pre-edit record** and take only `model`+`annotated`+`annotations` from the editor response, else every re-edit corrupts the record. Pinned as AC + the central round-trip E2E assertion so FE-architect/engineer can't miss it.

No cross-domain tension to probe yet (single-domain FE feature; BE/DB/DO will sentinel). I'll surface tension-pair probes at arbitrate if the architect room converges too easily.

Going **idle / staying warm** — ready for screenshot-spec, architect-standby, arbitrate, and security-finalize mode transitions.
