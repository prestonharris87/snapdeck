---
sequence: 0023
from: backend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:13:19Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**STORY-be-001 updated for the BOSS HYBRID ruling — re-reported.**

The story already had both required `## Unit tests` assertions; I aligned it to the ruling:

- **Unit lane:** zero-dep `node --test` / `*.test.mjs` against hand-written `chrome` + `indexedDB` stubs (mirrors w0-keyboard-shortcuts `be-001` harness; loads the classic SW via `await import()` + captures the `chrome.runtime.onMessage` listener — no SW→module conversion). Run via `node --test extension/` (unit-tester Phase 5a). E2E lane (browser-tester, real SW + IndexedDB) retained.
- Required assertions covered: (1) `addScreenshot()` persists `resp.model` verbatim onto `screenshots[].model`; (2) `saveReport()` outgoing `/report/save` payload carries only the existing projection fields — **no `model`** (byte-frozen). Plus model→null default, 9-field no-regression, and a byte-identical-payload regression guard.

**⚠️ Cross-feature merge flag for BOSS (same wave, shared file):** w0-keyboard-shortcuts `be-001` (approved) ALSO edits `extension/background.js` and creates `extension/background.test.mjs`. To avoid a new-file collision I named my tests **`extension/background.model.test.mjs`** (distinct); `node --test extension/` discovers both, each runs in its own process. The three same-wave editors of `background.js` are non-overlapping line regions:
- w0-keyboard-shortcuts → top-level `chrome.commands.onCommand` listener
- w0-per-target-reports → `getReport`/`setReport` re-key (lines 34-37)
- w0-editor-foundation (me) → `addScreenshot()` push literal (lines 129-139)

Please have BOSS sequence the `background.js` merge window at push time. Story remains `status: pending`, `depends_on: [STORY-fe-003]`. Nothing else changed (wire shape / opacity / frozen projection all as previously reported).
