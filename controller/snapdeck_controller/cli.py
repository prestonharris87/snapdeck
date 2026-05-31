"""`deck` — the Snapdeck command-line interface.

A faithful port of the original dev-controller.sh wrapper: it resolves the
per-worktree state, talks to the running controller over its localhost HTTP API,
and (for `up`) runs the foreground supervisor. Uses urllib (no curl dependency)
for cross-platform reach.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from . import SnapdeckError, __version__, core
from . import config as _config
from . import paths as _paths


# --- HTTP helpers -------------------------------------------------------------

def _get(port: int, path: str, timeout: float = 30) -> str:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=timeout) as r:
        return r.read().decode("utf-8")


def _post(port: int, path: str, timeout: float = 600) -> str:
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def _read_controller_port() -> int | None:
    if not core.PORTS_FILE.exists():
        return None
    try:
        return int(json.loads(core.PORTS_FILE.read_text())["controller"])
    except (OSError, json.JSONDecodeError, KeyError, ValueError):
        return None


def _controller_alive() -> bool:
    if not core.CONTROLLER_PID_FILE.exists():
        return False
    try:
        pid = int(core.CONTROLLER_PID_FILE.read_text().strip())
    except (OSError, ValueError):
        return False
    return core.pid_alive(pid)


def _require_port() -> int:
    if not core.PORTS_FILE.exists():
        print("no controller has ever run in this worktree — run `deck up`", file=sys.stderr)
        raise SystemExit(2)
    if not _controller_alive():
        print("controller is down — run `deck up`", file=sys.stderr)
        raise SystemExit(3)
    port = _read_controller_port()
    if port is None:
        print("ports.json missing/unreadable", file=sys.stderr)
        raise SystemExit(2)
    return port


def _actor() -> str:
    return os.environ.get("DEV_CONTROLLER_ACTOR") or os.environ.get("SNAPDECK_ACTOR") or "shell"


# --- Commands -----------------------------------------------------------------

def cmd_up(args) -> int:
    if _controller_alive():
        port = _read_controller_port() or "?"
        print(f"controller already up in this worktree (port :{port}) — see {core.EVENTS_LOG}", file=sys.stderr)
        return 1
    if not args.daemon:
        from . import server
        return server.run(no_autostart=args.no_autostart, kill_orphan=args.kill_orphan)

    # Daemon mode: re-exec ourselves foregrounded, detached.
    log_path = Path(args.log_path) if args.log_path else (core.STATE_DIR / "controller.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("")
    cmd = [sys.executable, "-m", "snapdeck_controller", "--worktree", str(core.WORKTREE), "up"]
    if args.kill_orphan:
        cmd.append("--kill-orphan")
    if args.no_autostart:
        cmd.append("--no-autostart")
    with open(log_path, "ab") as out, open(os.devnull, "rb") as devnull:
        subprocess.Popen(cmd, stdin=devnull, stdout=out, stderr=out, start_new_session=True)
    waited = 0
    while not core.PORTS_FILE.exists() and waited < 30:
        time.sleep(0.5); waited += 1
    if not core.PORTS_FILE.exists():
        print(f"daemon failed to write ports.json within 15s — see {log_path}", file=sys.stderr)
        return 1
    port = _read_controller_port() or "?"
    print(f"snapdeck: daemon started (port :{port})")
    print(f"  log:    {log_path}")
    print(f"  events: {core.EVENTS_LOG}")
    return 0


def cmd_down(args) -> int:
    if not _controller_alive():
        for f in (core.CONTROLLER_PID_FILE, core.PORTS_FILE):
            try:
                f.unlink()
            except (FileNotFoundError, OSError):
                pass
        print("no controller running in this worktree", file=sys.stderr)
        return 0
    port = _require_port()
    try:
        _post(port, "/shutdown", timeout=10)
    except urllib.error.URLError:
        pass
    for _ in range(10):
        if not _controller_alive():
            break
        time.sleep(0.5)
    if _controller_alive():
        try:
            pid = int(core.CONTROLLER_PID_FILE.read_text().strip())
            os.kill(pid, 15)
        except (OSError, ValueError):
            pass
    print("controller stopped")
    return 0


def cmd_status(args) -> int:
    if not core.PORTS_FILE.exists():
        print("no controller has ever run in this worktree", file=sys.stderr)
        return 2
    if not _controller_alive():
        print("controller is down", file=sys.stderr)
        return 3
    port = _read_controller_port()
    try:
        d = json.loads(_get(port, "/status"))
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f"status query failed: {e}", file=sys.stderr)
        return 1
    c = d.get("controller", {})
    ports = c.get("ports", {})
    print(f"controller pid={c.get('pid')}  port={ports.get('controller')}  "
          f"project={c.get('project')}  worktree={c.get('worktree')}")
    for svc in core.CONFIG.service_names:
        s = d.get(svc, {})
        badge = "READY" if s.get("ready") else (s.get("state") or "?").upper()
        port_field = str(s.get("port") or "-")
        if s.get("port_drift"):
            port_field = f"{s.get('port')}/actual:{s.get('actual_port')} [DRIFT]"
        print(f"  {svc:<16} {badge:<9}  pid={s.get('pid')}  port={port_field:<20} last={s.get('last_event')}")
    return 0


def cmd_verb(args, verb: str) -> int:
    svc = args.service
    valid = set(core.CONFIG.service_names) | {"all"}
    if svc not in valid:
        print(f"usage: {verb} <{'|'.join(sorted(valid))}>", file=sys.stderr)
        return 64
    port = _require_port()
    print(_post(port, f"/{verb}/{svc}?actor={urllib.parse.quote(_actor())}"))
    return 0


def cmd_logs(args) -> int:
    if args.service not in core.CONFIG.service_names:
        print(f"usage: logs <{'|'.join(core.CONFIG.service_names)}> [flags]", file=sys.stderr)
        return 64
    port = _require_port()
    print(_log_query(port, f"logs/{args.service}", args), end="")
    return 0


def _log_query(port: int, endpoint: str, args) -> str:
    qs = {}
    if args.full:
        qs["n"] = "-1"
    elif args.n is not None:
        qs["n"] = str(args.n)
    if args.grep:
        qs["grep"] = args.grep
    if args.context:
        qs["context"] = str(args.context)
    if args.path:
        qs["path"] = "1"
    query = ("?" + urllib.parse.urlencode(qs)) if qs else ""
    return _get(port, f"/{endpoint}{query}")


def cmd_exec(args) -> int:
    port = _require_port()
    confirm = 1 if args.confirm else 0
    print(_post(port, f"/exec/{args.name}?actor={urllib.parse.quote(_actor())}&confirm={confirm}"))
    return 0


def cmd_exec_wait(args) -> int:
    port = _require_port()
    elapsed = 0
    while elapsed < args.timeout:
        try:
            job = json.loads(_get(port, f"/exec/job/{args.job_id}"))
        except (urllib.error.URLError, json.JSONDecodeError) as e:
            print(f"exec-wait: {e}", file=sys.stderr)
            return 1
        state = job.get("state", "?")
        if state == "done":
            return 0
        if state == "failed":
            return int(job.get("exit_code") or 1)
        if state == "running":
            time.sleep(2); elapsed += 2
            continue
        print(f"exec-wait: {job}", file=sys.stderr)
        return 1
    print(f"exec-wait: timeout after {args.timeout}s", file=sys.stderr)
    return 124


def cmd_exec_log(args) -> int:
    port = _require_port()
    print(_log_query(port, f"exec/job/{args.job_id}/log", args), end="")
    return 0


def cmd_exec_jobs(args) -> int:
    port = _require_port()
    print(_get(port, f"/exec/jobs?limit={args.limit}"))
    return 0


def cmd_catalog(args) -> int:
    port = _require_port()
    for e in json.loads(_get(port, "/exec/catalog")):
        rs = ",".join(e.get("requires_stopped") or []) or "-"
        print(f"  {e.get('name'):<28}  tier={e.get('tier'):<10}  stop={rs}")
        if e.get("description"):
            print(f"    {e['description']}")
    return 0


def cmd_ls(args) -> int:
    reg = core.REGISTRY_DIR
    reg.mkdir(parents=True, exist_ok=True)
    rows = []
    for f in sorted(reg.glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        pid = d.get("pid")
        if not (pid and core.pid_alive(int(pid))):
            try:
                f.unlink()
            except OSError:
                pass
            continue
        rows.append(d)
    if not rows:
        print("no live controllers")
        return 0
    print(f"{'SLUG':22} {'CONTROLLER':11} {'BROWSABLE':22}  WORKTREE")
    for d in rows:
        bports = ",".join(str(p) for p in (d.get("browsable_ports") or [])) or "-"
        brow = f"{d.get('browsable') or '-'}:{bports}"
        print(f"{Path(d.get('worktree','?')).name:22} {str(d.get('controller_port')):<11} {brow:22}  {d.get('worktree')}")
    return 0


def cmd_config_init(args) -> int:
    dest = Path.cwd() / _paths.CONFIG_FILENAME
    if dest.exists():
        print(f"{dest} already exists — not overwriting", file=sys.stderr)
        return 1
    example = Path(__file__).parent.parent.parent / "examples" / "snapdeck.toml"
    template = example.read_text() if example.exists() else _MINIMAL_TEMPLATE
    dest.write_text(template)
    print(f"wrote {dest}\nEdit it to describe your project's services, then run `deck up`.")
    return 0


_MINIMAL_TEMPLATE = """\
[project]
name = "myapp"

[ports]
controller = 7777
step = 10
max_tries = 30

[services.app]
cwd = "."
start = "npm run dev -- --port {port.http}"
browsable = true
[services.app.ports]
http = 3000
[services.app.ready]
kind = "http"
http_url = "http://localhost:{port.http}"
primary_port = "http"

[user_test_reports]
output_dir = "thoughts/shared/user-test-reports"
"""


# --- Argument parsing ---------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="deck", description="Snapdeck dev-server controller.")
    p.add_argument("--worktree", help="project worktree root (default: discovered from cwd)")
    p.add_argument("--version", action="version", version=f"snapdeck {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    up = sub.add_parser("up", help="start the controller (foreground unless --daemon)")
    up.add_argument("--daemon", action="store_true")
    up.add_argument("--log-path")
    up.add_argument("--kill-orphan", action="store_true")
    up.add_argument("--no-autostart", action="store_true")
    up.set_defaults(fn=cmd_up)

    sub.add_parser("down", help="graceful shutdown").set_defaults(fn=cmd_down)
    sub.add_parser("status", help="status snapshot").set_defaults(fn=cmd_status)

    for verb in ("start", "stop", "restart"):
        sp = sub.add_parser(verb, help=f"{verb} a service")
        sp.add_argument("service")
        sp.set_defaults(fn=lambda a, v=verb: cmd_verb(a, v))

    lg = sub.add_parser("logs", help="tail a service log")
    lg.add_argument("service")
    _add_log_flags(lg)
    lg.set_defaults(fn=cmd_logs)

    ex = sub.add_parser("exec", help="run a catalog command")
    ex.add_argument("name")
    ex.add_argument("--confirm", action="store_true")
    ex.set_defaults(fn=cmd_exec)

    ew = sub.add_parser("exec-wait", help="poll an exec job until done")
    ew.add_argument("job_id")
    ew.add_argument("--timeout", type=int, default=300)
    ew.set_defaults(fn=cmd_exec_wait)

    el = sub.add_parser("exec-log", help="tail an exec job log")
    el.add_argument("job_id")
    _add_log_flags(el)
    el.set_defaults(fn=cmd_exec_log)

    ej = sub.add_parser("exec-jobs", help="recent exec jobs")
    ej.add_argument("--limit", type=int, default=20)
    ej.set_defaults(fn=cmd_exec_jobs)

    sub.add_parser("catalog", help="list exec commands").set_defaults(fn=cmd_catalog)
    sub.add_parser("ls", help="list live controllers for this project").set_defaults(fn=cmd_ls)

    ci = sub.add_parser("config", help="config helpers")
    cisub = ci.add_subparsers(dest="config_command", required=True)
    cisub.add_parser("init", help="scaffold a snapdeck.toml").set_defaults(fn=cmd_config_init)
    return p


def _add_log_flags(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("-n", type=int, default=None)
    sp.add_argument("--full", action="store_true")
    sp.add_argument("--grep")
    sp.add_argument("--context", type=int)
    sp.add_argument("--path", action="store_true")


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        # `config init` runs before any worktree exists.
        if getattr(args, "config_command", None) == "init":
            return args.fn(args)
        worktree = _paths.resolve_worktree(args.worktree)
        cfg = _config.load(worktree)
        core.init(worktree, cfg)
        return args.fn(args)
    except SnapdeckError as e:
        print(f"deck: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
