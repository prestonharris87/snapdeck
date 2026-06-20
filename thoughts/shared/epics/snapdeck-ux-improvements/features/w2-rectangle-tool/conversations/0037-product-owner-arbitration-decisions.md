# PO arbitration decisions — w2-rectangle-tool

**product-owner → team-lead / record · 2026-06-20 (Phase 6 arbitrate)**

5 stories reviewed (fe-001, fe-002, be-001, db-001, do-001) + stress-test.md. Contrarian verdict:
0 block / 1 concern / 2 info. All promoted `pending → approved`.

## Cross-domain contract (the one real contract) — AFFIRMED, no conflict to break

Projected rectangle annotation `type` literal = **`"box"`**. fe-002's `projectAnnotations` emits it;
be-001's `_render_markdown` cases on it; be-001 `depends_on: [STORY-fe-002]` (YAML-valid, unquoted).
This was a **genuine, resolved disagreement** — the backend-architect initially leaned `"rect"`
(conv. 0019/0023) and was talked to `"box"` bidirectionally. The resolution is correct: the literal
is anchored to the **back-compat-locked model/wire `type:"box"`**, keeping one identifier end-to-end
(model → render dispatch → projection → controller) and holding the system to **two** rectangle names
(wire `"box"` / display 🟥+"Rectangle") instead of three. The room did **not** converge too easily
(real "rect"→"box" fight + contrarian concern + db/do sentinel peer-confirmations on record), so no
manufactured tension-probe — the contrarian finding set is the arbitration surface.

## Contrarian dispositions

**CONCERN — `type:"box"` literal coupling test-unenforced across the JS↔Python seam (fe-002 ⇄ be-001).**
→ **ACKNOWLEDGED RISK + cheap enforcing pin (option a), shared-fixture (option b) deferred, e2e (c) rejected.**
- Why (a): the projected literal is anchored to the immovable model/wire `"box"` (rename probability
  doubly-low); failure mode is **cosmetic** (`report.json` + report→defects pipeline unaffected; only
  the human `report.md` line degrades to a raw-dict dump); consumer side already has a
  no-raw-dict-fallthrough guard test.
- Enforcement applied: one-line **coupling comment on both** the `projectAnnotations` box branch and
  the `_render_markdown` box branch ("change the projected literal in lockstep"), + `## Acknowledged
  Risk` block on both stories + this record.
- (b) re-trigger (recorded): a shared cross-language JSON fixture (the only auto-detecting option)
  becomes worth its cost **if/when a second box-shaped primitive is added** (stress-test's latent
  name-collision) — at that point the projected literal may need to diverge from the wire literal and
  the low-risk anchor disappears. (c) rejected as disproportionate for a one-line/one-line branch pair.

**INFO#1 — `projectAnnotations` has no finite/≤0 geometry guard, unlike `renderBox` (fe-002).**
→ **PROMOTED (story-level).** Added the finite/`>0` guard to the box branch (mirrors `renderBox:324-325`,
pure inline check — `editor-model.js` stays dependency-free), a pinning unit test, a validate item, and
**extended feature.md render-guard AC #11** with a projection-symmetry clause. Rationale: free +
in-scope (the branch is being written) and closes an asymmetry with the feature's OWN render-guard
AC/E2E — without it a malformed hydrated box is skipped at render but leaks coerced garbage
(`x:null`, `0`-dims) into the upstream report, the exact pipeline this feature exists to feed. Lossless
round-trip unaffected (model items untouched; only the lossy projection skips). Consistent with the
w0 fe-004 / w1 fe-002 "promote the free in-scope guard when the feature's own AC contemplates the
hostile path" precedents on this epic.

**INFO#2 — client/controller version skew degrades report.md (be-001).**
→ **ACCEPT_AS_RECOMMENDATION.** Graceful degradation inherent to the independent-deploy split;
`report.json` opaque + correct regardless; self-heals on controller update. Standing guardrail: if a
controller/extension compatibility note or CHANGELOG ever lands, record that `report.md` rectangle
rendering needs a controller at/past be-001.

## Conformance fixes (recurring sentinel drift — fixed at arbitrate, cheaper than bouncing at finalize)

- **db-001 frontmatter:** added `type: story`, `id: STORY-db-001`, **`domain: database`** (load-bearing
  — database-validator selection), `parent_feature`, `parent_epic`, `created_at`. + one `- [ ]` validate
  item.
- **do-001 frontmatter:** normalized `feature`→`parent_feature`, `epic`→`parent_epic`. + one `- [ ]`
  validate item. (Carried forward the venv-qualified pytest precondition for the unit-tester.)
- Populated feature.md `## Stories` (was "none yet").

## depends_on validation (by inspection — no Bash in arbitrate mode)

- fe-001 `[]` ✓ standalone restyle · fe-002 `[]` ✓ producer of the projected contract · be-001
  `[STORY-fe-002]` ✓ the one producer→consumer edge, declared + YAML-valid · db-001 `[]` ✓ sentinel ·
  do-001 `[]` ✓ sentinel. **Flag:** the authoritative `scripts/validate-depends-on.py` run is the
  orchestrator's (no Bash in this mode) — recommend running it at finalize.
