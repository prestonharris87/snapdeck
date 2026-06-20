---
sequence: 0015
from: contrarian-architect
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:58:54Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
---

Phase 5.5 stress-test complete for **w2-screenshot-gallery**. Findings appended to fe-001/fe-002/fe-003; feature-level `stress-test.md` written.

**Tally:** 1 block · 1 concern · 4 info.

**Highest-risk (the one to act on) — STORY-fe-002 Finding 1 [BLOCK]: stale-index re-save silently corrupts the wrong screenshot.**
- `resaveScreenshot(port, index, resp)` writes the edited fields into `r2.screenshots[index]` after a long-lived re-edit, but records have **no stable id** — the held `index` can shift.
- fe-002's stability note claims *"the popup is closed while the overlay is open"* → **false**. The browser-action popup is re-openable while the in-page editor overlay is active (independent surfaces; the editor `active` guard at `editor.js:15` blocks only a second ANNOTATE, not the SW delete handler). Re-open popup → confirm `DELETE_SCREENSHOT{index ≤ edited}` → splice shifts the array → `✓ Done` → re-save overwrites a **bystander** record with the edited annotations. **No throw, no console.error** — silent Frankenstein record; the shot actually edited is left unchanged.
- Verified against released code: `addScreenshot` pushes id-less records (`background.js:284-295`); editor Done payload + busy/PING behavior all as the story documents.
- **Fix is cheap and already in scope** (the API is spec'd "by index/id"): address re-open/delete/re-save by a stable identity synthesized from already-stored fields (`captured_at` [+`original` tiebreak]) — **no released code changes**. Fix site is **fe-001 Finding 1 [concern]** (it owns the projection → emit identity); fe-003 Finding 1 [info] is the enabling surface (don't try to "fix" it presentationally — the popup has no signal an overlay is open).
- Per the block rubric: passes arbitration only with an explicit `## Acknowledged Risk` + PO approval, OR a revise to identity-addressing.

**Others (all info, no gate):** fe-002 F2 → security pointer (verbatim `resp.model` persistence round-trips; bounded-at-render ≠ bounded-envelope — for security-architect Phase 7, don't weaken caps). fe-002 F3 → active-tab/multi-window divergence. fe-001 F2 → GC removes the key only on delete-to-empty (Save/Clear still keep empty records; bounds PNG bloat, not keyspace — scope the claim precisely). fe-001 F3 → DELETE joins the unlocked read-modify-write set. fe-003 F2 → unbounded full-res thumbnail payload (no count cap/downscale).

The field-preserve contract, no-host PING, busy no-op, inherited render caps, and two-port isolation all check out — the room negotiated those well. The single gap was **identity under concurrency**, which the "corruption lock" framing (field-preserve) crowded out. Going idle.
