---
sequence: 0005
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:54:35Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
---

✅ **Arbitrate complete.** All 6 stories `pending → approved`. No `## Arbitration Block` deadlock. Per-story rationale in each story's `## Revisions`; cross-cutting record at `conversations/0022-product-owner-to-team-lead-msg.md`.

**1) CONCERN resolved — manifest load-order guard now owned (fe-001).** Assigned the `index(editor-model) < editor-chrome < editor` + path-exists assertion to **fe-001** (FE owns `editor.chrome.test.mjs`) as a `## How we validate` item + a `## Unit tests` case — pure `fs` read *in the test file*, module stays chrome/window-free. **do-001** now *references* the guard (runs `node --test extension/*.test.mjs` as a validate step) instead of "contributing to" a file it doesn't own — no undeclared cross-domain FE-test edit for the devops-validator.

**2) INFO dispositions:**
- **fe-002 async flicker** → ACCEPTED as-is; the await-the-async-storage-read requirement is now an explicit browser-tester note on feature.md's persistence E2E (anti-flake).
- **fe-003 cursorLayer** → **DECIDED: hide it too.** The toggle now hides 3 overlay layers (ann/select/cursor) so "inspect the raw screenshot" is truly raw. Reframed as scope-*intent* fidelity, not creep (the locked 2-layer enumeration predated the contrarian's 4-layer discovery). Wired free: reuse existing `annVisible` flag (no `editor-chrome.js` contract change) + export guard restores all 3 so Done-while-hidden stays byte-identical. feature.md AC + E2E updated.
- **fe-003 draw-while-hidden footgun** → ACCEPTED conscious out-of-scope; logged a deferred non-blocking follow-up.

**3) E2E gap closed** — added feature.md § "Test: Done while annotations are hidden still saves a PNG WITH the annotations (export guard)."

**4) do-001 `diff_estimate: mechanical`** — ratified, no change (one manifest js-array element, matches released w0 STORY-do-001).

**5) Sentinel hygiene** — be-001 had **no** validate checklist (recurring snapdeck gap) → added 3 diff-checkable `- [ ]` items. db-001 already had 4 → ratified.

**6) depends_on** — all accurate/acyclic/YAML-valid (unquoted): `fe-001 [] → do-001 [fe-001] → fe-002 [do-001] → fe-003 [do-001, fe-002]`; be-001/db-001 `[]` sentinels. Will exit-0 on `validate-depends-on.py` at finalize.

⚠️ **For BOSS (STORIES_LOCKED):** the real `editor.js` serialization seam with **w1-text-box-autofit** is **`buildToolbar()`** (both add toolbar buttons + extend the `bar` API there), NOT `finish()`. No `bar`-field name collision — it's a textual-region rebase. Serialize implement so the second-to-merge engineer rebases on the first's `buildToolbar()` additions deliberately.

**Tension-pair note (BIAS_LIMIT):** FE-dominant feature; no genuine cross-architect contract fight to probe (FE↔DO/BE/DB negotiations all peer-resolved + logged; contrarian's 1 concern/4 info were the real surface). Recorded "considered, no probe needed" rather than manufacturing one.

Note: feature.md `status` left at `planning` (you stamp `planned` at plan-lock post-DAG-validation). Going idle — not shutting down. Ready for finalize (post-security) or your next transition.
