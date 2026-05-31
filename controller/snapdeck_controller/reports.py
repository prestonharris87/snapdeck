"""User-test-report handling.

``resolve_owner`` answers the Chrome extension's core question — *which worktree
owns the port I'm browsing?* — by consulting the cross-worktree registry. Any
live controller can answer it, since all of a project's controllers share the
registry.

``save_report`` writes a report bundle (report.json + report.md + screenshots)
into the owning worktree's user-test-reports directory. A report is a raw,
multi-page evidence bundle — NOT a single defect. A separate future skill turns
one report into N defects.
"""

from __future__ import annotations

import base64
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

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


def _slugify(text: str, fallback: str = "report") -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return (s[:40] or fallback)


def _git(worktree: Path, *args: str) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(worktree), *args],
                           capture_output=True, timeout=5, text=True)
        return r.stdout.strip() if r.returncode == 0 else None
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def _decode_png(b64: str | None) -> bytes | None:
    if not b64:
        return None
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[-1]
    try:
        return base64.b64decode(b64)
    except (ValueError, TypeError):
        return None


def save_report(body: bytes) -> dict:
    """Persist a user-test-report posted by the Chrome extension.

    Payload: { browser_port, note?, screenshots: [ { url, title, captured_at,
    viewport, original_png_b64, annotated_png_b64?, annotations?, console?,
    network_failures? } ] }
    """
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return {"error": f"invalid JSON body: {e}", "status": 400}

    owner = resolve_owner(payload.get("browser_port"))
    if not owner.get("ok"):
        return owner  # carries its own status
    worktree = Path(owner["worktree"])
    reports_dir = Path(owner["user_test_reports_dir"])

    now = datetime.now(timezone.utc)
    note = payload.get("note") or ""
    report_id = f"{now.strftime('%Y%m%d-%H%M%S')}-{_slugify(note)}"
    out_dir = reports_dir / report_id
    shots_dir = out_dir / "screenshots"
    try:
        shots_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        return {"error": f"could not create report dir: {e}", "status": 500}

    branch = _git(worktree, "rev-parse", "--abbrev-ref", "HEAD")
    sha = _git(worktree, "rev-parse", "HEAD")

    screenshots_meta = []
    for i, shot in enumerate(payload.get("screenshots") or [], start=1):
        rec = {
            "index": i,
            "url": shot.get("url"),
            "title": shot.get("title"),
            "captured_at": shot.get("captured_at"),
            "viewport": shot.get("viewport"),
            "annotations": shot.get("annotations") or [],
            "console": shot.get("console") or [],
            "network_failures": shot.get("network_failures") or [],
        }
        orig = _decode_png(shot.get("original_png_b64"))
        if orig is not None:
            fn = f"{i:02d}-original.png"
            (shots_dir / fn).write_bytes(orig)
            rec["original"] = f"screenshots/{fn}"
        ann = _decode_png(shot.get("annotated_png_b64"))
        if ann is not None:
            fn = f"{i:02d}-annotated.png"
            (shots_dir / fn).write_bytes(ann)
            rec["annotated"] = f"screenshots/{fn}"
        screenshots_meta.append(rec)

    report = {
        "report_id": report_id,
        "created_at": now.isoformat(timespec="seconds"),
        "worktree": str(worktree),
        "project": owner.get("project"),
        "git": {"branch": branch, "sha": sha},
        "note": note or None,
        "screenshots": screenshots_meta,
    }
    (out_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (out_dir / "report.md").write_text(_render_markdown(report))

    core.emit_event(core.format_event("report", "->", "saved", f"{report_id}  ({len(screenshots_meta)} screenshot(s))"))
    return {
        "ok": True,
        "report_id": report_id,
        "path": str(out_dir),
        "screenshots": len(screenshots_meta),
    }


def _render_markdown(report: dict) -> str:
    lines = [
        "---",
        "type: user-test-report",
        "captured_by: snapdeck-chrome-extension",
        f"report_id: {report['report_id']}",
        f"created_at: {report['created_at']}",
        f"project: {report.get('project')}",
        f"git_branch: {report['git'].get('branch')}",
        f"git_sha: {report['git'].get('sha')}",
        "---",
        "",
        f"# User-test-report: {report['report_id']}",
        "",
    ]
    if report.get("note"):
        lines += [f"> {report['note']}", ""]
    lines.append(f"Captured {len(report['screenshots'])} screenshot(s) against "
                 f"`{report['git'].get('branch')}` @ `{(report['git'].get('sha') or '')[:10]}`.")
    lines.append("")
    for s in report["screenshots"]:
        lines.append(f"## Screenshot {s['index']} — {s.get('title') or s.get('url') or ''}")
        lines.append("")
        lines.append(f"- **URL:** {s.get('url')}")
        vp = s.get("viewport") or {}
        if vp:
            lines.append(f"- **Viewport:** {vp.get('w')}×{vp.get('h')} @ {vp.get('dpr')}x")
        if s.get("original"):
            lines.append(f"- **Original:** `{s['original']}`")
        if s.get("annotated"):
            lines.append(f"- **Annotated:** `{s['annotated']}`")
        lines.append("")
        anns = s.get("annotations") or []
        if anns:
            lines.append("**Annotations:**")
            lines.append("")
            for a in anns:
                if a.get("type") == "text":
                    lines.append(f"- 📝 ({a.get('x')},{a.get('y')}) “{a.get('text', '')}”")
                elif a.get("type") == "arrow":
                    frm, to = a.get("from"), a.get("to")
                    label = f" — “{a['text']}”" if a.get("text") else ""
                    lines.append(f"- ➡️ {frm} → {to}{label}")
                else:
                    lines.append(f"- {a}")
            lines.append("")
        console = s.get("console") or []
        if console:
            lines.append("**Console:**")
            lines.append("")
            lines.append("```")
            for c in console[:50]:
                lines.append(f"[{c.get('level')}] {c.get('message')}")
            lines.append("```")
            lines.append("")
        netf = s.get("network_failures") or []
        if netf:
            lines.append("**Failed network requests:**")
            lines.append("")
            for n in netf[:50]:
                lines.append(f"- `{n.get('status')}` {n.get('method')} {n.get('url')}")
            lines.append("")
    return "\n".join(lines) + "\n"
