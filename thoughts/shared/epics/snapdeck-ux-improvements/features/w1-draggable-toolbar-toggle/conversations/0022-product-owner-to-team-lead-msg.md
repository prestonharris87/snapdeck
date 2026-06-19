---
from: product-owner
to: team-lead
feature: w1-draggable-toolbar-toggle
run_id: run-20260619-042600-10898
phase: arbitrate
written_at: 2026-06-19T04:42:00Z
---

# Arbitration record — w1-draggable-toolbar-toggle

Stories arbitrated: STORY-fe-001, fe-002, fe-003, do-001, be-001 (sentinel),
db-001 (sentinel). All promoted `pending → approved`. No `## Arbitration Block`
deadlock — every item resolved cleanly. Per-story rationale lives in each story's
`## Revisions` block; this file is the cross-cutting record + the tension-pair note.

## 1. CONCERN resolved — manifest load-order regression guard now owned

do-001 declared the `editor-model < editor-chrome < editor` load order
"load-bearing" and promised a `node --test` assertion of it, but parked the
assertion in FE-owned `editor.chrome.test.mjs` while declaring only `manifest.json`
in `files_modified`; fe-001's test list had no manifest-order case → owned by
neither. **Resolution (per team-lead direction + contrarian recommendation):**
assigned the order + path-exists assertion to **fe-001** (FE owns the test file) as
both a `## How we validate` item and a `## Unit tests` case. It's a pure `fs` read of
`manifest.json` *inside the test file* — the `editor-chrome.js` module stays
chrome/window/document/Konva-free (core constraint intact). do-001 now **references**
the guard (runs `node --test extension/*.test.mjs` as a validate step) instead of
"contributing to" a file it doesn't own — no undeclared cross-domain FE-test edit for
the devops-validator to reject.

## 2. INFO dispositions (each consciously recorded)

- **fe-002 async apply-on-open flicker** — ACCEPTED as-is (dev tool; per-open
  one-frame center→stored jump is acknowledged). The await-the-async-storage-read
  requirement (else the persistence E2E flakes on the default-center frame) is wired
  into feature.md's persistence E2E as a browser-tester implementation note.
- **fe-003 `cursorLayer` over the "raw" capture** — **DECIDED: also hide
  `cursorLayer`** (the toggle now hides 3 overlay layers, not 2). Reframed as scope
  *intent*-fidelity, not creep: the locked 2-layer enumeration predated the
  contrarian's "4 layers" discovery, and the value prop is literally "inspect the
  **raw** screenshot." Wired minimally (reuse the existing `v.annVisible` flag → no
  `editor-chrome.js` contract/test change; export guard restores all 3 layers so
  Done-while-hidden stays byte-identical to the never-toggled path). feature.md AC +
  E2E updated.
- **fe-003 draw/undo-while-hidden footgun** — ACCEPTED as conscious out-of-scope
  (disabling tools while hidden is a different feature). Logged a deferred,
  non-blocking usability follow-up.
- **`buildToolbar()` is the real cross-feature serialization seam with
  `w1-text-box-autofit`** (not `finish()`) — noted on fe-002 + fe-003. No bar-field
  name collision. **For BOSS:** serialize implement so the second-to-merge engineer
  rebases on the first's `buildToolbar()` additions deliberately. Surface at
  STORIES_LOCKED.

## 3. E2E gap closed

Added feature.md § "Test: Done while annotations are hidden still saves a PNG WITH
the annotations (export guard)" — covers fe-003's required export guard (restore all
3 overlay layers before `toDataURL`; cancel path returns before rasterize). Contrarian
independently verified the guard + cancel path sound; this E2E locks it in.

## 4. do-001 `diff_estimate: mechanical` — ratified, no change

One manifest `js`-array element, matching released w0 STORY-do-001. Confirmed.

## 5. Sentinel hygiene

be-001 shipped with **no** `## How we validate` checklist (recurring snapdeck
sentinel gap) — added 3 diff-checkable `- [ ]` items (empty-backend / frozen
`ANNOTATE` / position-never-on-a-backend-surface). db-001 already had 4 — ratified.

## 6. depends_on validation (arbitrate doctrine)

All `depends_on` accurate, acyclic, reference existing stories, YAML-valid (unquoted
ids): fe-001 `[]` → do-001 `[fe-001]` → fe-002 `[do-001]` → fe-003 `[do-001, fe-002]`;
be-001 `[]`, db-001 `[]` (sentinels). Clean `fe-001 → do-001 → fe-consumers` chain,
mirroring w0's `fe-005 → do-001 → fe-003/fe-004`. Will confirm exit-0 on
`validate-depends-on.py` at finalize.

## 7. Tension-pair consideration (BIAS_LIMIT — documented, not manufactured)

This is an **FE-dominant** feature (all real work in `editor.js` + a new pure module;
BE/DB are grounded sentinels, DO is a 1-element mechanical manifest edit). There is no
genuine cross-architect contract fight to probe — the FE↔DO (load order), FE↔BE
(persistence boundary), FE↔DB (sentinel) negotiations were all peer-resolved and
logged in conversations/, and the contrarian's 1 concern + 4 info were the real
arbitration surface. Per the persona's BIAS_LIMIT, I did **not** manufacture a
tension-pair probe where consensus is genuine — recording "considered, no
inter-domain conflict to probe" so retros see the call was conscious. (Consistent with
the w0-per-target-reports single-domain arbitrate run.)
