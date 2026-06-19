---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
version: 1
written_at: 2026-06-19T00:00:00Z
run_id: run-20260619-042600-10898
sources:
  - feature.md
  - stories/STORY-fe-001.md
  - stories/STORY-fe-002.md
  - stories/STORY-fe-003.md
  - stories/STORY-do-001.md
  - stories/STORY-be-001.md
  - stories/STORY-db-001.md
  - stress-test.md
  - conversations/0001–0022 (feature-scoped)
---

# Decision memo — Draggable toolbar + annotation visibility toggle

## Summary

This feature adds an ergonomics layer to the in-page Konva annotation editor: a
CSS-drawn drag handle that lets the developer reposition the `.snapdeck-toolbar`
out of the way, with position persisted to `chrome.storage.local` across captures,
and a non-destructive annotation visibility toggle that hides all overlay layers so
the raw screenshot shows through. What was non-obvious: (1) the node-testability
constraint forced a new pure content-script file (`editor-chrome.js`) rather than
inline helpers, which in turn forced a DevOps manifest-registration story — creating
the `fe-001 → do-001 → fe-consumers` dependency chain. (2) The visibility toggle's
"raw screenshot" intent required hiding **three** Konva overlay layers (not two);
this was only discovered mid-planning when the contrarian verified the editor stacks
four layers. (3) A "Done-while-hidden" export guard is required in `finish()` to
prevent blank-annotation PNGs — the FE architect caught this gap against released
`editor.js` and the PO closed it by adding a new E2E scenario (feature.md § "Test:
Done while annotations are hidden"). The BOSS-serialized implement constraint (shared
`buildToolbar()` body with `w1-text-box-autofit`) was flagged at STORIES_LOCKED.

---

## Positions held during planning

### frontend-architect

- **Advocated for:** extracting all node-testable logic into a NEW pure side-effect-free
  module `extension/content/editor-chrome.js` (dual-consumable UMD), mirroring the
  released `editor-model.js` pattern (conv 0010, STORY-fe-001 § "How we're doing it").
  Proposed the exact `js`-array insertion order: `editor-model.js → editor-chrome.js →
  editor.js` (conv 0010).
- **Flagged (proactively):** the "Done-while-hidden" export-guard gap — `finish()`'s
  `stage.toDataURL` rasterizes the hidden `annLayer` even though `model` stays intact;
  added a required guard to fe-003 and recommended a new PO E2E (conv 0019 § "Flag for
  PO"). Also confirmed BE sentinel (content-script-side `chrome.storage.local`, no SW
  round-trip) and DB sentinel (not the IndexedDB report store) via peer messages to
  all three domain architects (conv 0010, 0011, 0012).
- **Persona alignment:** stayed strictly FE-domain (declared `files_modified` excludes
  `background.js`, `editor-model.js`, and `manifest.json`); held the correct "FE owns
  the test file" position at arbitration.

### backend-architect

- **Advocated for:** sentinel status — no service-worker mediation of toolbar-position
  persistence, no new `background.js` message type. Opened the files independently to
  verify (conv 0007: "Verified against HEAD by opening the files myself, 2026-06-19").
- **Condition stated:** if FE had intended to route position through the SW (new
  `chrome.runtime.sendMessage` to `background.js`), BE would convert to a real story
  (conv 0005). FE confirmed no SW round-trip; sentinel ratified.
- **Persona alignment:** aligned with DEFAULT_STANCE (explicit no-change surface
  enumeration; confirmed `ANNOTATE` resolve payload frozen at `background.js:213-228`).

### database-architect

- **Advocated for:** sentinel status — `chrome.storage.local` is browser-local UI-chrome
  state, distinct from the IndexedDB `report` store (released `w0-per-target-reports`)
  and the frozen `model` envelope (released `w0-editor-foundation`). Confirmed via peer
  message to frontend-architect (STORY-db-001 § "Cross-domain contract").
- **Persona alignment:** consistent with the standing epic ruling that even IndexedDB is
  FE/extension territory; this feature's `chrome.storage.local` usage is even further
  removed (STORY-db-001 § "Why this is a sentinel").

### devops-architect

- **Advocated for:** a real (non-sentinel) manifest registration story — once FE
  confirmed a new content-script file would be extracted. Proactively asked FE before
  drafting: "Are you extracting a NEW content-script .js file?" (conv 0002). Set
  `diff_estimate: mechanical` (one `js`-array element) rather than `substantive`,
  flagging the distinction transparently (conv 0017).
- **Proposed:** `depends_on: [STORY-fe-001]` to guard against registering a missing file
  (conv 0017; STORY-do-001 § "Dependencies"). Proposed the exact js-array form (conv
  0017).
- **Persona alignment:** aligned with DEFAULT_STANCE (load-order is "load-bearing, not
  cosmetic"; correctly named it a substantive DO story despite minimal diff size).

### security-architect

No STORY-sec authored; no HIGH/CRITICAL STRIDE findings requiring PO arbitration. The
stress-test's security note (conv 0021 § "Security") pre-identified the only item for
security's attention: `parseStoredPos` guards untrusted-storage geometry from
`chrome.storage.local`. No escalation was needed and no story arose from the security
pass.

### contrarian-architect

- **Findings:** 0 block / 1 concern / 4 info (stress-test.md, conv 0021).
- **Concern raised:** manifest load-order regression guard had no owner — STORY-do-001
  declared the guard "load-bearing" but parked it in the FE-owned test file while
  declaring only `manifest.json` in `files_modified`; STORY-fe-001's test list
  contained no manifest-order case (stress-test.md Finding 1 / conv 0021).
- **Info raised:** (a) async apply-on-open paints at default-center then jumps to stored
  position on every open; E2E must await the async storage read (fe-002 Finding 1);
  (b) toggle hides 2 of 4 Konva layers — `cursorLayer`'s synthetic cursor glyph
  remains over the "raw" capture (fe-003 Finding 1); (c) draw/undo-while-hidden
  accrues invisible annotations + undo steps, surfacing on re-show (fe-003 Finding 2);
  (d) `buildToolbar()` is the real cross-feature serialization seam with
  `w1-text-box-autofit`, not `finish()` (stress-test.md challenge #2 / conv 0021).
- **Verified sound (no finding):** Done-while-hidden export guard is correct and
  non-regressive (cancel path returns at `editor.js:295-298` before `toDataURL`; Done
  path guard is a no-op on the never-toggled path); pointer isolation is structural
  (toolbar is a DOM sibling of the Konva stage, not a child); load-order race is safe
  (globals consumed at `openEditor()` call-time, not module parse-time).

### product-owner

- **Arbitration decisions:**
  - *Concern — manifest guard ownership:* assigned to STORY-fe-001 (FE owns the test
    file); STORY-do-001 references the guard via `node --test extension/*.test.mjs`
    without an undeclared cross-domain file edit (conv 0022 § 1; STORY-fe-001 §
    Revisions; STORY-do-001 § Revisions).
  - *Info — cursorLayer:* **DECIDED to hide `cursorLayer` alongside
    `annLayer`/`selectLayer`** (3 layers, not 2) — framed as intent-fidelity, not scope
    creep, because the value prop is "inspect the **raw** screenshot"; the 2-layer
    enumeration predated the 4-layer discovery (conv 0022 § 2; STORY-fe-003 § Revisions).
    Wired minimally: reuse the existing `v.annVisible` flag; no `editor-chrome.js`
    contract/test change.
  - *Info — async flicker:* accepted as-is; wired the await-storage-read requirement
    into feature.md's persistence E2E as a browser-tester implementation note (conv 0022
    § 2; STORY-fe-002 § Revisions).
  - *Info — draw/undo-while-hidden:* accepted as conscious out-of-scope; logged deferred
    usability follow-up (conv 0022 § 2; STORY-fe-003 § Revisions).
  - *Sentinel hygiene:* STORY-be-001 shipped with no `## How we validate` checklist —
    PO added 3 diff-checkable items (conv 0022 § 5; STORY-be-001 § Revisions).
  - *E2E gap:* added feature.md § "Test: Done while annotations are hidden still saves a
    PNG WITH the annotations (export guard)" — FE architect had flagged the gap in conv
    0019 (conv 0022 § 3).
  - *Cross-feature seam note:* surfaced `buildToolbar()` as the BOSS-serialize seam to
    the team-lead for STORIES_LOCKED; noted in STORY-fe-002 and STORY-fe-003 § Revisions
    (conv 0022 § 2).

---

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| New pure file vs. inline helpers in `editor.js` | FE-arch: new `editor-chrome.js` (required for `node --test`; `editor.js` can't be node-imported) | (no dissent; do-arch asked and confirmed) | New file extracted (STORY-fe-001); DO writes manifest registration (STORY-do-001) | conv 0010 + conv 0017 (peer negotiation) |
| `chrome.storage.local` vs. SW-mediated persistence | FE-arch: direct content-script `chrome.storage.local` | BE-arch: would write SW message-handler if FE intended SW round-trip (conv 0005) | Content-script-side only; `storage` permission already granted; BE sentinel | conv 0005 + 0007 (BE verified files independently) |
| Manifest load-order regression guard ownership | do-001: guard lives in FE-owned `editor.chrome.test.mjs` but `files_modified` declares only `manifest.json` | fe-001: test list had no manifest-order case (guard owned by neither) | Assigned to STORY-fe-001 (pure `fs` read inside the test file); do-001 references by running `node --test extension/*.test.mjs` | conv 0022 § 1; STORY-fe-001 § Revisions; STORY-do-001 § Revisions |
| How many Konva layers to hide (2 vs. 3) | Initial feature.md + fe-003 draft: hide `annLayer` + `selectLayer` (2 layers) | Contrarian: editor stacks 4 layers; `cursorLayer` glyph remains over "raw" capture (fe-003 Finding 1) | PO: hide all 3 overlay layers — `cursorLayer` tracks `v.annVisible`; export guard restores all 3 before `toDataURL` | conv 0022 § 2; STORY-fe-003 § Revisions |
| Done-while-hidden export guard (gap) | feature.md E2E had no Done-while-hidden scenario | FE-arch: `finish()` rasterizes hidden `annLayer`; guard required; new E2E recommended (conv 0019) | PO added feature.md § "Test: Done while annotations are hidden…"; fe-003 adds guard restoring all 3 layers before `stage.toDataURL` | conv 0019 (FE flag); conv 0022 § 3 (PO closed) |
| `diff_estimate` for STORY-do-001 | do-arch: `mechanical` (one array element; consistent with released w0 STORY-do-001) | (no dissent; flagged transparently) | `mechanical` ratified by PO | conv 0017; STORY-do-001 § Revisions |

---

## Tensions accepted as known risk

- **Async apply-on-open flicker:** every editor open with a saved non-center position
  paints the toolbar at the CSS default center position for one frame, then jumps to the
  stored position inside the async `chrome.storage.local.get` callback. Accepted for
  this developer tool (story acknowledges it). The `pre-hide-until-positioned`
  mitigation remains the engineer's optional judgment call. Risk owner: frontend-engineer
  (implementation judgment call). Cite: STORY-fe-002 § Contrarian Findings Finding 1;
  conv 0022 § 2.

- **Draw/undo-while-hidden footgun:** a developer who hides annotations to inspect the
  raw capture and then drags or clicks the stage creates an invisible annotation AND a
  new undo step — both surface unexpectedly on re-show. Accepted as out-of-scope
  (disabling tools while hidden is a different feature; visibility is orthogonal to
  model/history). Logged as a deferred usability follow-up. Risk owner: product-owner
  (conscious accept). Cite: STORY-fe-003 § Contrarian Findings Finding 2; conv 0022 § 2.

- **`buildToolbar()` textual-region overlap with `w1-text-box-autofit`:** both features
  add buttons and extend the `bar` API object inside the same `buildToolbar()` body
  (`editor.js:333-365`). No field name collision (`grip`/`onToggleVisibility`/
  `setVisibility` vs. text-box additions). Risk is a merge conflict if implemented
  without coordination. Mitigated by BOSS-serialized implement (second-to-merge engineer
  rebases on the first's additions). Risk owner: BOSS/team-lead (serialization at
  STORIES_LOCKED). Cite: stress-test.md challenge #2; conv 0022 § 2.

---

## Alternatives rejected

- **Inline `clampToViewport` + visibility helpers directly in `editor.js`:** rejected
  because `editor.js` runs `chrome.runtime.onMessage.addListener` at load and therefore
  cannot be imported by the `node --test` runner — the pure-module constraint
  (`editor-model.js` precedent) requires extraction. Cite: STORY-fe-001 § "How we're
  doing it"; conv 0010 (FE arch explanation to devops-arch).

- **Routing toolbar position through `background.js` (service-worker mediation):**
  rejected — the `storage` permission is already granted (`manifest.json:6`), content
  scripts can call `chrome.storage.local.get/set` directly. No new SW message type
  required. Cite: STORY-be-001 § "Why this is a no-work domain"; conv 0005 (BE arch
  conditional); conv 0007 (BE arch final determination).

- **Hiding only 2 Konva layers (`annLayer` + `selectLayer`) on toggle:** rejected at
  arbitration after contrarian verified the editor stacks 4 layers; `cursorLayer` carries
  a synthetic cursor painted over the capture that would remain visible, contrary to the
  "inspect the raw screenshot" value prop. Resolution was to also hide `cursorLayer` via
  the already-derived `v.annVisible` flag. Cite: STORY-fe-003 § Contrarian Findings
  Finding 1; conv 0022 § 2 (PO decision).

- **Adding a CSS/Konva transition to the toolbar `left/top` or layer visibility flip:**
  explicitly rejected in STORY-fe-002 and STORY-fe-003 motion contracts. A CSS
  `transition` on `left/top` would lag the drag 1:1; a Konva opacity transition on
  `layer.visible()` would add animation where the feature intends an instant flip.
  `frontend_lane: N/A` and `Motion E2E: n/a` (feature.md § Motion E2E). Cite:
  STORY-fe-002 § Motion contract; STORY-fe-003 § Motion contract.

- **Persisting the toggle state (annotations shown/hidden) across editor opens:**
  explicitly out of scope per feature.md § "Out of scope" and STORY-fe-003 § "What we're
  doing". Only the toolbar *position* persists. Cite: feature.md § "Position persists;
  visibility does not."

---

## Next actions

Mirroring feature.md § Acceptance criteria (source of truth; memo does not diverge):

- [ ] The editor toolbar (`.snapdeck-toolbar`, built by `buildToolbar()`) has a
      **grab handle**; pressing and dragging the handle repositions the toolbar via
      **DOM drag**.
- [ ] On the first drag, the toolbar's default centering transform
      (`transform:translateX(-50%)`) is converted to explicit fixed-viewport `left/top`.
- [ ] The toolbar position is **persisted in `chrome.storage.local`** under
      `snapdeckEditorToolbarPos: {left, top}` — NOT in the IndexedDB report store and
      NOT in the editor `model`.
- [ ] On editor open, `openEditor()` reads the stored position and re-applies it,
      **clamped to the current viewport**.
- [ ] A **toggle control** (new toolbar button via `btn()` pattern, wired through
      `bar.onToggleVisibility`) hides and shows the annotation layer
      (`annLayer.visible(false|true)` + redraw).
- [ ] When annotations are hidden, **selection chrome is also hidden** (`selectLayer`
      hidden); restored on show.
- [ ] When hidden, **raw captured screenshot (`bgLayer`) is visible with zero overlays**
      — `cursorLayer` is also hidden alongside `annLayer`/`selectLayer`; all three
      restored on show.
- [ ] The toggle is **non-destructive**: toggling off then on restores all annotations
      unchanged; never mutates `model`; never calls `snapshot()`.
- [ ] Toggling visibility **does not add an undo/redo step**.
- [ ] The toggle state is **not persisted**: every editor open starts with annotations
      shown.
- [ ] Toolbar drag and the toggle **never interfere with annotation drawing or
      selection** (pointer-capture + `stopPropagation` on handle and toggle button).
- [ ] **No regression:** existing arrow/box/text draw, select, transform, undo, and
      redo behave exactly as before.

*Note: feature.md ACs were updated mid-planning to add `cursorLayer` to the visibility
toggle scope (PO arbitration decision — conv 0022 § 2) and to add the export-guard
criterion (conv 0022 § 3).*

---

## Open questions deferred to implementation

None. All `clarifications.md` items (if any) were resolved during planning. The
one PO-visible flag (async apply-on-open flicker, `pre-hide-until-positioned`
mitigation) is the engineer's optional judgment call, not a blocking open question.
