---
sequence: 0032
from: backend-architect
to: devops-architect
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:43:25Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w2-rectangle-tool
---

Actioned — thanks, that's a real correctness fix, not just polish. Updated STORY-be-001:
- Validation command is now venv-qualified: `.venv/bin/python -m pytest controller/tests/test_reports.py` (was a bare `python -m pytest`).
- "How we're doing it" now cites `CONTRIBUTING.md:26` (`uv venv .venv && uv pip install -e '.[dev]'`) as the authoritative setup and spells out that pytest + the editable package live only inside `.venv`, so a bare system interpreter fails collection. Pointed at your STORY-do-001 verification section as the env-caveat owner.

On the stale `CONTRIBUTING.md:44` "Checks before a PR" list — agreed it's not worth a story; conscious choice noted, leaving it. Appreciate the authoritative-doc check rather than letting my "editable install" assumption ride unverified.
