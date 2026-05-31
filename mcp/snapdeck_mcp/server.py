"""A minimal, spec-faithful MCP stdio server (newline-delimited JSON-RPC 2.0).

Hand-rolled to keep Snapdeck's dependency footprint small (no MCP SDK). It speaks
the three methods Claude Code needs — ``initialize``, ``tools/list``,
``tools/call`` — plus the ``notifications/initialized`` no-op.

Worktree resolution, config loading, and controller bootstrap all reuse the
``snapdeck_controller`` package. The server resolves *its own* worktree from the
launch cwd (the directory Claude was started in), using the same
``.absolute()``-not-``.resolve()`` rule the controller uses.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from snapdeck_controller import SnapdeckError, __version__
from snapdeck_controller import config as _config
from snapdeck_controller import core
from snapdeck_controller import paths as _paths

PROTOCOL_FALLBACK = "2025-06-18"

READ_ONLY_TOOLS = {"status", "logs", "exec_catalog", "exec_job", "exec_jobs", "list_worktrees"}
FULL_EXTRA_TOOLS = {"start_service", "stop_service", "restart_service", "exec_run"}


class Server:
    def __init__(self, profile: str):
        self.profile = profile
        self.worktree: Path | None = None
        self.config = None
        self.init_error: str | None = None
        try:
            self.worktree = _paths.resolve_worktree()
            self.config = _config.load(self.worktree)
            core.init(self.worktree, self.config)
        except SnapdeckError as e:
            self.init_error = str(e)

    # -- controller plumbing --
    def _controller_port(self) -> int | None:
        if not core.PORTS_FILE.exists():
            return None
        try:
            return int(json.loads(core.PORTS_FILE.read_text())["controller"])
        except (OSError, json.JSONDecodeError, KeyError, ValueError):
            return None

    def _controller_alive(self) -> bool:
        if not core.CONTROLLER_PID_FILE.exists():
            return False
        try:
            return core.pid_alive(int(core.CONTROLLER_PID_FILE.read_text().strip()))
        except (OSError, ValueError):
            return False

    def _ensure_controller(self) -> int | None:
        """Lazy bootstrap for control tools: start a controller (without
        autostarting services) if none is running, then return its port."""
        if self._controller_alive():
            return self._controller_port()
        cmd = [sys.executable, "-m", "snapdeck_controller", "--worktree", str(self.worktree),
               "up", "--daemon", "--no-autostart"]
        try:
            with open(os.devnull, "rb") as devnull, open(os.devnull, "ab") as out:
                subprocess.Popen(cmd, stdin=devnull, stdout=out, stderr=out, start_new_session=True)
        except OSError as e:
            raise SnapdeckError(f"could not start controller: {e}")
        waited = 0.0
        while waited < 20 and not self._controller_alive():
            time.sleep(0.3); waited += 0.3
        return self._controller_port()

    def _http(self, method: str, path: str, timeout: float = 600) -> str:
        port = self._controller_port()
        if port is None:
            raise SnapdeckError("controller not running")
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8")

    # -- tool schemas --
    def tool_defs(self) -> list[dict]:
        svc_enum = self.config.service_names if self.config else None
        svc_all = (svc_enum + ["all"]) if svc_enum else None
        svc_prop = {"type": "string", "description": "service name"}
        if svc_enum:
            svc_prop["enum"] = svc_enum
        svc_all_prop = {"type": "string", "description": "service name or 'all'"}
        if svc_all:
            svc_all_prop["enum"] = svc_all

        defs = {
            "status": _tool("status", "Lifecycle snapshot of every service (state, ready, ports).", {}),
            "logs": _tool("logs", "Tail a service log. Optional grep/context/line-count filters.", {
                "service": svc_prop,
                "n": {"type": "integer", "description": "last N lines (default 200)"},
                "grep": {"type": "string", "description": "filter to matching lines"},
                "context": {"type": "integer", "description": "lines of context around matches"},
            }, required=["service"]),
            "exec_catalog": _tool("exec_catalog", "List whitelisted maintenance (exec) commands.", {}),
            "exec_job": _tool("exec_job", "Status of one exec job.", {
                "job_id": {"type": "string"}}, required=["job_id"]),
            "exec_jobs": _tool("exec_jobs", "Recent exec jobs.", {
                "limit": {"type": "integer", "description": "default 20"}}),
            "list_worktrees": _tool("list_worktrees", "Live controllers for this project across worktrees.", {}),
            "start_service": _tool("start_service", "Start a service (or 'all'). Boots the controller if needed.", {
                "service": svc_all_prop}, required=["service"]),
            "stop_service": _tool("stop_service", "Stop a service (or 'all').", {
                "service": svc_all_prop}, required=["service"]),
            "restart_service": _tool("restart_service", "Restart a service (or 'all').", {
                "service": svc_all_prop}, required=["service"]),
            "exec_run": _tool("exec_run", "Run a whitelisted exec command by name.", {
                "name": {"type": "string"},
                "confirm": {"type": "boolean", "description": "required for destructive commands"}},
                required=["name"]),
        }
        return [defs[n] for n in defs if n in self._allowed()]

    def _allowed(self) -> set:
        return READ_ONLY_TOOLS | (FULL_EXTRA_TOOLS if self.profile == "full" else set())

    # -- tool dispatch --
    def call_tool(self, name: str, args: dict) -> str:
        if name not in self._allowed():
            return f"snapdeck: tool '{name}' is not available in the '{self.profile}' profile"
        if self.init_error:
            return f"Snapdeck is not configured for this directory: {self.init_error}"
        actor = os.environ.get("SNAPDECK_ACTOR") or os.environ.get("DEV_CONTROLLER_ACTOR") or "agent"
        try:
            if name == "status":
                if not self._controller_alive():
                    return "Controller not running in this worktree. Start it with `deck up`, or call start_service."
                return self._http("GET", "/status", timeout=30)
            if name == "logs":
                if not self._controller_alive():
                    return "Controller not running — no logs yet. Start a service first."
                qs = _qs({"n": args.get("n"), "grep": args.get("grep"), "context": args.get("context")})
                return self._http("GET", f"/logs/{args['service']}{qs}", timeout=30)
            if name == "exec_catalog":
                if not self._controller_alive():
                    return json.dumps(core.catalog_for_api())  # static; no controller needed
                return self._http("GET", "/exec/catalog", timeout=30)
            if name == "exec_job":
                return self._http("GET", f"/exec/job/{args['job_id']}", timeout=30)
            if name == "exec_jobs":
                return self._http("GET", f"/exec/jobs?limit={int(args.get('limit', 20))}", timeout=30)
            if name == "list_worktrees":
                return json.dumps(_list_worktrees(), indent=2)
            # -- full-profile control tools --
            if name in ("start_service", "restart_service"):
                self._ensure_controller()
                verb = "start" if name == "start_service" else "restart"
                return self._http("POST", f"/{verb}/{args['service']}?actor={actor}")
            if name == "stop_service":
                if not self._controller_alive():
                    return "Controller not running — nothing to stop."
                return self._http("POST", f"/stop/{args['service']}?actor={actor}")
            if name == "exec_run":
                self._ensure_controller()
                confirm = 1 if args.get("confirm") else 0
                return self._http("POST", f"/exec/{args['name']}?actor={actor}&confirm={confirm}")
            return f"unknown tool: {name}"
        except SnapdeckError as e:
            return f"snapdeck: {e}"
        except urllib.error.URLError as e:
            return f"controller request failed: {e}"


def _tool(name: str, desc: str, props: dict, required: list | None = None) -> dict:
    schema = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return {"name": name, "description": desc, "inputSchema": schema}


def _qs(params: dict) -> str:
    parts = [f"{k}={urllib.request.quote(str(v))}" for k, v in params.items() if v is not None]
    return ("?" + "&".join(parts)) if parts else ""


def _list_worktrees() -> list[dict]:
    reg = core.REGISTRY_DIR
    out = []
    if not reg.exists():
        return out
    for f in sorted(reg.glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if d.get("pid") and core.pid_alive(int(d["pid"])):
            out.append({k: d.get(k) for k in
                        ("worktree", "controller_port", "browsable", "browsable_ports")})
    return out


# --- JSON-RPC stdio loop ------------------------------------------------------

def _write(msg: dict) -> None:
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def _result(req_id, result) -> None:
    _write({"jsonrpc": "2.0", "id": req_id, "result": result})


def _error(req_id, code: int, message: str) -> None:
    _write({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def serve(server: Server) -> int:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue
        method = msg.get("method")
        req_id = msg.get("id")
        if method == "initialize":
            params = msg.get("params") or {}
            proto = params.get("protocolVersion") or PROTOCOL_FALLBACK
            _result(req_id, {
                "protocolVersion": proto,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": f"snapdeck-{server.profile}", "version": __version__},
            })
        elif method == "notifications/initialized":
            continue  # no response to notifications
        elif method == "tools/list":
            _result(req_id, {"tools": server.tool_defs()})
        elif method == "tools/call":
            params = msg.get("params") or {}
            name = params.get("name", "")
            args = params.get("arguments") or {}
            text = server.call_tool(name, args)
            is_error = text.startswith(("snapdeck:", "controller request failed", "unknown tool"))
            _result(req_id, {"content": [{"type": "text", "text": text}], "isError": is_error})
        elif method == "ping":
            _result(req_id, {})
        elif req_id is not None:
            _error(req_id, -32601, f"method not found: {method}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="deck-mcp", description="Snapdeck MCP server.")
    ap.add_argument("--profile", choices=["read-only", "full"], default="read-only")
    ap.add_argument("--version", action="version", version=f"snapdeck-mcp {__version__}")
    args = ap.parse_args(argv)
    return serve(Server(profile=args.profile))


if __name__ == "__main__":
    raise SystemExit(main())
