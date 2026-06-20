---
sequence: 0018
from: product-owner
to: team-lead
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-20T18:11:03Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
---

**w2-screenshot-gallery arbitrate COMPLETE — all 6 stories promoted `pending → approved`.**

**THE BLOCK (fe-002 Finding 1) — RESOLVED BY REVISION (stable-identity addressing), not Acknowledged Risk.** Verified against released code (`background.js:284-295`): the capture record stores `captured_at` + `original`, no `id`, and `resaveScreenshot` *preserves* both → a stable `sid` is synthesizable with **zero released-code change**, exactly as the contrarian + scope ("by index/**id**") sanctioned. Wired lockstep (graph unchanged fe-001←fe-002←fe-003):
- **fe-001** (fix site) — projection emits `sid` (`screenshotId` = `captured_at`+`original`-fingerprint) + `indexOfScreenshotId` helper; `DELETE_SCREENSHOT` matches by sid; no-match ⇒ fail-safe `{error}`. Also resolves fe-001 Finding 1.
- **fe-002** — `REOPEN_SCREENSHOT {sid}`; deferred re-save re-reads + re-matches by sid; **self-deleted-mid-edit ⇒ fail-safe no-op**; field-preserve contract intact. **Corrected the now-false "popup is closed while the overlay is open" claim** → rewrote as the Stable-identity note.
- **fe-003** — popup passes `shot.sid` to reopen/delete; `#N` badge display-only; validate item forbids ever sending an array index.

Each got updated validate items + unit tests (incl. `resave_siblingDeletedMidEdit_…noBystanderCorruption` + `resave_selfDeletedMidEdit_failSafeNoOp`). **Promoted to feature.md**: new AC "No mid-edit wrong-record corruption (stable-identity)" + strengthened API AC + a new Konva-lane mid-edit E2E — so it's validator-enforceable.

**Info dispositions:**
- fe-001 F2 (GC over-claim) — ACCEPT; scoped precisely: Delete bounds PNG bloat + removes key on delete-to-empty, does NOT GC the empty-record keyspace left by Save/Clear (out of scope). Decision-memo must carry that qualifier.
- fe-002 F2 (verbatim `resp.model`) — **DEFER to security-architect Phase 7** (bounded-at-render ≠ bounded-envelope). Standing guardrail: do NOT weaken `RENDER_ITEM_CAP=500`/`RENDER_TEXT_CAP=10000`.
- fe-002 F3 (active-tab/multi-window) — ACCEPT; *hardened* for free by the block fix (foreign sid ⇒ no-op vs silent wrong-target re-open).
- fe-003 F2 (full-res thumbnail payload) — ACCEPT v1 with named re-trigger (OffscreenCanvas downscale in fe-001's projection if latency observed).

**Gates:** baseline section present on all 3 substantive stories (no violation); fixed db-001's validate items prose→`- [ ]`; `depends_on` valid/unquoted/consistent; no cross-domain conflict (BE/DB/DO sentinels peer-acked — contrarian's block+concern+4 info IS the arbitration surface, no manufactured probe per BIAS_LIMIT).

Decisions recorded in `conversations/0017-product-owner-arbitration-decisions.md`. feature.md left at `status: planning` (status lock = orchestrator/security-finalize call). One open item carried to Phase 7: fe-002 F2 bounded-end-to-end re-confirm. Going idle.
