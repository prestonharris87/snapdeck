---
sequence: 0015
from: frontend-architect
to: main
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:18:47Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Done — both `## Unit tests` sections updated for the HYBRID ruling; every other section left byte-unchanged, no re-arbitration.

**Unit lane added (`node --test`, zero-dep, no package.json):**
- **Test file:** `extension/background.reports.test.mjs` — feature-distinct, will NOT collide with sibling `w0-keyboard-shortcuts`' `extension/background.test.mjs` on the shared `node --test extension/` run.
- **Harness (no source/manifest change):** load `background.js` into a `node:vm` context pre-seeded with hand-written `chrome` (`tabs.query` + capturing `onMessage.addListener` + tolerant `commands.onCommand` no-op) and in-memory `indexedDB` (Map-backed `kv` with get/put counters) stubs — exposes the top-level helpers as directly-callable AND captures the message listener. Respects `files_not_modified` (no `background.js` restructure, no `manifest.json` change).
- **STORY-fe-001 — 12 cases:** port-scoped `getReport/setReport/clearReport` (key `report:<port>`, empty default, **port isolation**, clear-only-that-port); `currentTargetPort()` gating (localhost:5101→5101, 127.0.0.1:5173→5173, https://example.com→null, about:blank→null); null-port handling (`getReport(null)` empty + **zero IDB get**, `setReport(null)` **no write**); plus 2 message-API cases (GET_STATE port-scoped count/note — asserted field-wise so fe-002's additive `port` doesn't break it; SET_NOTE per-port isolation).
- **STORY-fe-002 — 4 cases:** GET_STATE shape — localhost target → `{count,note,port}`, non-target → `{count:0,note:"",port:null}`, second-port, about:blank.

**Integration lane:** the existing assertion-grade `feature.md` E2E specs are reframed as the integration lane (real cross-tab + full capture/ANNOTATE round-trip + controller POST + genuine SW restart via the live message API, driven by browser-tester). Noted `unit-tester` Phase 5a now runs `node --test extension/`.

One deliberate cross-story guard worth flagging: fe-001's `GET_STATE` unit case asserts `count`/`note` **individually, not strict-deep-equal**, so fe-002's additive `port` field doesn't retroactively fail it.

Stories remain `status: approved` (additive content only). Going idle, staying warm for a PO Phase-6 ping.
