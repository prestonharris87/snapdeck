---
sequence: 0214
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T20:55:00Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

# Arbitration record — w1-dynamic-icon-badge (Phase 6, Contrarian dispositions)

**No cross-domain contract conflict to arbitrate.** FE is the only substantive domain;
be/db/do are clean peer-confirmed sentinels. The Contrarian already surfaced 3 `concern` +
2 `info` (0 block), so the room did NOT converge too easily — no tension-pair probe
manufactured (BIAS_LIMIT respected). My work was dispositioning the 3 concerns + 2 info and
verifying depends_on / validates / frontmatter conformance.

## Concern dispositions

| # | Story | Concern | Disposition |
|---|---|---|---|
| 1 | fe-002 | `/resolve` probe storm — no single-flight (~80 fetches on the normal unowned-localhost gray path; threatens AC12) | **PROMOTE** to a fe-002 requirement: per-port single-flight on the `findController` call |
| 2 | fe-003 | "self-heals at next wake" overstates coverage (idle dormant-SW blind spot) | **Acknowledged Risk** (truth-in-labeling; no code change) |
| 3 | fe-003 | orange-tab capture errors silent (released `!` flash masked by tab-specific badge) | **Acknowledged Risk** + w2 forward-flag + revisit trigger; **NOT escalated now** |

**Concern 1 — PROMOTE (not a bare acknowledge).** The in-flight `Promise` map keyed by port
collapses the four-source re-entrant fan-out into one probe; lives entirely in fe-002's NEW
code (no released seam). Key nuance I pinned for the validator: the single-flight map is
*within-wake coordination*, cleared on settle — it does **not** relocate the durable cache out
of `chrome.storage.session`, so AC9 holds (same category as fe-001's pure ImageData memo). Side
benefit: it makes the feature.md "exactly one probe" E2E *true in the real browser* (under
concurrent `onActivated`+`onUpdated`), not just in the single-event harness — I updated that
E2E to credit single-flight. Routed the precise code-spec + unit case to the warm
**frontend-architect**; my fe-002 `## Revisions` block is the binding contract regardless.

**Concern 2 — Acknowledged Risk.** Corrected "next wake" → "next wake *event*"; an idle user
with no event sees a stale under-count until their next interaction. Bounded, never an
over-count, count always reconciled from the `GET_STATE`/`getReport` SSOT at the next wake.

**Concern 3 — Acknowledged Risk, deferred (I weighed must-fix).** The masking is
feature-introduced (orange only exists here), but there is **no clean in-feature fix** —
fe-003 has no failure signal (the w0 tick fires only on a count change), so the only remedies
are a released-kb failure-tick emit (BOSS-escalated released-work defect, out of bounds per
directive #4 / AC11) or a new notification surface (out of scope). Rare trigger + soft cue
(count-not-moving) → defer with an explicit revisit trigger forward-flagged to
`w2-screenshot-gallery`. Flagging to you that I considered escalation and chose defer; say the
word if you want it raised to BOSS now.

## Info dispositions

- **(a) guard-depth asymmetry** → fold in: deepen `chrome.tabs.onActivated?.` →
  `chrome.tabs?.onActivated?.` (and `onUpdated`) for parity with fe-003's root guards.
  Folded into the frontend-architect's same fe-002 edit.
- **(b) multi-window `{currentWindow:true}` best-effort** → accept as the existing scope
  boundary (scope.md out-of-scope clause); recorded so the audit trail shows it was conscious.

## Conformance sweep (finalize pre-checks)

- **depends_on** all valid + YAML-clean (unquoted bracketed ids): fe-001 `[]` (greenfield
  primitive, justified), fe-002 `[STORY-fe-001]`, fe-003 `[STORY-fe-001, STORY-fe-002]`. The
  w0 cross-feature linkage is correctly **prose** in fe-003 (feature-level
  `depends_on: [w0-per-target-reports]`), NOT a story-level id (would collide — w0 also has a
  `STORY-fe-003`). Sentinels `[]`.
- **validates checklist** ≥1 `- [ ]` on every story (sentinels included). ✓
- **Motion contract** `n/a` present on all 3 FE stories. ✓
- **frontmatter** sentinels well-formed (type/id/domain/parent_*/sentinel:true/diff_estimate
  present) — no fixups needed, unlike prior snapdeck sentinel runs.
- **db sentinel** declares no migration (no server-side DB) — correct, no identifier needed.

## Line-citation drift (feature-level info, non-blocking)

Story line cites drifted ~10–50 lines post-`6512a12` (e.g. `currentTargetPort()` cited :70/:73,
actual :78-83; `findController()` :89/:95 → :97-109; `GET_STATE` :167 → :175-180;
`runCaptureCommand()` :118-163 → :126-171). Every **seam exists and behaves as described** —
freshness only. Engineers grep-by-symbol at impl time. Not gating.

**All 6 stories promoted pending → approved.** feature.md left at `status: planning` — Phase 7
security may add STORY-sec-* and owns the final lock (per my standing rule: promoting stories ≠
locking the feature). Ready for security-finalize.

---

## Correction (post-send) — concern #3 re-dispositioned: ACKNOWLEDGED → DEFERRED-to-BOSS

Per team-lead steer (BOSS does not want #3 closed as a plain Acknowledged Risk): the orange-tab
silent-capture-error (per-`tabId` count badge shadows kb's released global `!` flash) is **NOT
accepted/resolved** — it is now a **`## Deferred Decision — BOSS decides at STORIES_LOCKED`**
block in fe-003, containing the full interaction detail + a **proposed released-code fix** (kb's
`runCaptureCommand()` sets its `!`/`✓` flash on the active tab's `{tabId}` so it isn't shadowed
— a small kb-side edit routed as a `w0-keyboard-shortcuts` released-work defect if BOSS chooses).
BOSS picks (a) accept the bounded gap or (b) route the kb defect, at STORIES_LOCKED. Written into
fe-003 so the Phase-6.5 decision-memo surfaces it. fe-003 stays `approved` (its own diff is
unaffected by either outcome). Concerns #1 (fe-002 single-flight — frontend-architect has folded
the code-spec + validates item + `resolvePortCached_singleFlight_oneProbeForConcurrentDerives`
unit case into the story) and #2 (self-heal truth-in-labeling Acknowledged Risk) stand as above.
