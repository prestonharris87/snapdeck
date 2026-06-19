---
sequence: 0010
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:02:24Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

**FE decompose complete — `w0-per-target-reports`** (extension `background.js`, `frontend_lane: N/A`). 2 stories on disk:

- **STORY-fe-001** — *Re-key in-progress report to per-port + current-target resolution* (effort 2, substantive, depends_on: []). The atomic core: `getReport/setReport/clearReport` → port-scoped `report:<port>` (same `snapdeck`/`kv`, no version bump); new `currentTargetPort()` seam (localhost-gated wrapper over the existing `portOfUrl`); all 5 handlers + `addScreenshot`/`saveReport` resolve the current target internally (zero-arg signatures preserved). No module state, no `chrome.storage.session` cache (at-handling-time resolution needs none). Delivers two-port isolation + save isolation + restart persistence.
- **STORY-fe-002** — *GET_STATE additive port field + non-target empty-state* (effort 1, substantive, depends_on: [STORY-fe-001]). Purely additive: `GET_STATE` → `{count, note, port}`; non-target → `{count:0, note:"", port:null}`. This is the frozen contract `w1-dynamic-icon-badge` consumes.

**Split rationale:** the re-key is atomically coupled (changing helper signatures forces all call sites in one story), so fe-001 is the whole re-key; fe-002 isolates the additive cross-feature contract for clean validation + dependency targeting (w1 → fe-002 for the `port` field; w2 → fe-001 for the key format). The "chrome.storage.session cache" candidate is NOT a story — folded into fe-001 as a no-module-state constraint since resolution is at-handling-time.

**Contract surfaces to freeze (🤝 CONTRACT):** key format `report:<browserPort>` (fe-001) and `GET_STATE` shape `{count, note, port}` with `port:null` non-target sentinel (fe-002).

**Peer messages sent (audit trail):**
- → `backend-architect`: confirm `/resolve` + `/report/save` controller is a no-op for this feature AND that they are NOT also writing a `background.js` story (avoid double-authoring). *Reply pending — does not block; fe stories assume the unchanged-contract no-op per scope.*
- → `database-architect`: confirm no server-side DB/migration work (storage is client-side browser IndexedDB). *Reply pending — does not block.*

**No-regression guarded in fe-001 baseline:** localhost guard + error string, the `ANNOTATE` editor round-trip, the per-screenshot field set (incl. a sibling-added `model` key), the `/report/save` payload field-renaming, and the `snapdeck` v1/`kv` store (no version bump). One intentional change flagged, not silently dropped: `saveReport`'s `portOfUrl(screenshots[0].url)` fallback is retired (per-port keying must resolve the key from the active tab before reading the record).

**Shared-file note:** my footprint (helpers + handlers) is region-isolated from `w0-keyboard-shortcuts`' top-level `chrome.commands.onCommand` listener — flag both at the push window.

**Open question:** the extension has **no JS unit-test harness** (`no package.json`/runner under `extension/`). I cited the PO's E2E specs as coverage in both stories. Want me to request a **devops story** to stand up a unit harness, or is E2E-only coverage acceptable for this wave?

Stories are untracked on disk — ready for your phase-boundary `git add thoughts/ && commit`.
