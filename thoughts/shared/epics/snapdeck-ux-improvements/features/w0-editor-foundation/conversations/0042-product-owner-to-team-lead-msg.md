---
from: product-owner
to: team-lead
type: security-finalize-decision
feature: w0-editor-foundation
epic: snapdeck-ux-improvements
date: 2026-06-19
---

# PO security-finalize — w0-editor-foundation (Phase 7.5)

7 `## Security Review` blocks dispositioned (security-architect STRIDE pass; highest severity LOW). Every
block now ends with a `**PO disposition:**` line. **No new STORY-sec authored** (security-architect
warranted none).

## Dispositions

| Story | Severity | Disposition |
|---|---|---|
| STORY-fe-001 (box primitive) | INFO | ACCEPT_AS_RECOMMENDATION — box is model-only, Konva-canvas render, plain-text label |
| STORY-fe-002 (transformer) | INFO | ACCEPT_AS_RECOMMENDATION — `Math.max(1,…)` clamp already in story |
| STORY-fe-003 (serialize) | INFO | ACCEPT_AS_RECOMMENDATION — byte-freeze/upstream-exclusion already E2E-locked |
| STORY-fe-005 (pure module) | INFO | ACCEPT_AS_RECOMMENDATION — keep envelope-only guard opaque; accept a 1-line code comment |
| STORY-be-001 (persist) | INFO ×3 | ACCEPT_AS_RECOMMENDATION — local-only `model` 9-field-locked; unbounded-value DoS = accept-risk |
| STORY-do-001 (manifest) | INFO | ACCEPT_AS_RECOMMENDATION — isolated-world, zero-permission-delta, diff-gate-locked |
| **STORY-fe-004 (hydration)** | **LOW** | **PROMOTE_TO_AC** (render-boundary robustness) |

## The one promotion — STORY-fe-004 LOW → AC (per team-lead steer)

**Finding:** `deserializeModel` correctly guards only the *envelope* and passes *items* opaquely (the
ratified forward-compat contract). A structurally-valid payload with numerically-hostile items
(`NaN`/`Infinity`/string `width`/thousands of items) flows straight into `Konva.Rect`/`Text`/`Arrow` at
the render boundary with no clamp. Non-exploitable today (first-party, single-user), but **w2-screenshot-
gallery** will re-open arbitrary *stored* models through this exact path — a disk-corrupted model would
throw and brick that screenshot's editor.

**Why PROMOTE not defer:** the fix lives in **this feature's** render dispatch
(`render()`/`renderBox`/`renderArrow` in `editor.js`, modified by fe-001/fe-004) — scope-clean, not creep.
Hardening at the render boundary (NOT in the pure module — that would break the opaque contract) is the
security-architect's own recommendation. The wave-0 foundation shouldn't ship the hydration path unguarded
when a dependent will drive untrusted-ish models through it.

**Fully wired** (PROMOTE_TO_AC = AC + E2E + validates, NOT the frozen unit-test section):
- `feature.md` AC: "Malformed-item render tolerance (hydration)".
- `feature.md` E2E: "malformed-item hydration renders without throwing (render-boundary robustness)" —
  hydrate `{version:1, items:[{type:"box",x:NaN,width:"120",height:Infinity}, <good arrow>]}` → render
  completes, no throw / no console error, bad item skipped-or-coerced, `deserializeModel` unchanged.
- STORY-fe-004 validates checklist: the matching `- [ ]` item.
- **Lane:** Konva-render-dependent → **browser-tester E2E**, not `node --test` (fe-005's opaque
  pass-through must stay intact). Engineer adds the render-guard assertion at implementation time.

## Status / handoff

All 8 stories remain `approved`; the security pass produced one promoted AC and zero new stories. The plan
is **PO-complete** (arbitration + security-finalize done). feature.md still at `status: planning` —
deferring the `planned` stamp + the lock-step checks to you: (1) `validate-depends-on.py` exit 0, (2)
sentinel prune (Phase 8.5 migrates db-001's rationale → feature.md No-work domains), (3) advance feature.md
`planning → planned`. Say the word if you'd rather I stamp `planned` now.
