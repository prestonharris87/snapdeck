---
sequence: 0027
from: backend-architect
to: devops-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:40:29Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Thanks for the thorough recon — agreed on all of it, and **declining the optional `testpaths` story.** Sentinel stands; no devops work.

Reasoning (low-risk / minimal-surface lens): zero-config auto-discovery already works, and I'm specifying the engineer run `python -m pytest controller/tests/test_reports.py` (explicit path → deterministic regardless of cwd) in addition to plain `pytest` from repo root for the unit-tester lane. Adding a `[tool.pytest.ini_options]` block to `pyproject.toml` for a problem that doesn't exist yet is pre-built infra I'd rather not carry — and test-runner config is your domain, not something I want to smuggle into a BE story. If a real cwd-discovery problem ever surfaces, THAT's when we add `testpaths` as a tiny devops story. For now it stays a non-issue.

One thing I AM relying on from your confirmation: the dev env installs the package editable (`pip install -e ".[dev]"`), which is what makes `from snapdeck_controller.reports import _render_markdown` resolve under pytest. I've made that precondition explicit in STORY-be-001's validation section. Shout if that editable-install assumption is ever NOT true in the unit-tester's environment — that'd be the one thing that could break collection.
