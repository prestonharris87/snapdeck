---
sequence: 0021
from: backend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:10:41Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**Decompose done — w0-editor-foundation backend (background.js model persistence).**

**Story (1):**
- **STORY-be-001** — *Persist lossless editor model on screenshot record.* Adds one additive property `model: resp.model ?? null` to the `addScreenshot()` push-object literal (`background.js:129-139`), storing the editor's lossless `model` verbatim/opaque on `screenshots[].model`. `saveReport()` whitelist (lines 159-163) untouched → `model` never reaches `/report/save`. `effort: 1`, `diff_estimate: substantive`, `depends_on: [STORY-fe-003]`.

**Agreed `model` wire shape** (locked with frontend-architect):
- Top-level sibling of `annotations` on the `ANNOTATE` resolve payload; `{ version: 1, items: [ {id,type:"arrow",x1,y1,x2,y2}, {id,type:"box",x,y,width,height}, {id,type:"text",x,y,text} ] }`.
- Plain JSON-serializable (no class instances/functions/Konva nodes); **always present** on a non-cancelled w0 resolve (`?? null` is a forward-compat default for pre-FE-003 scripts only).
- Stored **verbatim, no field whitelist** → w1/w2 box subtype fields persist with zero backend change.

**Merge-compat vs w0-per-target-reports (external locked contract, not renegotiated):** orthogonal regions of `background.js` — they re-key `getReport`/`setReport` (lines 34-37); I edit the `addScreenshot()` push literal (lines 129-139). Both stay zero-arg. **Storage-owner lands first; STORY-be-001 rebases on top.** `model` rides inside `screenshots[]` and survives the structured-clone re-key transparently.

**DB:** zero schema work — value-shape change only, no `db.version` bump/migration (confirmed with database-architect; sentinel STORY-db-001). **DevOps:** none (loopback-only, no env vars).

**Dependency direction note:** producer→consumer is FE-003 (serialize) → BE-001 (store) → FE-004 (hydrate). FE-004 `depends_on: [STORY-be-001, STORY-fe-001, STORY-fe-003]`.

**Peer messages sent: 3** across 2 peers / 2 topics:
1–2. → **frontend-architect** (×2): `model` wire-shape contract — field name, presence guarantee, top-level type; then confirmation + my story id + serialize story id request.
3. → **database-architect** (×1): concurrence that `model` is a JS value-shape change (no schema/version bump) + merge-orthogonality note.

Note: I did **not** edit `feature.md`'s Stories list (left to PO/skill to avoid race-write clobber on the shared file). Story file is at `stories/STORY-be-001.md`, `status: pending`.
