---
sequence: 0016
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:19:15Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

(Note: `main` addresses me as a background subagent, so routing this to you, team-lead, as the coordinator.)

Done — both `## Unit tests` sections updated for the HYBRID ruling; every other section left byte-unchanged, no re-arbitration. Stories stay `status: approved`.

**Unit lane added (`node --test`, zero-dep, no package.json):**
- **Test file:** `extension/background.reports.test.mjs` — feature-distinct, will NOT collide with sibling `w0-keyboard-shortcuts`' `extension/background.test.mjs` on the shared `node --test extension/` run.
- **Harness (no source/manifest change):** load `background.js` into a `node:vm` context pre-seeded with hand-written `chrome` (`tabs.query` + capturing `onMessage.addListener` + tolerant `commands.onCommand` no-op) and in-memory `indexedDB` (Map-backed `kv` with get/put counters) stubs — exposes the top-level helpers as directly-callable AND captures the message listener. Respects `files_not_modified` (no `background.js` restructure, no `manifest.json` change). Chose `node:vm`-load over the sibling's `await import()` specifically because my cases need to call the unexported helpers (`getReport(null)`, `currentTargetPort()`) directly — `import()` can't reach them without exports (which would force a manifest `type:module` change).
- **STORY-fe-001 — 12 cases:** port-scoped `getReport/setReport/clearReport` (key `report:<port>`, empty default, **port isolation**, clear-only-that-port); `currentTargetPort()` gating (localhost:5101→5101, 127.0.0.1:5173→5173, https://example.com→null, about:blank→null); null-port handling (`getReport(null)` empty + **zero IDB get**, `setReport(null)` **no write**); plus 2 message-API cases (GET_STATE port-scoped count/note; SET_NOTE per-port isolation).
- **STORY-fe-002 — 4 cases:** GET_STATE shape — localhost→`{count,note,port}`, non-target→`{count:0,note:"",port:null}`, second-port, about:blank.

**Integration lane:** existing assertion-grade `feature.md` E2E specs reframed as integration (real cross-tab + full capture/ANNOTATE round-trip + controller POST + genuine SW restart via live message API, browser-tester-driven). Noted `unit-tester` Phase 5a runs `node --test extension/`.

One deliberate cross-story guard: fe-001's `GET_STATE` unit case asserts `count`/`note` **individually, not strict-deep-equal**, so fe-002's additive `port` field doesn't retroactively fail it.

Going idle, staying warm for a PO Phase-6 ping.
