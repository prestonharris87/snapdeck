---
sequence: 0267
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:47:41Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**w2-screenshot-gallery — FE decompose COMPLETE.** 3 stories, all **substantive** (no sentinels — this is the substantive domain).

**Story list** (`stories/STORY-fe-00N.md`):
- **fe-001** — *Gallery fetch + delete report-screenshot handlers + GC* — new `GET_REPORT_SCREENSHOTS` + `DELETE_SCREENSHOT` zero-port-arg handlers in `background.js`; owns the GC lock. node --test (`background.gallery.test.mjs`). `depends_on: []`.
- **fe-002** — *Re-open + preserve-from-record re-save handler* — new `REOPEN_SCREENSHOT` handler; owns the corruption-risk re-save lock + bounded arbitrary-model (security). node --test (`background.reopen.test.mjs`) + bt Konva E2E. `depends_on: [STORY-fe-001]` (shared `handle()`-switch serialization, same warm engineer — not functional).
- **fe-003** — *Popup thumbnail grid + delete-confirm UI* — `popup/*` grid + inline two-state delete-confirm + click-to-reopen. bt Playwright E2E (no node lane — DOM-bound). `depends_on: [STORY-fe-001, STORY-fe-002]` (consumes all 3 messages).

**Peer messages SENT: 3** (min-floor met) — to `backend-architect` (controller no-op + background.js is FE-owned), `database-architect` (IndexedDB is FE; no server DB), `devops-architect` (no manifest/build change).
- **DB + DevOps already CONFIRMED** — both landed `[sentinel]` lines in feature.md § Stories.
- **backend-architect ack PENDING** — no reply yet. Ownership is strongly grounded regardless (data-model.md § w0-per-target-reports ownership correction assigns `background.js`+IndexedDB to FE; w0 STORY-be-001 sentinel precedent; my lessons). I'll **relay BE's confirmation** when it lands; if BE somehow claims controller work, FE stories are cheap to revise.

**Two load-bearing locks RESOLVED:**
1. **GC lock → add `deleteReport(port)` via new `idbDelete(key)`**, called ONLY by the new `DELETE_SCREENSHOT` when a delete empties the report → truly removes the `report:<port>` key (bounds keyspace, the literal GC mandate). Released `clearReport` + its `SAVE_REPORT`/`CLEAR_REPORT` call sites stay UNCHANGED. Observably safe: `getReport(missing key)` → `EMPTY_REPORT()`, count 0 — identical to the empty-record path, zero badge-consumer regression. (Rationale in fe-001.)
2. **Re-save preserve-from-record → in-place field update**, NOT an `addScreenshot`-style record rebuild. `resaveScreenshot` re-reads the stored record and overwrites ONLY `model`/`annotated`/`annotations` from the editor response, PRESERVING `original`/`console`/`network`/`meta` from the pre-edit record by construction. Pinned with a dedicated no-regression unit assertion (`resave_preservesCaptureFields_takesOnlyEditorModel`) — a naive rebuild would corrupt the record with the re-edit host tab's FRESH meta + LIVE buffers (`editor.js:489-501`). (Contract in fe-002.)

Re-open host = the **current target (active) tab**; no-host path = PING pre-flight → graceful reload-error surfaced in the popup (mirrors `background.js:280`); busy = `{cancelled:true,busy:true}` silent no-op. Security: arbitrary-model re-open bounded by the **inherited** released render caps — no bypass/fork/re-implement (Phase-7 STRIDE re-confirm flagged in fe-002).

Going idle, staying warm for Phase 6 arbitration.
