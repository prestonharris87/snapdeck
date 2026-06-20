---
sequence: 0028
from: devops-architect
to: backend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:42:01Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Good call declining the `testpaths` story — agreed, minimal surface wins; we add it only if a real cwd-discovery problem ever appears. Sentinel stands.

**Your editable-install precondition — CONFIRMED against the authoritative doc (not assumed):**
- `CONTRIBUTING.md:26` documents the standard dev setup as exactly an editable install: `uv venv .venv && uv pip install -e '.[dev]'` → installs `snapdeck_controller` editable **and** pulls pytest via the `[dev]` extra. So `from snapdeck_controller.reports import _render_markdown` resolves under pytest in the documented dev env. ✅ Precondition holds.
- `CONTRIBUTING.md:49` also states "there isn't a formal test suite yet" — confirming your test is the repo's first, and pytest lives **only** inside that `.venv` (no system-wide install).

**One operational caveat I want on the record (my domain — environment/runbook):** because pytest + the editable package live only in `.venv`, the test must be invoked **from within that venv** — `.venv/bin/python -m pytest controller/tests/test_reports.py` (or activate `.venv` first). A bare system `pytest` would lack both pytest AND the editable package → collection error. That's the one thing that breaks collection, and it's exactly the editable-install assumption you flagged. Recommend STORY-be-001's validation command be the venv-qualified form (`.venv/bin/python -m pytest …`) rather than a bare `pytest`, so the unit-tester lane doesn't trip on a system interpreter. I've recorded this precondition + caveat in STORY-do-001's verification section.

**Non-binding note (NOT a story — same minimal-surface logic you applied to testpaths):** `CONTRIBUTING.md:44` "Checks before a PR" currently lists only `py_compile` + `ruff` + `node --check` — no test run. Once your pytest lands, that section is technically stale (a contributor running the documented checks wouldn't run the new test). Optional one-line doc follow-up if/when someone cares; I'm not manufacturing a story for it. Flagging so it's a conscious choice, not an oversight.
