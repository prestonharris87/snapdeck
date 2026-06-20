---
type: stress-test
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
written_at: 2026-06-20T16:52:00Z
contrarian_run_id: run-20260620-161818-88519
findings_count:
  info: 4
  concern: 1
  block: 1
---

# Phase 5.5 stress-test — Screenshot gallery (review / re-open-edit / delete)

The four domain architects sentineled cleanly (be/db/do) and the FE lane was
internally well-negotiated: the **field-preserve corruption lock** (don't clobber
`original`/`console`/`network`/`meta` with the re-edit tab's fresh/live values) is
correctly motivated and verified against released code (`editor.js:489-501` does emit
fresh `meta` + live `__snapdeckBuffers`; `addScreenshot` rebuild would clobber). The
no-host PING pre-flight, the busy `{cancelled:true,busy:true}` no-op, the inherited
render caps, and two-port isolation all check out against `background.js` / `editor.js`.

The gap the room shared and nobody challenged is **identity under concurrency**. The
negotiated "corruption-risk lock" addressed *field* preservation; it did **not**
address *which record* the re-save lands on. All three new handlers address a
screenshot by **array index**, the records carry **no stable id**, and fe-002's
index-stability argument rests on a premise that the released runtime does not enforce.

## Top three cross-cutting challenges

1. **Index-based addressing + no stable id = silent wrong-record corruption on
   re-save** [block]. `resaveScreenshot(port, index, resp)` writes the edited fields
   into `r2.screenshots[index]` after a long-lived re-edit, but the held `index` can
   shift: the browser-action popup is **re-openable while the in-page overlay is
   active** (the overlay is page DOM; it does not disable the toolbar popup), exposing
   a working `Delete`. A confirmed delete at index ≤ the edited index splices the array,
   and the deferred re-save then overwrites a **bystander** record with the edited
   annotations — no throw, no `console.error`. fe-002's mitigation note ("the popup is
   closed while the overlay is open") is **false**; the editor `active` guard
   (`editor.js:15`) blocks only a second ANNOTATE/capture, never the SW delete handler.
   Fix is cheap and **already in scope** ("by index/id"): address re-open/delete/re-save
   by a stable identity (`captured_at` [+`original` tiebreak]) synthesized from
   already-stored fields — no released code changes. Touches: **STORY-fe-002 Finding 1
   (block)**, **STORY-fe-001 Finding 1 (concern, fix site)**, **STORY-fe-003 Finding 1
   (info, enabling surface)**.

2. **Unlocked read-modify-write + re-openable popup widen the concurrency surface**
   [info]. Beyond the block, the feature adds two user-driven mutators (delete, re-save)
   to an already-unlocked `getReport → mutate → setReport` set shared with released
   `addScreenshot`/`SET_NOTE`/`saveReport`; concurrent handlers interleaving at their
   awaits can drop a mutation (last-writer-wins). Pre-existing architectural property,
   not introduced here, but the new mutators slightly enlarge it. The same
   "popup re-openable mid-edit" fact also lets the active target diverge from the
   rendered grid in multi-window / tab-switch cases (mitigated by popup focus-close).
   Touches: **STORY-fe-001 Finding 3 (info)**, **STORY-fe-002 Finding 3 (info)**.

3. **Two over-claims to scope precisely in the decision memo** [info]. (a) The "GC home"
   removes the `report:<port>` key **only** on delete-to-empty; the dominant Save
   (`clearReport`, `background.js:328`) and Clear paths still persist empty records, so
   "the store does not accumulate stale entries" is true for PNG payload bloat (the real
   LOW-2 concern) but **not** for the empty-record keyspace. (b) The gallery ships
   full-resolution PNGs for every shot with no count cap or downscale — fine for small
   reports, an unstated "reports stay small" assumption otherwise. Both are acceptable
   as designed; the ask is to not over-state them. Touches: **STORY-fe-001 Finding 2
   (info)**, **STORY-fe-003 Finding 2 (info)**.

## Security pointer (Phase 7)

STORY-fe-002 Finding 2 (info): `resaveScreenshot` persists `resp.model` verbatim, so a
model bounded *at render* by the inherited caps is nonetheless stored in full and
re-deserialized on the next re-open (caps bound the canvas, not the envelope). Same-origin
extension IndexedDB → defense-in-depth, not externally-reachable. Flagged for
**security-architect** to close "bounded end-to-end," not just bounded-at-render. Do not
weaken the inherited caps.

## Detailed findings (per-story `## Contrarian Findings` blocks)

- **STORY-fe-001** — Finding 1 *(concern)*: no stable identity; index-addressing is the
  root cause and the fix site. Finding 2 *(info)*: GC only removes the key on
  delete-to-empty. Finding 3 *(info)*: DELETE joins the unlocked read-modify-write set.
- **STORY-fe-002** — Finding 1 *(block)*: stale-index re-save → silent wrong-record
  corruption after a mid-edit delete; mitigation premise is false. Finding 2 *(info,
  → security)*: verbatim `resp.model` persistence round-trips. Finding 3 *(info)*:
  re-open target can diverge from the rendered grid.
- **STORY-fe-003** — Finding 1 *(info)*: the re-openable popup is the enabling surface
  for fe-002's block; not the fix site. Finding 2 *(info)*: unbounded full-res thumbnail
  payload.

## Verification note (lock-it-down)

Every "existing X does Y" claim informing the block/concern was confirmed against
released source: `addScreenshot` record shape with no id (`background.js:284-295`);
`getReport`/`setReport`/`clearReport`/`EMPTY_REPORT` (`:40-48`); `saveReport` →
`clearReport` keeps the key (`:328`); `activeTab` = `{active,currentWindow}` (`:67-70`);
`currentTargetPort` (`:78-83`); badge consumer (`:468-471`); editor PING synchronous +
before the busy check, busy `{cancelled:true,busy:true}` (`editor.js:13-16`); Done payload
emits fresh `meta` + live buffers and echoes the passed-in `original` (`editor.js:489-501`);
render caps `RENDER_ITEM_CAP=500` / slice / `RENDER_TEXT_CAP` (`editor.js:178-179,192-193,256`).
