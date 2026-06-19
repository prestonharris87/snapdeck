---
sequence: 0018
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:33:53Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

✅ **Security-finalize complete for w0-per-target-reports.** All 5 findings carry a `PO disposition:` line (disposition gate satisfied). No HIGH/CRITICAL.

| Story | Finding | Disposition |
|---|---|---|
| fe-001 | LOW — Divergent localhost gate (write-key vs read-key derive from two predicates) | **PROMOTE_TO_AC** |
| fe-001 | LOW — Unbounded `report:<port>` growth (DoS, no eviction) | ACCEPT_AS_RECOMMENDATION (→ w2 GC home) |
| fe-001 | INFO — Retiring `screenshots[0].url` save fallback is net-positive | ACCEPT_AS_RECOMMENDATION (affirm) |
| fe-001 | INFO — API design eliminates IDOR / port-enumeration | ACCEPT_AS_RECOMMENDATION (affirm) |
| fe-002 | INFO — Additive `port` discloses only active tab's own port | ACCEPT_AS_RECOMMENDATION (affirm) |

**PROMOTE_TO_AC (LOW-1) — wired all three PO surfaces, per your steer:**
- `feature.md` `## Acceptance criteria`: new bullet — write path (`addScreenshot`/`saveReport`) derives its port via the SAME localhost-gated resolution as the read path; `http://localhost.evil.com` → no-target + no `report:*` record, NOT `:80`. Write-key ≡ read-key by construction.
- `feature.md` `## E2E test spec`: new scenario **"Deceptive-host write/read gate parity (security)"** (ADD_SCREENSHOT rejected, no record written; GET_STATE → `{count:0, note:"", port:null}`).
- fe-001 `## How we validate`: matching checklist item.
- **Did NOT touch fe-001's frozen `## Unit tests`** (BOSS hybrid ruling) — named the warranted assertion `addScreenshot_deceptiveHost_writesNoRecord` (stub `tabs.query`→deceptive host, assert zero `put` calls) in the disposition prose for the engineer to add alongside the existing `currentTargetPort_*` cases.
- **No cross-feature contract change:** `report:<port>` key format + `GET_STATE` shape unchanged — w1/w2 contract intact.

**LOW-2 (DoS):** accepted, not gating, no defect filed — per-port GC is the natural responsibility of `w2-screenshot-gallery` (already reads/manages `report:<port>`); recorded as its home with a standing guardrail (deletion must stay resolve-from-active-tab / no caller-supplied port). Flag if you'd prefer a tracked `file-defect.sh` follow-up instead — I judged accept-as-recommendation correct given LOW + local single-user.

**3 INFO affirmations:** each accepted with a one-line standing guardrail for w1/w2 (no page-content-derived port fallback; no handler accepting a caller-supplied port; keep trusting `port: null` as the non-target signal). The "UX isolation boundary ≠ security boundary" rule is single-sourced on fe-001's IDOR disposition and cross-referenced from the others.

**Note:** I left `feature.md status: planning` unchanged — security added no `STORY-sec-*`, but you own the final `planned`/lock stamp. Stories remain `approved`.

Going idle — staying warm for final shutdown.
