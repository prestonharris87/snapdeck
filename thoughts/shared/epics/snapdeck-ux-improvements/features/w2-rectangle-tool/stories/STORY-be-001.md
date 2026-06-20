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
status: pending
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
