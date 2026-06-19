---
sequence: 0001
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:16:51Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

✅ `w1-dynamic-icon-badge` feature.md is on disk (Shape B, `status: planning`). **No scope concern** — appropriately one feature: a per-`tabId` `action`-state machine consuming the released w0 contract.

**Sections written** (all 9 required H2 present, none renamed): Summary · User-facing behavior · UX patterns/interaction notes · Acceptance criteria · In scope · Out of scope · E2E test spec · Stories (placeholder) · Defects.

**Frontmatter:** `status: planning`, `depends_on: [w0-per-target-reports]`, `wave: 1`, `frontend_lane: N/A`, `skip_ui_designer: true`, `parent_epic`, `last_run_id: run-20260619-150619-36719`.

**13 ACs**, each grounded in real `background.js` line seams:
- Gray-instant/no-probe (AC1), green via cached `findController()`+`storage.session` (AC2), localhost-no-controller→gray (AC3), orange+badge=`GET_STATE.count` w/ orange>green precedence (AC4), live increment popup+kb path no tab switch (AC5), back-to-green on save/clear (AC6), per-`tabId` survives SW restart (AC7), top-level listeners (AC8), no module-level state (AC9), one-source-of-truth/deceptive-host→gray (AC10), **released-code boundary + steady-state-after-flash** (AC11), two-tier responsiveness (AC12), **no new manifest permission** (AC13, dodges MV3 auto-update re-acceptance hazard).

**10 E2E tests** (+ Motion E2E `n/a` w/ justification): non-localhost→gray/no-probe · localhost→green cached (2nd visit no re-probe) · localhost-no-ctrl→gray · orange+live-increment (popup) · live-increment (kb path) · save→green · per-`tabId` isolation A↔B + responsive switch · **SW-restart re-derive** · **steady-state-after-flash (directive #4, ✓/! + cancelled cases)** · **deceptive-host→gray/no-probe**.

**Load-bearing constraints encoded per your prompt:** all 5 directives wired into AC+E2E. Note: directive #4 BOSS released-code boundary is locked as AC11 + a dedicated steady-state-after-flash E2E, and out-of-scope explicitly forbids editing `runCaptureCommand()`/w0 seams; if the count-freshness trigger or flash reconcile proves impossible without touching released code, the artifact says escalate to BOSS as a released-work defect — flagging that as the live hidden-coupling hot-spot for the **Contrarian 5.5** pass (the kb path calls `addScreenshot()` directly, not via `onMessage`, and popup/`addScreenshot` are read-only — so the live-count trigger for the kb path is the genuine open design question I left to the architect, not pre-specified).

Going idle (not shutting down) — ready for the next mode transition (standby → screenshot-spec/arbitrate/security-finalize).
