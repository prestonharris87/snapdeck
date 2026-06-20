---
type: story
id: STORY-be-001
name: "Render rectangle annotation in report.md human summary"
domain: backend
parent_feature: w2-rectangle-tool
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 1
status: approved
depends_on: [STORY-fe-002]
diff_estimate: substantive
files_modified: [controller/snapdeck_controller/reports.py, controller/tests/test_reports.py]
files_not_modified: [controller/snapdeck_controller/server.py, controller/snapdeck_controller/core.py, controller/snapdeck_controller/cli.py, controller/snapdeck_controller/config.py, controller/snapdeck_controller/paths.py, extension/content/editor-model.js, pyproject.toml]
reuse_patterns: [controller/snapdeck_controller/reports.py:221, controller/snapdeck_controller/reports.py:223, controller/snapdeck_controller/reports.py:210]
created_at: 2026-06-20T16:45:00Z
last_run_id: run-20260619-021434-24507
visual_references: []
defects: []
---

# Story: Render rectangle annotation in report.md human summary

## What we're doing

Add a rectangle branch to `_render_markdown` in `controller/snapdeck_controller/reports.py`
so a rectangle annotation (the projected `{id, type:"box", x, y, width, height}` shape that
STORY-fe-002 starts emitting from `projectAnnotations`) renders as a clean, human-readable line
in the report bundle's `report.md`. Today a rectangle falls through the function's catch-all
`else` (`reports.py:228`) and dumps the raw Python dict repr into the human summary. This story
adds a proper branch that renders the rectangle in the same house style as the existing
arrow/text lines, and adds the repo's first controller `pytest` covering the new branch plus a
no-regression guard on the existing text/arrow rendering. `report.json` already stores the
rectangle opaquely (no change there) — this is the human-readable `report.md` surface only.

## What it should look like

This is **not an HTTP endpoint** — it is a pure rendering helper invoked by `save_report`. The
"contract" is the input dict shape and the output markdown line.

**Auth:** N/A — this story modifies an internal render helper, not an endpoint. The enclosing
`/report/save` controller endpoint (localhost-only controller surface) is unchanged by this story;
no auth surface is added, removed, or modified.

**Input** — a `report` dict as built by `save_report`, whose `screenshots[].annotations` may
contain a rectangle entry of the projected shape (coordinates already `Math.round`ed upstream by
STORY-fe-002's projection emitter):

```json
{ "id": "b1", "type": "box", "x": 300, "y": 80, "width": 160, "height": 90 }
```

**Output** — inside the existing `**Annotations:**` list, the rectangle renders as a single line
in the arrow/text house style (leading emoji + parenthesized origin + dimensions):

```
- 🟥 (300,80) 160×90
```

- Emoji `🟥` (echoes the red-outline rectangle's house colour), then `(x,y)` origin, then
  `width×height` using the `×` (U+00D7) separator already used by the viewport line
  (`reports.py:210`). No literal word "box"/"Rectangle" in the line — the sibling branches
  (`📝` text, `➡️` arrow) don't print their type word either; the emoji is the type signal.
- It MUST NOT fall through to the raw-dict catch-all `- {a}` (`reports.py:228`).
- The existing text (`📝`) and arrow (`➡️`) lines stay byte-identical.

**Type literal note:** the cased string is `"box"` — ratified with the frontend-architect (see
`## Cross-domain contract`). The wire/projected string `"box"` and the human-readable render are
intentionally decoupled (the same decoupling already applied to the model type `"box"` ↔ toolbar
"Rectangle").

## Existing behavior baseline

- **Currently:** `controller/snapdeck_controller/reports.py:220-228` — `_render_markdown`'s
  annotation loop cases only `type == "text"` (lines 221-222) and `type == "arrow"`
  (lines 223-226); any other type hits `else: lines.append(f"- {a}")` (lines 227-228), which dumps
  the raw Python dict repr (e.g. `- {'id': 'b1', 'type': 'box', 'x': 300, 'y': 80, ...}`).
- **Dispatch path / call graph:** FE `projectAnnotations` (`extension/content/editor-model.js:45-63`;
  STORY-fe-002 adds the `box → {type:"box", ...}` projection) → `/report/save` payload
  `annotations` → `save_report` stores it opaquely (`shot.get("annotations") or []`,
  `reports.py:147`) → `report.json` (`reports.py:172`) **and** `_render_markdown(report)` →
  `report.md` (`reports.py:173`).
- **No-regression assertion:** the `text` (221-222) and `arrow` (223-226) render branches stay
  byte-identical; `save_report`'s opaque annotation storage (147) and `report.json` output (172)
  are untouched; the console (230-240) and network-failure (241-249) rendering is untouched.
- **Explicitly changing:** insert one `elif a.get("type") == "box":` branch **before** the `else`
  (227) that renders the rectangle as `- 🟥 (x,y) width×height`; add the first controller pytest.
- **Verified:** 2026-06-20 — opened `controller/snapdeck_controller/reports.py` (`_render_markdown`
  lines 184-250, `save_report` lines 108-181).

## How we're doing it

1. **Edit `controller/snapdeck_controller/reports.py`**, function `_render_markdown`, in the
   annotation loop (currently lines 220-228). Add a new branch between the `arrow` branch and the
   `else`:

   ```python
   # Coupling (PO arbitration): the "box" literal is the projected type STORY-fe-002's
   # projectAnnotations emits. If that projected literal ever changes, this branch MUST change in
   # lockstep or the rectangle falls through the raw-dict `else` below. (Test-unenforced across the
   # JS↔Python seam — see ## Acknowledged Risk.)
   elif a.get("type") == "box":
       lines.append(f"- 🟥 ({a.get('x')},{a.get('y')}) {a.get('width')}×{a.get('height')}")
   ```

   - Use `.get()` accessors (matching the defensive pattern of the sibling `text`/`arrow`
     branches) so a missing key renders `None` rather than raising — consistent with siblings.
   - Do NOT add per-field validation or re-rounding. The FE projection already `Math.round`s the
     coordinates; "trust upstream" matches how the arrow/text branches render their already-rounded
     values. Introducing a divergent rounding/validation behavior here would be an inconsistency,
     not a safety improvement.
   - The cased literal is `"box"` — coupled to STORY-fe-002's emitter (see `## Cross-domain
     contract`). Keep emitter and renderer on the same literal.

2. **Do NOT touch** `save_report`, the opaque annotation storage (line 147), `report.json`
   generation (line 172), or the console / network-failure rendering. The rectangle is already
   persisted into `report.json` opaquely; this story changes only the `report.md` human render.

3. **Add `controller/tests/test_reports.py`** (the repo's first controller pytest file). Import
   `from snapdeck_controller.reports import _render_markdown`. Build `report` dicts inline
   (deterministic — no filesystem, no network, per testing-conventions "deterministic by default").
   - **No `conftest.py` and no `pyproject.toml` change.** `pytest>=8.0` is already declared in
     `pyproject.toml:32` (`[project.optional-dependencies] dev`); pytest auto-discovers `test_*.py`
     with zero config. Test-runner config (e.g. a `[tool.pytest.ini_options]` block) is
     intentionally out of scope (devops domain, and not needed — see `## Cross-domain contract`).
   - **Run from the project venv.** The documented dev setup (`CONTRIBUTING.md:26`) is
     `uv venv .venv && uv pip install -e '.[dev]'`, which editable-installs `snapdeck_controller`
     AND pulls pytest into `.venv` only (no system-wide install; `CONTRIBUTING.md:49` confirms there
     is no formal suite yet — this is the repo's first test). The import
     `from snapdeck_controller.reports import _render_markdown` therefore resolves **only inside
     `.venv`**. Invoke tests venv-qualified — `.venv/bin/python -m pytest …` (or activate `.venv`
     first); a bare system `pytest` lacks both pytest and the editable package and fails collection.
     (Precondition + caveat confirmed with devops-architect against `CONTRIBUTING.md`.)

## How we validate it was done correctly

- [ ] `_render_markdown` on a report whose `screenshots[].annotations` includes
  `{id:"b1", type:"box", x:300, y:80, width:160, height:90}` produces the line
  `- 🟥 (300,80) 160×90` inside the `**Annotations:**` block.
- [ ] That output does **not** contain a raw-dict fallthrough for the rectangle (no `- {` line and
  no `'type': 'box'` repr substring) — i.e., the `else` is not reached for a box.
- [ ] A report with text + arrow + box annotations renders all three with the correct prefixes
  (`📝` / `➡️` / `🟥`) in input order; the text and arrow lines are byte-identical to pre-change.
- [ ] `.venv/bin/python -m pytest controller/tests/test_reports.py` passes from the repo root
  (venv-qualified — pytest + the editable `snapdeck_controller` package live only inside `.venv`
  per `CONTRIBUTING.md:26`; a bare system `pytest` would fail collection).
- [ ] `ruff` is clean on both edited files (line-length 100, per `pyproject.toml:46`).
- [ ] `report.json` content and `save_report` behavior are unchanged (the rectangle was already
  stored opaquely; only the `report.md` human render changes).

## Motion contract

n/a

## Unit tests

- `controller/tests/test_reports.py` — `test_render_markdown_box_renders_clean_line` — a report
  dict with one screenshot containing a single `type:"box"` annotation → output contains
  `- 🟥 (300,80) 160×90` and does NOT contain the raw-dict repr substring `'type': 'box'`.
- `controller/tests/test_reports.py` — `test_render_markdown_box_not_raw_dict_fallthrough` —
  asserts the rendered markdown has no catch-all `- {` line for the box (directly guards the
  regression this story fixes).
- `controller/tests/test_reports.py` — `test_render_markdown_text_and_arrow_unchanged` —
  no-regression: a report with text + arrow annotations renders the exact existing
  `- 📝 (x,y) "…"` and `- ➡️ [..] → [..]` lines (frozen sibling format).
- `controller/tests/test_reports.py` — `test_render_markdown_mixed_annotation_order_preserved` —
  text + arrow + box in one screenshot render in input order with the correct prefixes.
- `controller/tests/test_reports.py` — `test_render_markdown_box_missing_geometry_does_not_raise` —
  a `{type:"box"}` with missing `width`/`height` renders without raising (defensive `.get()` →
  `None`), matching the sibling-branch robustness.

## Dependencies

- **STORY-fe-002** — the FE projection story that adds the rectangle to `projectAnnotations` and
  emits the projected `{id, type:"box", x, y, width, height}` entry this branch cases on. This
  controller branch is a cross-domain **consumer** of that projected `type` contract; the two MUST
  stay coupled on the `"box"` literal. (Ratified with frontend-architect, 2026-06-20.)
- No DB story (the controller persists to flat `report.json`/`report.md`; storage is opaque — DB
  sentinel confirmed with database-architect, 2026-06-20).
- No DevOps story (pytest already a declared dev dep; auto-discovery needs no CI/config wiring —
  confirmed with devops-architect, 2026-06-20).

## Cross-domain contract

- **Projected rectangle `type` literal = `"box"`** (ratified with frontend-architect, 2026-06-20).
  STORY-fe-002's `projectAnnotations` emits
  `{ id, type:"box", x:round(x), y:round(y), width:round(width), height:round(height) }`; this
  story's `_render_markdown` branch cases on `a.get("type") == "box"`.
  **Rationale:** the existing frozen projection never renames a type literal (arrow→`"arrow"`,
  text→`"text"`) — it only reshapes fields. Keeping box→`"box"` preserves that single-source-of-truth
  invariant and holds the system to **two** rectangle identifiers (wire `"box"`, display
  "Rectangle"/🟥) instead of **three** (a stray `"rect"` would add a third name and a second
  wire↔display decoupling seam). The wire string and the human render are intentionally
  decoupled — `report.md` shows 🟥 + geometry, never the word "box".
- **Coupling guarantee:** if STORY-fe-002 ever changes the projected `type` literal, this story's
  branch literal MUST change in lockstep, or the rectangle silently falls back to the raw-dict
  catch-all. The coupling is documented on both sides.

## History

- 2026-06-20 — created by backend-architect (effort=1, depends on STORY-fe-002; projected `type`
  literal `"box"` ratified with frontend-architect; DB sentinel + no-devops-wiring confirmed with
  database-architect / devops-architect).

## Contrarian Findings

### Finding 1 — The `type:"box"` literal coupling to STORY-fe-002 is documented but test-unenforced (consumer side)

**Severity:** concern
**Mechanism:** This branch (`elif a.get("type") == "box":`) and STORY-fe-002's emitter are
coupled on the `"box"` string and the room is relying on prose-level documentation ("must move in
lockstep", conversations 0019/0023) as the mitigation. But this story's pytest feeds a hand-built
`{type:"box"}` dict into `_render_markdown`, and fe-002's node test asserts the emitter shape
independently — neither runs the real emitter output through this real renderer. If the projected
literal is ever changed on the FE side without changing this branch (or vice-versa), **both** suites
stay green and the rectangle silently falls through this function's raw-dict catch-all `else`
(`reports.py:227-228`) into a `- {'id':...}` dump in `report.md` — the exact regression this story
exists to fix, reappearing with no red test. Verified 2026-06-20: `_render_markdown`
(`reports.py:220-228`) is the only annotation-`type`-discriminating consumer in the repo (the MCP
server and the rest of `controller/` handle `annotations` opaquely), so this `else` is the single
silent-decay point. See the symmetric finding on STORY-fe-002.
**Recommendation:** acknowledge as a known contract-decay risk, and prefer an enforcing guard over
prose — a shared canonical box-shape fixture loaded by **both** the node test and this pytest, or an
end-to-end PO E2E (real `projectAnnotations` → real `_render_markdown`) so a one-sided literal change
fails a test. If neither, add an explicit `## Acknowledged Risk` that the coupling is test-unenforced
and the projected literal is a coordinated two-file edit.

### Finding 2 — Client/controller version skew: a newer extension emitting `box` to an older controller renders the raw-dict dump in report.md

**Severity:** info
**Mechanism:** The extension (which starts emitting `type:"box"` in fe-002) and the in-repo Python
controller are **separately deployed** — the controller is a locally-run process the user updates
independently. A user who updates the extension but runs a controller built before this story has no
`box` branch, so the projected rectangle hits the catch-all `else` and dumps the raw annotation dict
into `report.md` (`- {'id':'b1','type':'box',...}`). This is graceful degradation, not a crash —
`report.json` stores the rectangle opaquely and correctly regardless, and any report→defects
consumer reading `report.json` is unaffected — so it is an info, not a concern. It is also partly
inherent to the client/server split rather than a flaw in this story. Worth recording because the
human-summary regression is invisible until someone eyeballs an old-controller report.
**Recommendation:** acknowledge; no code change required for this story. If the project ever gains a
controller/extension compatibility note or changelog, mention that `report.md` rectangle rendering
requires a controller at or past this story.

## Acknowledged Risk

**The projected `type:"box"` literal coupling (STORY-fe-002's emitter ⇄ this `_render_markdown`
consumer) is test-unenforced across the JS↔Python seam.** This is the consumer half of the symmetric
finding on STORY-fe-002 — see that story's `## Acknowledged Risk` for the full disposition. Summary:
accepted because the projected literal is anchored to the back-compat-locked model/wire `type:"box"`
(realistic rename probability doubly-low) and the failure mode is cosmetic (`report.json` is opaque
and correct regardless; only the human `report.md` line degrades). Enforcement applied here: the
one-line coupling comment on the box branch (above) + this story's existing
`test_render_markdown_box_not_raw_dict_fallthrough` consumer guard. The shared-cross-language-fixture
option is deferred with an explicit re-trigger (a future second box-shaped primitive) — see fe-002.

## Security Review

**Reviewer:** security-architect · **Date:** 2026-06-20 · **Verdict:** INFO (clean — no change required)

STRIDE pass on the controller `_render_markdown` box branch, grounded against
`controller/snapdeck_controller/reports.py` (`_render_markdown` lines 184-250, `save_report` 108-181,
read 2026-06-20). All findings INFO.

- **Injection (the headline question) — no new vector.** The planned branch is
  `f"- 🟥 ({a.get('x')},{a.get('y')}) {a.get('width')}×{a.get('height')}"`. Two reasons this is safe:
  1. **Not format-string injection.** Python f-string substitution fills the `{...}` placeholders by
     `str()`-coercing the value; the inserted value is **not** re-parsed as a format spec, so there is
     no `%n`/`{0.__class__}`-style escape — unlike `str.format(user_input)` or `%`-logging. The
     literal format template is fixed in source.
  2. **Numeric-only fields, and `id` is not rendered.** The branch renders only `x/y/width/height` —
     `Math.round`ed ints from the projection (fe-002) — and deliberately omits `id`. So the rectangle
     introduces **no new arbitrary-string sink** into `report.md`. The only such sink on this surface
     remains the **pre-existing** `text` annotation (`reports.py:222` renders `a.get('text')`, a genuine
     user string) plus console messages / network URLs — all unchanged by this feature. The rectangle is
     strictly narrower than what already ships.
- **Trust-upstream is the correct call here.** Using bare `.get()` accessors with no re-validation /
  re-rounding matches the sibling `text`/`arrow` branches. The annotation reaching the controller is the
  projection output (fe-002's finite/`≤0` guard already filtered malformed boxes upstream). Adding
  divergent per-field validation to *only* the box branch would be an inconsistency, not a safety gain —
  agree with the story's explicit "do NOT add per-field validation" directive.
- **Forward note (pre-existing, OUT OF SCOPE for this feature — recorded, not a finding):** `report.md`
  is consumed downstream by the report→defects / AI-resolver pipeline, i.e. it is an LLM-prompt surface.
  The arbitrary-string→`report.md` path (the `text` annotation, console output, network URLs) is a
  pre-existing content-injection-adjacent surface that this feature **does not widen** (rectangle =
  numeric-only). Do **not** attempt to remediate that pre-existing surface inside the rectangle branch —
  the rectangle is the wrong lever. If the project ever wants to harden the AI-resolver prompt surface,
  that is a separate, broader story against the `text`/console/network sinks, not this one. No
  `STORY-sec` minted against this feature.
- **AuthN/AuthZ — N/A.** This story edits an internal render helper, not an endpoint; the enclosing
  localhost-only `/report/save` surface is unchanged (no auth added/removed/modified). EoP N/A.
- **Repudiation / audit — N/A.** No entity table; `report.json` already records `git.branch`/`git.sha`/
  `created_at` (`reports.py:163-171`). Flat-file output, no DB (db-001 sentinel). No audit-column
  surface exists to extend.
- **Version-skew INFO (contrarian Finding 2) — concur.** A newer extension emitting `box` to an older
  controller renders the raw-dict dump in `report.md`; graceful degradation, `report.json` stays correct.
  Not a security issue (no escalation, no info leak) — affirm the PO disposition.

Disposition: affirm as-is. Clean INFO pass — expected for a localhost-only flat-file render helper. No
`STORY-sec`. Default checklist recorded N/A (no endpoint/authn/authz/CSRF/CORS/rate-limit; no entity
table → no audit columns; not multi-tenant; no parameterized-query surface — flat-file write only).

**PO disposition:** ACCEPT_AS_RECOMMENDATION — injection is a non-issue (fixed f-string template, `str()`-coercion is NOT format-spec re-parse, numeric-only fields, `id` deliberately unrendered → no new arbitrary-string sink in `report.md`); trust-upstream matches the sibling text/arrow branches and the fe-002 guard already filters malformed boxes. The pre-existing `report.md`→AI-resolver LLM-prompt surface (the `text`/console/network sinks) is NOT widened by the numeric rectangle and is explicitly OUT OF SCOPE — do NOT remediate inside the rectangle branch (wrong lever); if ever pursued it is a separate, broader story against those sinks (a BOSS/epic-backlog call, not this feature). Version-skew INFO concurs with be-001's INFO#2 disposition. No STORY-sec, no AC change.

## Revisions

- **2026-06-20 — product-owner (arbitrate).** Promoted `status: pending → approved`. Cross-domain
  contract reviewed and **affirmed**: this branch cases on `"box"`, identical to STORY-fe-002's
  projected literal; `depends_on: [STORY-fe-002]` correctly declares the producer→consumer edge
  (YAML-valid, unquoted). This reflects the arbitrated resolution of the BE architect's initial
  `"rect"` lean → `"box"` — the right call (anchored to the immovable model/wire literal; holds the
  system to two identifiers — wire `"box"` / display 🟥+"Rectangle" — not three).
- **Contrarian CONCERN (literal coupling, consumer side) → ACKNOWLEDGED RISK + cheap enforcing pin.**
  Added the coupling code comment on the box branch; kept the existing no-raw-dict-fallthrough guard
  test as the consumer-side enforcement. See `## Acknowledged Risk` (cross-linked to fe-002's full
  disposition). No behavior change.
- **Contrarian INFO#2 (client/controller version skew) → ACCEPT_AS_RECOMMENDATION.** No code change:
  the skew (newer extension → older controller renders the raw-dict dump in `report.md`) is graceful
  degradation inherent to the independent-deploy split; `report.json` is opaque and correct regardless,
  and it self-heals when the controller is updated past this story. **Standing guardrail:** if the
  project ever adds a controller/extension compatibility note or CHANGELOG, record that `report.md`
  rectangle rendering requires a controller at/past STORY-be-001.
