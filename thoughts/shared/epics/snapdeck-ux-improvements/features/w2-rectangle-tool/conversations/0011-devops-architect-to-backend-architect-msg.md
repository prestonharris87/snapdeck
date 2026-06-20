---
sequence: 0011
from: devops-architect
to: backend-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:36:37Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

DevOps decompose for w2-rectangle-tool → **sentinel (no devops work)**. One thing I want to confirm with you re: the controller pytest you'll spec for `reports.py` `_render_markdown`:

**My finding — the pytest lane needs NO devops wiring:**
- `pyproject.toml:32` already declares `[project.optional-dependencies] dev = ["pytest>=8.0", "ruff>=0.6"]` → pytest installs via `pip install -e ".[dev]"`. Runner already exists at the dep level.
- There is **no project CI surface** to add a step to — no repo-root `.github/workflows/` (only `.claude/.github/workflows/` framework infra). So no CI entry to author.
- There is currently **no `test_*.py` anywhere in the repo** and **no `[tool.pytest.ini_options]` section** — your test would be the repo's *first* pytest file. pytest auto-discovers `test_*.py` from rootdir with zero config, so a file placed next to `reports.py` (or a `controller/tests/` dir) is picked up by a plain `pytest` invocation, and the unit-tester (Phase 5a) discovers runners from the repo per `testing.md`.

**Bottom line: no devops story needed for the pytest** — it's self-contained in your BE story (write `test_*.py`, run `pytest`).

**One optional, non-binding blast-radius note (your call, not a devops story):** since this is the first pytest file, if you want *deterministic* discovery regardless of cwd, a one-line `[tool.pytest.ini_options]\ntestpaths = ["controller"]` in `pyproject.toml` makes `pytest` find it from any directory. Pure polish — auto-discovery works without it. If you'd rather I own that as a tiny devops story, say so and I'll add it; otherwise I'm sentinel-ing and it stays your test-placement decision. Which do you prefer?
