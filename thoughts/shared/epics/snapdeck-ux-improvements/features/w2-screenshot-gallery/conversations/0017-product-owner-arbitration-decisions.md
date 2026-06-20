---
type: arbitration-decision
from: product-owner
to: team-lead
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
run_id: run-20260620-arbitrate
written_at: 2026-06-20T00:00:00Z
---

# PO arbitration decisions — w2-screenshot-gallery

## Cross-domain conflict: none material

BE/DB/DO are grounded sentinels, each peer-confirmed by the frontend-architect at the
Phase-5 floor (conversations 0001–0016). The single substantive domain is FE (3 stories
on `extension/background.js` + `extension/popup/*`). Per BIAS_LIMIT, I did **not**
manufacture a tension-pair probe: the room did **not** converge too easily — the
contrarian surfaced 1 block + 1 concern + 4 info findings, which IS the arbitration
surface (≥3 substantive signals). The FE↔BE/DB/DO "sentinel" boundary was explicitly
negotiated and recorded, not silently assumed. Considered, no probe warranted.

## The BLOCK — fe-002 Finding 1: stale-index re-save corrupts a bystander record

**Disposition: RESOLVED BY REVISION (stable-identity addressing). NOT `## Acknowledged
Risk`.** This is silent data corruption; the fix is cheap, already in scope (the API was
spec'd "by index/**id**"), and needs **no released-code change**. I verified against
released source (`background.js:284-295`) that the capture record stores `captured_at` +
`original` and **no `id`** — both fields are **preserved** by `resaveScreenshot`, so they
synthesize a stable identity that survives both a re-save and an array splice. Acknowledging
silent corruption when a free, in-scope, no-released-change fix exists would be the wrong
call.

Revised in lockstep (graph unchanged: fe-001 ← fe-002 ← fe-003):
- **fe-001** (owns projection + delete) — `GET_REPORT_SCREENSHOTS` emits `sid`
  (`screenshotId(s)` = `captured_at` + `original`-bytes fingerprint) alongside the
  display `index`; added `screenshotId`/`indexOfScreenshotId` helpers; `DELETE_SCREENSHOT`
  matches by `sid` (no match ⇒ fail-safe `{error}`). Resolves fe-001 Finding 1 (same site).
- **fe-002** (owns re-open + re-save) — `REOPEN_SCREENSHOT {sid}`; the deferred re-save
  takes `sid` (not a held index), re-reads + re-matches by `sid`, fail-safe no-op if the
  shot was deleted mid-edit; field-preserve contract unchanged. **Corrected the now-false
  "popup is closed while the overlay is open" claim** → rewrote as the "Stable-identity
  note."
- **fe-003** (popup) — passes `shot.sid` to `reopen()`/`confirmDelete()`; `#N` badge
  demoted to display-only; validate item forbids ever sending an array index as the handle.

**Promoted to feature.md**: a new AC ("No mid-edit wrong-record corruption (stable-identity)")
+ a strengthened "Zero-port-arg, stable-identity API" AC + a new Konva-lane E2E ("Mid-edit
sibling delete never corrupts the re-edited record") — so the guard is validator-enforceable
and an engineer can't backslide to index-addressing. (Editing feature.md ACs/E2E for a
load-bearing guard is PO purview; recorded here.)

## Info findings — dispositions

- **fe-001 Finding 2 (GC over-claim) — ACCEPTED; scoped precisely.** Delete bounds the
  PNG/payload bloat (the real LOW-2 concern) and removes the key on delete-to-empty; it does
  **not** GC the empty-record keyspace left by the released Save/Clear paths (`clearReport`
  keeps the key — out of scope, keying contract unchanged). The decision-memo must not state
  "the store does not accumulate empty/stale records" without that qualifier.
- **fe-002 Finding 2 (verbatim `resp.model` persistence) — DEFERRED to security-architect
  Phase 7 STRIDE.** Bounded-at-render ≠ bounded-envelope; same-origin extension IndexedDB ⇒
  defense-in-depth. **Standing guardrail: do NOT weaken `RENDER_ITEM_CAP=500` /
  `RENDER_TEXT_CAP=10000`.** Already in stress-test § Security pointer.
- **fe-002 Finding 3 (active-tab/multi-window divergence) — ACCEPTED; hardened as a side
  effect of the block fix.** Identity-addressing turns a target-switch into a fail-safe
  `{error}` no-op (vs index-addressing's silent wrong-target re-open). Residual is
  effectively impossible; Chrome's popup focus-close mitigates the trigger.
- **fe-003 Finding 2 (unbounded full-res thumbnail payload) — ACCEPTED for v1 with a named
  re-trigger.** If large-report popup latency is observed → `OffscreenCanvas` downscale in
  fe-001's projection (fe-001-local; no fe-003 contract impact).

## Gate checks

- **Baseline gate:** fe-001/002/003 each carry a `## Existing behavior baseline` section
  (not greenfield/sentinel) — no violation.
- **Validate checklists:** every story has ≥1 `- [ ]` item. Fixed db-001 (was prose bullets
  → converted to `- [ ]`).
- **`depends_on`:** all ids exist, unquoted-bracket YAML, consistent (fe-002←fe-001,
  fe-003←fe-001+fe-002; sentinels `[]` with justification). Unaffected by the revision.

## Result

All 6 stories promoted `pending → approved`. Ready for security-architect Phase 7 (the one
open item is fe-002 Finding 2's bounded-end-to-end re-confirm). feature.md left at
`status: planning` — the status lock is the orchestrator/security-finalize phase's call.
