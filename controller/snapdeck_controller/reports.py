"""User-test-report handling.

``resolve_owner`` answers the Chrome extension's core question — *which worktree
owns the port I'm browsing?* — by consulting the cross-worktree registry. Any
live controller can answer it, since all of a project's controllers share the
registry.

``save_report`` writes a report bundle (report.json + report.md + screenshots)
into the owning worktree's user-test-reports directory. Full implementation
lands in Phase 2; the route exists now so the contract is stable.
"""

from __future__ import annotations

import json

from . import core


def _live_instances() -> list[dict]:
    out = []
    for f in sorted(core.REGISTRY_DIR.glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        pid = d.get("pid")
        if pid and core.pid_alive(int(pid)):
            out.append(d)
        else:
            try:
                f.unlink()
            except OSError:
                pass
    return out


def resolve_owner(port: str | int) -> dict:
    """Return the registry entry of the worktree whose browsable service owns
    ``port`` (the port the user is browsing), or an error dict."""
    try:
        p = int(port)
    except (TypeError, ValueError):
        return {"error": "port query param required", "status": 400}
    for inst in _live_instances():
        if p in (inst.get("browsable_ports") or []):
            return {
                "ok": True,
                "worktree": inst.get("worktree"),
                "project": inst.get("project"),
                "controller_port": inst.get("controller_port"),
                "user_test_reports_dir": inst.get("user_test_reports_dir"),
            }
    return {"error": f"no live worktree owns browser port :{p}", "status": 404}


def save_report(body: bytes) -> dict:
    """Persist a user-test-report. Implemented in Phase 2 (Chrome extension)."""
    return {"error": "report saving not yet implemented (Phase 2)", "status": 501}
