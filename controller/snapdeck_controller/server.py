"""HTTP API + foreground run loop for the Snapdeck controller.

Routes are generated from the configured service names, so the same handler
serves any project's service set.
"""

from __future__ import annotations

import json
import re
import signal
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from . import core
from .reports import save_report, resolve_owner


class ControllerHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return  # quiet — events surface via the event log

    # -- response helpers --
    def _send(self, status: int, ctype: str, body: bytes) -> None:
        try:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, OSError):
            self._client_dead = True

    def _json(self, body: Any, status: int = 200) -> None:
        self._send(status, "application/json; charset=utf-8", json.dumps(body).encode("utf-8"))

    def _text(self, body: str, status: int = 200) -> None:
        self._send(status, "text/plain; charset=utf-8", body.encode("utf-8"))

    def _qs(self) -> dict[str, list[str]]:
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

    def _path(self) -> str:
        return urllib.parse.urlparse(self.path).path

    def _actor(self) -> str:
        return (self._qs().get("actor") or ["unknown"])[0] or "unknown"

    def _svc_group(self) -> str:
        return "(" + "|".join([*core.CONFIG.service_names, "all"]) + ")"

    def _read_body(self) -> bytes:
        try:
            n = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            n = 0
        return self.rfile.read(n) if n else b""

    def do_OPTIONS(self) -> None:  # CORS preflight (extension)
        self._client_dead = False
        self._send(204, "text/plain", b"")

    def do_GET(self) -> None:
        path = self._path()
        self._client_dead = False
        try:
            if path == "/status":
                self._json(core.api_status()); return
            if path == "/exec/catalog":
                self._json(core.catalog_for_api()); return
            if path == "/exec/jobs":
                lim = int((self._qs().get("limit") or ["20"])[0])
                self._json(core.api_exec_jobs(lim)); return
            if path == "/resolve":
                port = self._qs().get("port", [""])[0]
                self._json(resolve_owner(port)); return
            m = re.match(r"^/exec/job/([a-f0-9]+)$", path)
            if m:
                self._json(core.api_exec_job(m.group(1))); return
            m = re.match(r"^/exec/job/([a-f0-9]+)/log$", path)
            if m:
                job = core.EXEC_JOBS.get(m.group(1), {})
                self._handle_log_query(job.get("log_path")); return
            m = re.match(rf"^/logs/{self._svc_group()}$", path)
            if m and m.group(1) != "all":
                self._handle_log_query(str(core.log_path_for(m.group(1)))); return
            self._text("not found", status=404)
        except Exception as e:
            sys.stderr.write(f"GET {path} crashed: {e}\n")
            if not getattr(self, "_client_dead", False):
                self._text(f"server error: {e}", status=500)

    def _handle_log_query(self, log_path: str | None) -> None:
        if not log_path or not Path(log_path).exists():
            self._json({"error": "no log"}, status=404); return
        qs = self._qs()
        if qs.get("path", ["0"])[0] in ("1", "true", "yes"):
            self._json({"path": str(Path(log_path).resolve())}); return
        n_raw = (qs.get("n") or ["200"])[0]
        n = None if n_raw.lower() in ("-1", "full", "all") else _safe_int(n_raw, 200)
        grep_pat = (qs.get("grep") or [""])[0]
        ctx = _safe_int((qs.get("context") or ["0"])[0], 0)
        try:
            text = Path(log_path).read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            self._json({"error": f"read failed: {e}"}, status=500); return
        lines = text.splitlines()
        if grep_pat:
            try:
                rx = re.compile(grep_pat)
            except re.error:
                rx = re.compile(re.escape(grep_pat))
            keep: set[int] = set()
            for i, line in enumerate(lines):
                if rx.search(line):
                    for j in range(max(0, i - ctx), min(len(lines), i + ctx + 1)):
                        keep.add(j)
            lines = [lines[i] for i in sorted(keep)]
        if n is not None and len(lines) > n:
            lines = lines[-n:]
        self._text("\n".join(lines) + ("\n" if lines else ""))

    def do_POST(self) -> None:
        path = self._path()
        self._client_dead = False
        try:
            m = re.match(rf"^/(start|stop|restart)/{self._svc_group()}$", path)
            if m:
                verb, svc = m.group(1), m.group(2)
                fn = {"start": core.api_start, "stop": core.api_stop, "restart": core.api_restart}[verb]
                self._json(fn(svc, self._actor())); return
            m = re.match(r"^/exec/([a-zA-Z0-9_-]+)$", path)
            if m:
                entry = core.find_catalog_entry(m.group(1))
                if not entry:
                    self._json({"error": "unknown exec name"}, status=404); return
                confirm = (self._qs().get("confirm") or ["0"])[0] in ("1", "true", "yes")
                result = core.run_exec_job(entry, self._actor(), confirm)
                self._json(result, status=result.pop("status", 200)); return
            if path == "/report/save":
                result = save_report(self._read_body())
                self._json(result, status=result.pop("status", 200)); return
            if path == "/shutdown":
                self._json({"ok": True, "shutting_down": True})
                threading.Thread(target=core.initiate_shutdown, daemon=True).start(); return
            self._text("not found", status=404)
        except Exception as e:
            sys.stderr.write(f"POST {path} crashed: {e}\n")
            if not getattr(self, "_client_dead", False):
                self._text(f"server error: {e}", status=500)


def _safe_int(s: str, default: int) -> int:
    try:
        return int(s)
    except (TypeError, ValueError):
        return default


# --- Interactive keys ---------------------------------------------------------

HELP = """
  s                 status snapshot
  start <svc|all>   start a service
  stop  <svc|all>   stop a service
  restart <svc|all> restart a service
  logs  <svc>       tail last 40 lines
  h ?               this help
  q                 graceful shutdown (stops all children)
""".rstrip()


def handle_key(line: str) -> None:
    parts = line.strip().split()
    if not parts:
        return
    cmd = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""
    if cmd in ("h", "?", "help"):
        with core.EVENT_PRINT_LOCK:
            print(HELP, flush=True)
        return
    if cmd == "s":
        with core.EVENT_PRINT_LOCK:
            print(json.dumps(core.api_status(), indent=2), flush=True)
        return
    if cmd == "q":
        core.initiate_shutdown(); return
    valid = set(core.CONFIG.service_names) | {"all"}
    if cmd in ("start", "stop", "restart"):
        if arg not in valid:
            with core.EVENT_PRINT_LOCK:
                print(f"usage: {cmd} <{'|'.join(sorted(valid))}>", flush=True)
            return
        fn = {"start": core.api_start, "stop": core.api_stop, "restart": core.api_restart}[cmd]
        threading.Thread(target=fn, args=(arg, "local"), daemon=True).start()
        return
    if cmd == "logs" and arg in core.CONFIG.service_names:
        try:
            text = core.log_path_for(arg).read_text(encoding="utf-8", errors="replace")
            tail = "\n".join(text.splitlines()[-40:])
            with core.EVENT_PRINT_LOCK:
                print(f"--- {arg} log (last 40) ---\n{tail}\n--- end ---", flush=True)
        except OSError as e:
            with core.EVENT_PRINT_LOCK:
                print(f"can't read {arg} log: {e}", flush=True)
        return
    with core.EVENT_PRINT_LOCK:
        print(f"unknown command: {line.strip()!r}  (type 'h' for help)", flush=True)


# --- Run (foreground supervisor) ---------------------------------------------

def run(no_autostart: bool = False, kill_orphan: bool = False, controller_port: int | None = None) -> int:
    # Pre-flight: refuse if a controller is already up for this worktree.
    if core.PORTS_FILE.exists():
        try:
            prior_ports = json.loads(core.PORTS_FILE.read_text(encoding="utf-8"))
            prior_pid = None
            if core.CONTROLLER_PID_FILE.exists():
                try:
                    prior_pid = int(core.CONTROLLER_PID_FILE.read_text(encoding="utf-8").strip())
                except (OSError, ValueError):
                    prior_pid = None
            if prior_pid and core.pid_alive(prior_pid):
                print(f"controller already up in this worktree (pid {prior_pid}, "
                      f"port :{prior_ports.get('controller')})", file=sys.stderr)
                print(f"  events: {core.EVENTS_LOG}", file=sys.stderr)
                return 1
        except (OSError, json.JSONDecodeError):
            pass

    core.RESOLVED.clear()
    core.RESOLVED.update(core.discover_ports(kill_orphan=kill_orphan, base=controller_port))
    core.CONTROLLER_STARTED_AT = core.now_iso()
    core.CONTROLLER_BOOT_MONOTONIC = time.monotonic()
    core.write_ports_json()
    core.CONTROLLER_PID_FILE.write_text(str(__import__("os").getpid()) + "\n")
    core.write_registry_entry()
    core.sweep_old_exec_logs()

    print(f"\nsnapdeck controller — project '{core.CONFIG.project_name}'  worktree: {core.WORKTREE.name}")
    print(f"  ▸ controller HTTP   http://127.0.0.1:{core.RESOLVED['controller']}")
    for svc in core.CONFIG.service_names:
        pm = core.RESOLVED.get(svc) or {}
        ports = "  ".join(f"{k}=:{v}" for k, v in pm.items())
        print(f"  ▸ {svc:<16} {ports}")
    print(f"  pid {__import__('os').getpid()}  · state {core.STATE_DIR}")
    print("  type 'h' for help, 'q' to quit.\n", flush=True)

    core.emit_event(core.format_event("controller", "->", f"bound on 127.0.0.1:{core.RESOLVED['controller']}",
                                      f"worktree={core.WORKTREE.name}"))
    core.try_adopt()

    def _sig(signum, _frame):
        sys.stderr.write(f"\nreceived signal {signum}\n")
        core.initiate_shutdown()
    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    server = ThreadingHTTPServer(("127.0.0.1", core.RESOLVED["controller"]), ControllerHandler)
    threading.Thread(target=server.serve_forever, name="http-server", daemon=True).start()
    threading.Thread(target=core.crash_watcher, name="crash-watcher", daemon=True).start()

    if not no_autostart:
        threading.Thread(target=core.start_all, args=("local", True), daemon=True).start()

    import select
    try:
        stdin_interactive = sys.stdin.isatty()
    except (AttributeError, ValueError):
        stdin_interactive = False
    if not stdin_interactive:
        with core.EVENT_PRINT_LOCK:
            print("(stdin not a TTY — interactive keys disabled; use the HTTP API / `deck` / signals)", flush=True)

    try:
        while not core.SHUTDOWN_FLAG.is_set():
            try:
                while True:
                    line = core.EVENT_QUEUE.get_nowait()
                    with core.EVENT_PRINT_LOCK:
                        print(line, flush=True)
                    try:
                        with core.EVENTS_LOG.open("a", encoding="utf-8") as f:
                            f.write(line + "\n")
                    except OSError:
                        pass
            except __import__("queue").Empty:
                pass
            if not stdin_interactive:
                time.sleep(0.2)
                continue
            try:
                r, _, _ = select.select([sys.stdin], [], [], 0.1)
            except (OSError, ValueError):
                stdin_interactive = False
                continue
            if r:
                line = sys.stdin.readline()
                if not line:
                    stdin_interactive = False
                    with core.EVENT_PRINT_LOCK:
                        print("(stdin closed — interactive keys disabled; controller stays up)", flush=True)
                    continue
                handle_key(line)
    except KeyboardInterrupt:
        core.initiate_shutdown()

    try:
        server.shutdown()
    except Exception:
        pass
    try:
        core.CONTROLLER_PID_FILE.unlink()
    except FileNotFoundError:
        pass
    return 0
