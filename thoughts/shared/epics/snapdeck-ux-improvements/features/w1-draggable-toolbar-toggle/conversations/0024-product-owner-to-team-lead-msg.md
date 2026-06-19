---
sequence: 0024
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T16:02:59Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

Arbitration complete. **All 6 stories promoted pending → approved.** Decision record: `conversations/0018-product-owner-arbitration-decision.md`.

**Cross-domain conflicts:** none. 3-FE chain (fe-001→fe-002→fe-003), zero cross-domain deps; be/db/do-001 are sentinels, peer-confirmed and contrarian-verified correct. depends_on all accurate + YAML-valid.

**2 concerns — both RESOLVED by revision (not accepted-as-risk):**

1. **fe-002 negative fit-inset (highest-risk).** Required BOTH clamp (`Math.max(1, dim−2*PAD)`) AND short-circuit (`dim<2*PAD ⇒ TEXT_AUTOFIT_MIN`+clip) — clamp kills the *unspecified-negative-width*, short-circuit kills the *expensive-degenerate-measurement*; "no throw" and "no hang" are separate guarantees. Added the finite-thin-box E2E (`8×200`) the hostile-item case never hit. This is the path w2-screenshot-gallery depends on.

2. **fe-003 unselected-drag data-loss.** Gated the text Group `draggable: select && selected`. **I diverged from "fix in the shared path"** — that would change released `renderBox` and break fe-001's box no-regression AC. So: fix on the text path only, documented as the contract w2 adopts; renderBox alignment is a separate follow-up. Conscious fix, not Acknowledged Risk.

**4 info dispositioned:** fe-001 re-edit→empty-delete ACCEPTED (intended; fixed the contradictory AC wording in feature.md + fe-003 + E2E note — the contrarian caught a real wording bug); fe-002 font-env-dependence MITIGATED (pin `fontFamily` + document model-byte-not-pixel identity for w2); fe-003 Group-attach promoted to contract + mid-drag-distortion E2E note to pre-empt a false-positive bt defect; fe-001 draw-threshold reconciled via fe-002's clamp.

**Sentinel hygiene:** be-001 + do-001 shipped without a `## How we validate` checklist (recurring) — added one each; db-001 already had one; added `last_run_id` to do-001.

**feature.md:** corrected 2 AC inaccuracies (re-edit empty-delete; round-trip = model-byte not pixel identity) + populated the Stories list. No `## Acknowledged Risk` warranted.

**One open loop (non-blocking):** pinged frontend-architect (warm) to confirm the exact clamp/fontFamily + draggable-gate wording is implementable; revisions stand absent a blocker flag. Going idle, staying warm for Phase 7 (security).
