---
sequence: 0001
from: product-owner
to: main
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:49:42Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

✅ `feature.md` written for **w0-per-target-reports** (Shape B, decompose-one-feature mode).

**File:** `thoughts/shared/epics/snapdeck-ux-improvements/features/w0-per-target-reports/feature.md`

**Sections written** (all required H2s present, names match the dashboard contract): Summary · User-facing behavior · UX patterns/interaction notes · Acceptance criteria · In scope · Out of scope · E2E test spec · Stories (empty) · Defects (empty).

**Frontmatter preserved:** type/slug/wave/parent_epic/created_at/last_run_id/`depends_on: []`/`frontend_lane: N/A`/`visual_references: []`, `status: planning`. `scope_check` not set — this is a contained re-keying, correctly one feature.

**Counts:** 12 acceptance criteria · 5 E2E scenarios + Motion E2E `n/a` (non-UI service-worker/IDB plumbing; popup unchanged).

**E2E coverage** (all four required scenarios + one extra), driven through the message API + tab activation with two concrete ports (`:5101`/`:5102`):
1. Two-port capture isolation (capture A → switch B empty → capture B → back to A intact)
2. Note isolation across ports (SET_NOTE on A doesn't touch B)
3. Save isolation (SAVE_REPORT payload `browser_port`==A, clears only A, B untouched)
4. Service-worker restart persistence (count survives via GET_STATE — IndexedDB)
5. Non-target tab (GET_STATE → `{count:0, note:"", port:null}`; ADD_SCREENSHOT hits localhost guard, creates no `report:*` record)

**Consistency with the frozen cross-team contract:** rendered, not redesigned — `report:<browserPort>` key in the same `snapdeck`/`kv` store (no DB bump); record shape `{note, screenshots:[...]}` unchanged; `GET_STATE` returns frozen `{count, note}` + additive `port`; `addScreenshot()`/`saveReport()` stay zero-arg; port cache → `chrome.storage.session`. I pinned the additive `port` field and the non-target return as explicit ACs so the w1/w2 consumers have a testable contract now.

**Ambiguities resolved:** none requiring escalation. One judgment call worth flagging for the architect (not a blocker): with per-port keying, `saveReport()`'s current fallback `portOfUrl(r.screenshots[0].url)` (used when the active tab isn't localhost) now has to resolve a port *before* it can even load the report — I kept the AC at the observable level ("SAVE_REPORT operates on the current target's report; payload `browser_port` == resolved port") and left the load-order mechanics to the backend-architect.

Task #1 complete. Standing by for resume on later modes (screenshot-spec — likely `status: n/a` here since `skip_ui_designer: true` — arbitrate, security-finalize).
