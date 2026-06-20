---
type: story
id: STORY-do-001
name: "No devops changes required (sentinel)"
parent_feature: w2-rectangle-tool
parent_epic: snapdeck-ux-improvements
domain: devops
assignee: devops-engineer
author_architect: devops-architect
status: approved
sentinel: true
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/manifest.json
  - pyproject.toml
  - .claude/.github/workflows/notify-pr.yml
  - .claude/.github/workflows/ai-resolver.yml
reuse_patterns:
  - "extension/manifest.json:41 — content_scripts[1] entry (editor-model.js already registered, ordered before editor.js); no change needed"
  - "pyproject.toml:32 — [project.optional-dependencies] dev = [pytest>=8.0, ruff>=0.6]; pytest runner already declared"
  - "extension/editor.model.test.mjs — node --test suite (browser-not-injected; not a content script, not devops domain)"
depends_on: []
---

# STORY-do-001 — No devops changes required for this feature

## Verdict

**No devops changes are required for `w2-rectangle-tool`.** This is a sentinel story documenting
the verification that closes the devops domain for this feature. There is **no build-system, CI
pipeline, manifest/registration, local-service-dependency, env-config, secrets, or observability
work** to do.

## What we're doing

Recording the negative result. The feature edits three **existing** in-repo surfaces — the FE
content scripts `extension/content/editor.js` (restyle/relabel) and `extension/content/editor-model.js`
(projection), the existing frozen node-test `extension/editor.model.test.mjs`, and the controller
`controller/snapdeck_controller/reports.py` (`_render_markdown` rectangle branch) plus a **new**
controller pytest. None of these require any devops plumbing. The devops engineer should pick up
this story, confirm the findings below still hold against the frozen diff, and close it.

## Verification performed (grounded, not assumed)

### 1. No new content script / no manifest change

- `content/editor-model.js` is **already registered** at `extension/manifest.json:41`
  (`content_scripts[1].js = ["lib/konva.min.js", "content/bridge.js", "content/editor-model.js",
  "content/editor-chrome.js", "content/editor.js"]`), ordered **before** its consumer `editor.js`
  in the same isolated-world entry — the w0 STORY-do-001 registration. The projection change edits
  this already-registered file → **no manifest edit**.
- `editor.js` is likewise already registered (same entry) → restyle/relabel needs **no manifest edit**.
- The feature **births no new browser-loaded file**. The frozen test
  `extension/editor.model.test.mjs` is a `node --test` file (run directly by Node, **never injected
  into a page**) → it is **not** a content script → not the devops domain, no registration. This is
  the inverse of the w0/w1 "extract a browser-loaded module" seam that *did* spawn registration
  stories. (Confirmed with frontend-architect — see Peer confirmations.)

### 2. Controller pytest needs no test-runner / CI wiring

- `pyproject.toml:32` already declares `[project.optional-dependencies] dev = ["pytest>=8.0",
  "ruff>=0.6"]` → the pytest runner is **already available** (`pip install -e ".[dev]"`). No
  dependency-management change.
- There is currently **no `test_*.py` anywhere in the repo** and **no `[tool.pytest.ini_options]`
  section**, so the BE story's controller test is the repo's *first* pytest file. pytest
  **auto-discovers** `test_*.py` from the project rootdir with zero config, so a file placed next to
  `reports.py` (or under a `controller/tests/` dir) is found by a plain `pytest` invocation, and the
  `unit-tester` (Phase 5a) discovers runners from the repo per `testing.md`. **No new test-runner
  target and no devops config is required.** (An optional `[tool.pytest.ini_options] testpaths`
  for deterministic discovery was offered to backend-architect as a non-binding note; it is the
  BE test-placement decision, not a devops story.)
- There is **no project CI surface** to wire a pytest/node step into: no repo-root
  `.github/workflows/`. The only workflow YAMLs in the tree live under `.claude/.github/workflows/`
  and are **framework infrastructure** (PR-notify / ticket-consolidation / AI-resolver), explicitly
  **not** the project's build/test CI. There is nothing to add a test stage to.
- **Editable-install precondition — CONFIRMED against the documented dev env (not assumed).**
  `controller/snapdeck_controller` lives under `controller/` (not repo root), and there is **no
  `conftest.py`**, so `from snapdeck_controller.reports import _render_markdown` only resolves under
  pytest when the package is installed editable. `CONTRIBUTING.md:26` documents exactly that as the
  standard dev setup: `uv venv .venv && uv pip install -e '.[dev]'` — which installs the package
  editable **and** brings in pytest (the `[dev]` extra). `CONTRIBUTING.md:49` also confirms "there
  isn't a formal test suite yet," i.e. the BE pytest is the repo's first test and pytest lives
  **only** inside that `.venv`. **Operational caveat for the unit-tester (Phase 5a) lane:** the
  controller pytest MUST be invoked from within that venv — `.venv/bin/python -m pytest
  controller/tests/test_reports.py` (or activate `.venv` first) — because a bare system `pytest`
  would lack both the editable `snapdeck_controller` package and pytest itself. This is the single
  precondition that could break test *collection*; it is an environment/runbook concern (my domain),
  recorded here and surfaced to backend-architect, not a code change. backend-architect has made the
  editable-install precondition explicit in STORY-be-001's validation section.

### 3. No new build target

The project is an unpacked Chrome extension (raw unbundled JS + a plain `manifest.json`, vendored
`lib/konva.min.js`, no bundler) plus a hatchling-built Python package (`pyproject.toml`
`[tool.hatch.build.targets.wheel] packages = ["controller/snapdeck_controller", ...]`). Restyling an
existing content script and adding a co-located test file require **no build-target change**.

### 4. No env-config / secrets / local-service-dependency change

No new env var, no secret, no local backing service (DB/broker/cache) is introduced. The rectangle
rides the existing opaque `model` field and the existing `/report/save` path. Nothing in the devops
plumbing moves.

## Observability (mandatory cross-cutting concern — evaluated, N/A)

The feature **does** change runtime behavior (a new report-visible rectangle annotation reaches the
`/report/save` projection). Per the required-cross-cutting rule I evaluated observability explicitly:

- **Snapdeck has no logging/metrics/tracing stack to extend** — it is an unpacked MV3 extension plus
  a thin local controller; there is no telemetry surface, no metrics sink, no tracing backend.
- The runtime-behavior change is covered by the **PO E2E specs** (projection-reaches-`/report/save`,
  byte-identical arrow, lossless round-trip, render-guard) and the **FE/BE unit tests** (the updated
  `editor.model.test.mjs` projection contract + the new controller `_render_markdown` pytest).

**Verdict: observability is N/A** — no stack to extend; manufacturing a telemetry story here would
be inventing infra the project does not have.

## How we validate (sentinel close-out for the devops-engineer)

- [ ] **Sentinel negative assertion:** `git diff --name-only` for this feature shows **no** devops
  changes — no `extension/manifest.json` edit, no `pyproject.toml` change, no `.claude/.github/workflows/`
  change, no new content script / new build target. `files_modified: []` holds; `editor-model.js`
  remains registered before `editor.js` in `content_scripts[1].js`.

1. `git diff --name-only` for the feature shows **no** changes to `extension/manifest.json`,
   `pyproject.toml`, or any file under `.claude/.github/workflows/` attributable to devops.
2. Manifest well-formedness still holds and `editor-model.js` remains registered before `editor.js`:
   `node -e "const m=require('./extension/manifest.json'); const js=m.content_scripts[1].js;
   if (js.indexOf('content/editor-model.js') >= js.indexOf('content/editor.js')) process.exit(1)"`
   (sanity check only — this story changes nothing).
3. The existing JS suite still runs green: `node --test extension/*.test.mjs` (currently 121/121;
   the FE story updates the frozen projection tests in the same change).
4. The new controller pytest is discoverable and green from rootdir: `pytest` (BE-authored test;
   pytest already declared in `pyproject.toml` `[dev]`).

If any of the above reveals a devops-touching change has crept in (a new content script, a manifest
edit, a CI YAML, a new build target), **stop and re-open this domain** — that would invalidate the
sentinel.

## Unit tests

None — this story produces no diff. The manifest-shape sanity check in "How we validate" step 2 is
the no-build validation lane (pure `node` JSON parse + index assertion) and exists only to prove the
sentinel held, not as a new test artifact.

## Dependencies

`depends_on: []` — **genuinely standalone**. A sentinel asserting "no devops work" neither produces
nor consumes a devops artifact, so it has no producer/consumer edge to any FE/BE/DB story. The FE
projection/restyle story and the BE controller `_render_markdown`/pytest story proceed independently;
this story only records that none of their work crosses into the devops domain.

## Peer confirmations (Phase 5→6 floor)

- **backend-architect** — asked whether the controller pytest needs a new test-runner target / CI
  entry; presented my finding (pytest already in `pyproject.toml` `[dev]`, auto-discovery works, no
  project CI exists) and offered an optional non-binding `[tool.pytest.ini_options]` for deterministic
  discovery as their call.
- **frontend-architect** — asked to confirm the projection + frozen-test work births **no new
  browser-loaded module** (which would otherwise need a `content_scripts[].js` registration story).
  **CONFIRMED (reply received):** fe-001 edits `editor.js` in place; fe-002 edits `editor-model.js`
  in place (already `content_scripts[1].js`, no manifest change) and updates the `node --test`
  `editor.model.test.mjs`. **No new `content/*.js` file is born, no new isolated-world global, no
  registration entry needed.** Sentinel is final.

## Revisions

- **2026-06-20 — product-owner (arbitrate).** Promoted `status: pending → approved` (sentinel).
  Contrarian had **no findings** for this story. Frontmatter conformance: normalized `feature` →
  `parent_feature` and `epic` → `parent_epic` (template-standard keys used by the other stories;
  `domain: devops` and `id` were already correct). Added one `- [ ]` validate item (finalize floor:
  ≥1 checkbox per story; the close-out was a numbered list). No change to the sentinel verdict — zero
  devops work is correct (both files already registered in `content_scripts[1]`; pytest already a
  declared `[dev]` dep with zero-config auto-discovery; no project CI surface to wire). **Carry-forward
  for the unit-tester (Phase 5a):** the BE controller pytest is venv-qualified —
  `.venv/bin/python -m pytest controller/tests/test_reports.py` (a bare system `pytest` fails
  collection; the editable `snapdeck_controller` + pytest live only in `.venv` per CONTRIBUTING.md:26).
