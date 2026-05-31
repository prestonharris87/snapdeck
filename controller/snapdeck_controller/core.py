"""Snapdeck controller engine.

A faithful generalization of the original Elite dev-controller: the battle-tested
POSIX process/port/ready logic is preserved verbatim, but the two hardcoded
services (frontend/backend) become an arbitrary, config-driven set of services
loaded from snapdeck.toml. Module-level state is initialized once via ``init()``.
"""

from __future__ import annotations

import json
import os
import queue
import re
import signal
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .config import Config, ServiceConfig, render
from . import paths as _paths
from .procutil import (
    descendants_of, kill_tree, listener_on_port, listening_ports_of_pid,
    pgid_of, pid_alive, port_in_use,
)

# --- Globals (populated by init) ----------------------------------------------

CONFIG: Config = None  # type: ignore[assignment]
WORKTREE: Path = None  # type: ignore[assignment]
STATE_DIR: Path = None  # type: ignore[assignment]
EXEC_DIR: Path = None  # type: ignore[assignment]
PORTS_FILE: Path = None  # type: ignore[assignment]
STATE_FILE: Path = None  # type: ignore[assignment]
CONTROLLER_PID_FILE: Path = None  # type: ignore[assignment]
EVENTS_LOG: Path = None  # type: ignore[assignment]
REGISTRY_DIR: Path = None  # type: ignore[assignment]

# RESOLVED: {"controller": int, "<svc>": {"<portname>": int}}
RESOLVED: dict[str, object] = {}
SERVICE_STATE: dict[str, dict] = {}
SERVICE_LOCKS: dict[str, threading.Lock] = {}
SERVICE_GEN: dict[str, int] = {}

EVENT_PRINT_LOCK = threading.Lock()
EVENT_QUEUE: queue.Queue = queue.Queue()
SHUTDOWN_FLAG = threading.Event()
EXEC_JOBS: dict[str, dict] = {}
EXEC_JOBS_LOCK = threading.Lock()
CONTROLLER_STARTED_AT = ""
CONTROLLER_BOOT_MONOTONIC = 0.0

LOG_SIZE_CAP = 50 * 1024 * 1024
EXEC_LOG_SIZE_CAP = 5 * 1024 * 1024
EXEC_JOBS_KEEP_PER_NAME = 50
READY_POLL_INTERVAL = 1.0


def init(worktree: Path, config: Config) -> None:
    global CONFIG, WORKTREE, STATE_DIR, EXEC_DIR, PORTS_FILE, STATE_FILE
    global CONTROLLER_PID_FILE, EVENTS_LOG, REGISTRY_DIR, SERVICE_STATE, SERVICE_LOCKS, SERVICE_GEN
    CONFIG = config
    WORKTREE = worktree
    STATE_DIR = _paths.state_dir(worktree)
    EXEC_DIR = STATE_DIR / "exec"
    PORTS_FILE = STATE_DIR / "ports.json"
    STATE_FILE = STATE_DIR / "state.json"
    CONTROLLER_PID_FILE = STATE_DIR / "controller.pid"
    EVENTS_LOG = STATE_DIR / "events.log"
    REGISTRY_DIR = _paths.registry_dir(config.project_name)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    EXEC_DIR.mkdir(parents=True, exist_ok=True)
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
    SERVICE_LOCKS = {n: threading.Lock() for n in config.service_names}
    SERVICE_GEN = {n: 0 for n in config.service_names}
    SERVICE_STATE = {
        n: {"state": "down", "pid": None, "pgid": None, "port": None,
            "actual_port": None, "port_drift": False, "ready": False,
            "started_at": None, "ready_at": None, "last_event": None}
        for n in config.service_names
    }


def log_path_for(svc: str) -> Path:
    return STATE_DIR / f"{svc}.log"


def primary_port(svc: str) -> int | None:
    pm = RESOLVED.get(svc)
    if not isinstance(pm, dict):
        return None
    return pm.get(CONFIG.services[svc].primary_port_name)


# --- Time utilities -----------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def now_hhmmss() -> str:
    return datetime.now().strftime("%H:%M:%S")


# --- Port utilities (port_in_use/process utils now live in procutil) ----------

def probe_port(start: int) -> int:
    for i in range(CONFIG.port_max_tries):
        p = start + i * CONFIG.port_step
        if not port_in_use(p):
            return p
    raise RuntimeError(f"no free port in {start}..{start + CONFIG.port_step * CONFIG.port_max_tries}")


def warn_orphan_or_kill(port: int, label: str, kill_orphan: bool) -> bool:
    info = listener_on_port(port)
    if not info:
        return True
    pid = info["pid"]; cmd = info["cmd"]
    foreign_signature = any(s in (cmd or "").lower() for s in CONFIG.orphan_signatures)
    if kill_orphan and foreign_signature:
        emit_event(format_event("controller", "->", f"orphan-kill {label}", f":{port} pid={pid} cmd={cmd}"))
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return True
        for _ in range(50):
            time.sleep(0.1)
            if not pid_alive(pid):
                break
        if pid_alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            time.sleep(0.5)
        return not port_in_use(port)
    msg = (f"orphan-warn preferred {label} port :{port} is occupied by pid {pid} ({cmd}); bumping. "
           f"To take :{port} cleanly: restart with `up --kill-orphan`.")
    emit_event(format_event("controller", "->", f"orphan-warn {label}", f":{port} pid={pid} cmd={cmd}"))
    sys.stderr.write(f"[orphan-warn] {msg}\n")
    sys.stderr.flush()
    return False


def discover_ports(kill_orphan: bool = False, base: int | None = None) -> dict[str, object]:
    """Probe the controller port, derive the slot offset, and resolve every
    declared service port at default + slot*step, bumping past orphans.

    ``base`` overrides the probe-start (the configured controller port). Useful
    to pin a worktree to a specific slot — e.g. preserve its historical ports
    across a controller migration. The slot offset is always computed relative to
    the *configured* controller port, so service port families stay aligned."""
    controller_p = probe_port(base if base else CONFIG.controller_port)
    slot = (controller_p - CONFIG.controller_port) // CONFIG.port_step
    resolved: dict[str, object] = {"controller": controller_p}
    for svc in CONFIG.services.values():
        pm: dict[str, int] = {}
        for pname, default in svc.ports.items():
            preferred = default + slot * CONFIG.port_step
            if not port_in_use(preferred):
                pm[pname] = preferred
            elif warn_orphan_or_kill(preferred, f"{svc.name} {pname}", kill_orphan):
                pm[pname] = preferred
            else:
                pm[pname] = probe_port(preferred)
        resolved[svc.name] = pm
    return resolved


# --- Event log ----------------------------------------------------------------

def emit_event(line: str) -> None:
    EVENT_QUEUE.put(line)


def format_event(svc: str, arrow: str, kind: str, details: str = "") -> str:
    extra = f"  {details}" if details else ""
    return f"[{now_hhmmss()}] {svc.ljust(12)} {arrow} {kind}{extra}"


# --- Persistence --------------------------------------------------------------

def write_ports_json() -> None:
    PORTS_FILE.write_text(json.dumps({**RESOLVED, "worktree": str(WORKTREE)}, indent=2) + "\n")


def write_state_json() -> None:
    snap = {svc: dict(s) for svc, s in SERVICE_STATE.items()}
    STATE_FILE.write_text(json.dumps(snap, indent=2) + "\n")


def write_state_files() -> None:
    """Render the optional generic [[state_files]] outputs (e.g. dev-server.txt)."""
    for sf in CONFIG.state_files:
        try:
            lines = [render(line, None, RESOLVED) for line in sf.lines]  # type: ignore[arg-type]
            dest = WORKTREE / sf.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text("\n".join(lines) + "\n")
        except Exception:
            pass


def write_registry_entry() -> None:
    slug = WORKTREE.name
    browsable = CONFIG.browsable_service
    browsable_ports = list((RESOLVED.get(browsable) or {}).values()) if browsable else []  # type: ignore[union-attr]
    entry = {
        "project": CONFIG.project_name,
        "worktree": str(WORKTREE),
        "controller_port": RESOLVED["controller"],
        "ports": {k: v for k, v in RESOLVED.items() if k != "controller"},
        "browsable": browsable,
        "browsable_ports": browsable_ports,
        "user_test_reports_dir": str(WORKTREE / CONFIG.user_test_reports_dir),
        "pid": os.getpid(),
        "started_at": CONTROLLER_STARTED_AT,
    }
    try:
        (REGISTRY_DIR / f"{slug}.json").write_text(json.dumps(entry, indent=2) + "\n")
    except OSError:
        pass


def remove_registry_entry() -> None:
    try:
        (REGISTRY_DIR / f"{WORKTREE.name}.json").unlink()
    except (FileNotFoundError, OSError):
        pass


# --- Env + patches ------------------------------------------------------------

def service_env(svc: str) -> dict[str, str]:
    cfg = CONFIG.services[svc]
    env = dict(os.environ)
    for k, v in cfg.env.items():
        env[k] = render(v, svc, RESOLVED)
    lp = cfg.env_from_launch_profile
    if lp:
        try:
            f = WORKTREE / lp["file"]
            profiles = json.loads(f.read_text(encoding="utf-8")).get("profiles", {})
            prof = profiles.get(lp.get("profile", ""), {})
            for k, v in (prof.get("environmentVariables") or {}).items():
                env[k] = str(v)
        except (OSError, json.JSONDecodeError, KeyError):
            pass
    return env


def _set_dotted(d: dict, dotted: str, value) -> bool:
    """Set a dotted key into a nested dict. Returns True if a change was made."""
    parts = dotted.split(".")
    cur = d
    for p in parts[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[p] = nxt
        cur = nxt
    last = parts[-1]
    if cur.get(last) == value:
        return False
    cur[last] = value
    return True


def apply_patches(svc: str) -> None:
    cfg = CONFIG.services[svc]
    for patch in cfg.patches:
        target = WORKTREE / patch.file
        if not target.exists():
            continue
        try:
            original = target.read_text()
            data = json.loads(original)
        except (OSError, json.JSONDecodeError):
            continue
        changed = False
        for dotted, tmpl in patch.json_set.items():
            try:
                val = render(tmpl, svc, RESOLVED)
            except Exception:
                continue
            if _set_dotted(data, dotted, val):
                changed = True
        if changed:
            text = json.dumps(data, indent=4)
            if original.endswith("\n"):
                text += "\n"
            try:
                target.write_text(text)
                emit_event(format_event(svc, "->", "patched", patch.file))
            except OSError:
                pass


# --- Logs + ready -------------------------------------------------------------

def truncate_log(path: Path) -> None:
    try:
        path.write_text("")
    except OSError:
        pass


def maybe_rotate_log(path: Path, cap: int) -> None:
    try:
        if path.exists() and path.stat().st_size > cap:
            tail = path.read_bytes()[-(cap // 2):]
            path.write_bytes(b"... [head truncated]\n" + tail)
    except OSError:
        pass


def http_probe(url: str, timeout: float = 2.0) -> bool:
    ctx = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(url, timeout=timeout, context=ctx) as r:
            return 200 <= r.status < 400
    except Exception:
        return False


def log_contains(path: Path, pattern: re.Pattern | str, since_offset: int = 0, min_count: int = 1) -> bool:
    try:
        with path.open("rb") as f:
            f.seek(since_offset)
            data = f.read().decode("utf-8", errors="replace")
    except OSError:
        return False
    if isinstance(pattern, re.Pattern):
        return len(pattern.findall(data)) >= min_count
    return data.count(pattern) >= min_count


def wait_ready(svc: str, log_offset_at_spawn: int) -> tuple[bool, str]:
    cfg = CONFIG.services[svc]
    ready = cfg.ready
    if ready.kind == "delay":
        time.sleep(ready.delay_s)
        return True, f"delay {ready.delay_s}s"

    log_path = log_path_for(svc)
    rx = re.compile(ready.log_pattern) if ready.log_pattern else None
    start = time.monotonic()
    soft_timeout = cfg.startup_timeout_s
    warned = False
    state = SERVICE_STATE[svc]
    desired_port = state.get("port")
    check_open = None
    if ready.kind == "port_open":
        pm = RESOLVED.get(svc) or {}
        check_open = pm.get(ready.port_open or cfg.primary_port_name)  # type: ignore[union-attr]
    conflict_check_interval = 8.0
    last_conflict_check = 0.0

    while not SHUTDOWN_FLAG.is_set():
        elapsed = time.monotonic() - start
        if elapsed > soft_timeout and not warned:
            emit_event(format_event(svc, "->", f"slow-start ({int(elapsed)}s)",
                                    "still booting — first cold build can exceed soft timeout"))
            warned = True

        http_ok = True
        if ready.kind in ("http_log", "http"):
            http_ok = http_probe(render(ready.http_url, svc, RESOLVED))  # type: ignore[arg-type]
        marker_ok = True
        marker_label = ""
        if ready.kind in ("http_log", "log_match") and rx is not None:
            marker_ok = log_contains(log_path, rx, log_offset_at_spawn, ready.log_min_count)
            marker_label = f"/{ready.log_pattern}/ x{ready.log_min_count}"
        if ready.kind == "port_open":
            marker_ok = bool(check_open and port_in_use(check_open))
            marker_label = f"listening :{check_open}"

        if http_ok and marker_ok:
            return True, marker_label or "http ok"

        if state["pid"] and not pid_alive(state["pid"]):
            return False, "process exited during start"

        if (elapsed > min(15.0, soft_timeout) and desired_port and
                time.monotonic() - last_conflict_check > conflict_check_interval):
            last_conflict_check = time.monotonic()
            our_pid = state.get("pid")
            our_tree = set(descendants_of(our_pid)) if our_pid else set()
            info = listener_on_port(desired_port)
            if info and info["pid"] not in our_tree:
                return False, (
                    f"port-bind-conflict: :{desired_port} held by pid {info['pid']} "
                    f"({info.get('cmd') or '?'}); our process tree (root pid {our_pid}) can't bind. "
                    f"Hint: stop the offending process or restart with `--kill-orphan`.")
        time.sleep(READY_POLL_INTERVAL)
    return False, "controller shutdown during start"


# --- Service lifecycle --------------------------------------------------------

def spawn_service(svc: str, actor: str) -> dict:
    cfg = CONFIG.services[svc]
    cwd = WORKTREE / cfg.cwd
    log_path = log_path_for(svc)
    truncate_log(log_path)
    apply_patches(svc)  # pin templated files BEFORE the watcher catches a half-write
    cmd = ["bash", "-c", render(cfg.start, svc, RESOLVED)]
    env = service_env(svc)
    log_fp = log_path.open("ab", buffering=0)
    spawn_started = log_path.stat().st_size
    emit_event(format_event(svc, "->", f"starting ({actor})", f"cwd={cfg.cwd}"))
    try:
        proc = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdout=log_fp,
                                stderr=subprocess.STDOUT, start_new_session=True)
    except FileNotFoundError as e:
        log_fp.close()
        emit_event(format_event(svc, "->", "spawn-failed", str(e)))
        return {"ok": False, "ready": False, "error": str(e)}

    state = SERVICE_STATE[svc]
    state.update({"state": "starting", "pid": proc.pid, "pgid": pgid_of(proc.pid),
                  "port": primary_port(svc), "actual_port": None, "port_drift": False,
                  "ready": False, "started_at": now_iso(), "ready_at": None, "last_event": "starting"})
    write_state_json()

    t0 = time.monotonic()
    ready, marker = wait_ready(svc, spawn_started)
    took = round(time.monotonic() - t0, 1)
    log_fp.close()

    if ready:
        state.update({"state": "ready", "ready": True, "ready_at": now_iso(), "last_event": "ready"})
        reconcile_actual_port(svc)
        emit_event(format_event(svc, "->", f"ready ({int(took)}s)", f"marker: {marker}"))
        write_state_json()
        write_state_files()
        return {"ok": True, "ready": True, "took_s": took, "marker_seen": marker}

    is_conflict = marker.startswith("port-bind-conflict")
    state["state"] = "failed"
    state["last_event"] = "port-bind-conflict" if is_conflict else "start-failed"
    emit_event(format_event(svc, "->", "port-bind-conflict" if is_conflict else "start-failed", marker))
    write_state_json()
    if is_conflict and state["pid"] and pid_alive(state["pid"]):
        kill_tree(state["pid"], state.get("pgid"), signal.SIGTERM)
        for _ in range(30):
            if not pid_alive(state["pid"]):
                break
            time.sleep(0.1)
        if pid_alive(state["pid"]):
            kill_tree(state["pid"], state.get("pgid"), signal.SIGKILL)
        state.update({"pid": None, "pgid": None, "state": "down"})
        write_state_json()
    return {"ok": False, "ready": False, "took_s": took, "error": marker}


def stop_service(svc: str, actor: str) -> dict:
    cfg = CONFIG.services[svc]
    state = SERVICE_STATE[svc]
    pid = state["pid"]; pgid = state["pgid"]
    if not pid or not pid_alive(pid):
        state.update({"state": "down", "pid": None, "pgid": None, "ready": False, "last_event": "stop-noop"})
        write_state_json()
        return {"ok": True, "exit_code": None, "took_s": 0.0, "noop": True}
    emit_event(format_event(svc, "->", f"stopping (sigterm, pid {pid})", ""))
    state["state"] = "stopping"; state["last_event"] = "stopping"
    write_state_json()
    if cfg.pre_stop:
        try:
            subprocess.run(["bash", "-c", cfg.pre_stop], cwd=str(WORKTREE / cfg.cwd),
                           env=os.environ.copy(), capture_output=True, timeout=15)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    t0 = time.monotonic()
    if not kill_tree(pid, pgid, signal.SIGTERM):
        emit_event(format_event(svc, "->", "kill-failed", f"SIGTERM had no effect (EPERM after sleep?); pid={pid}"))
    for _ in range(50):
        if not pid_alive(pid):
            break
        time.sleep(0.1)
    else:
        if not kill_tree(pid, pgid, signal.SIGKILL):
            emit_event(format_event(svc, "->", "kill-failed", f"SIGKILL had no effect; pid={pid}"))
        for _ in range(20):
            if not pid_alive(pid):
                break
            time.sleep(0.1)
    port = state.get("port")
    if port:
        for _ in range(10):
            if not port_in_use(port):
                break
            time.sleep(0.05)
    took = round(time.monotonic() - t0, 1)
    state.update({"state": "down", "pid": None, "pgid": None, "ready": False, "last_event": "stopped"})
    write_state_json()
    emit_event(format_event(svc, "->", f"stopped (after {took}s)", ""))
    return {"ok": True, "exit_code": None, "took_s": took}


def reprobe_service_port(svc: str) -> None:
    """On restart, try to return each of this service's ports to its preferred
    slot value if that port is now free."""
    if "controller" not in RESOLVED:
        return
    slot = (RESOLVED["controller"] - CONFIG.controller_port) // CONFIG.port_step  # type: ignore[operator]
    cfg = CONFIG.services[svc]
    pm = RESOLVED.get(svc) or {}
    changed = False
    for pname, default in cfg.ports.items():
        preferred = default + slot * CONFIG.port_step
        if pm.get(pname) == preferred:
            continue
        if not port_in_use(preferred):
            emit_event(format_event(svc, "->", "re-probe",
                                    f"{pname} :{preferred} now free; switching from :{pm.get(pname)}"))
            pm[pname] = preferred  # type: ignore[index]
            changed = True
    if changed:
        write_ports_json()


def restart_service(svc: str, actor: str) -> dict:
    emit_event(format_event(svc, "<-", f"restart  (actor: {actor})", ""))
    stop_result = stop_service(svc, actor)
    if not stop_result.get("ok"):
        return stop_result
    reprobe_service_port(svc)
    return spawn_service(svc, actor)


def reconcile_actual_port(svc: str) -> None:
    state = SERVICE_STATE[svc]
    pid = state.get("pid"); desired_port = state.get("port")
    if not pid or not pid_alive(pid):
        return
    actual_ports = listening_ports_of_pid(pid)
    if not actual_ports:
        return
    chosen = None
    for p in actual_ports:
        if p == desired_port:
            chosen = p
            break
    if chosen is None:
        for p in actual_ports:
            if abs(p - (desired_port or 0)) < 100:
                chosen = p
                break
    if chosen is None:
        chosen = actual_ports[0]
    state["actual_port"] = chosen
    drift = bool(desired_port and chosen != desired_port)
    state["port_drift"] = drift
    if drift:
        emit_event(format_event(svc, "->", "port-drift", f"desired=:{desired_port}  actual=:{chosen}  pid={pid}"))


def crash_watcher() -> None:
    while not SHUTDOWN_FLAG.is_set():
        time.sleep(1.0)
        for svc, state in SERVICE_STATE.items():
            pid = state.get("pid")
            if state.get("state") == "ready" and pid and not pid_alive(pid):
                state.update({"state": "down", "pid": None, "pgid": None, "ready": False, "last_event": "crashed"})
                write_state_json()
                emit_event(format_event(svc, "->", "crashed", "exit detected — no stop request"))


def try_adopt() -> None:
    if not STATE_FILE.exists():
        return
    try:
        prior = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    for svc in CONFIG.service_names:
        ps = prior.get(svc) or {}
        pid = ps.get("pid")
        if not pid or not pid_alive(pid):
            continue
        pgid_now = pgid_of(pid)
        if ps.get("pgid") and pgid_now != ps.get("pgid"):
            continue
        SERVICE_STATE[svc].update({
            "state": "ready" if ps.get("ready") else "starting", "pid": pid, "pgid": pgid_now,
            "port": ps.get("port"), "actual_port": None, "port_drift": False,
            "ready": bool(ps.get("ready")), "started_at": ps.get("started_at"),
            "ready_at": ps.get("ready_at"), "last_event": "adopted"})
        emit_event(format_event(svc, "->", "adopted", f"pid={pid} pgid={pgid_now}"))
        reconcile_actual_port(svc)
        write_state_json()


# --- Exec catalog -------------------------------------------------------------

def catalog_for_api() -> list[dict]:
    out = []
    for e in CONFIG.exec_catalog:
        out.append({"name": e.name, "description": e.description, "tier": e.tier,
                    "cwd": e.cwd, "requires_stopped": e.requires_stopped,
                    "requires_confirm": e.requires_confirm, "est_duration_s": e.est_duration_s,
                    "cumulative_of": e.cumulative_of})
    return out


def find_catalog_entry(name: str):
    for e in CONFIG.exec_catalog:
        if e.name == name:
            return e
    return None


def sweep_old_exec_logs() -> None:
    by_name: dict[str, list[Path]] = {}
    for p in EXEC_DIR.glob("*.log"):
        stem = p.stem
        name = stem.rsplit(".", 1)[0] if "." in stem else stem
        by_name.setdefault(name, []).append(p)
    for _name, files in by_name.items():
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for p in files[EXEC_JOBS_KEEP_PER_NAME:]:
            try:
                p.unlink()
            except OSError:
                pass


def run_exec_job(entry, actor: str, confirm: bool) -> dict:
    if entry.requires_confirm and not confirm:
        return {"error": "requires confirm=1", "status": 412}
    blocked = [s for s in entry.requires_stopped if SERVICE_STATE.get(s, {}).get("state") != "down"]
    if blocked:
        return {"error": f"requires stopped: {', '.join(blocked)} — stop them first", "status": 409}
    job_id = uuid.uuid4().hex[:8]
    log_path = EXEC_DIR / f"{entry.name}.{job_id}.log"
    log_path.write_text("")
    cwd = WORKTREE / entry.cwd
    emit_event(format_event("exec", "<-", f"{entry.name}  (actor: {actor})  job={job_id}", ""))
    log_fp = log_path.open("ab", buffering=0)
    try:
        proc = subprocess.Popen(["bash", "-c", entry.cmd], cwd=str(cwd), stdout=log_fp,
                                stderr=subprocess.STDOUT, env=os.environ.copy(), start_new_session=True)
    except FileNotFoundError as e:
        log_fp.close()
        emit_event(format_event("exec", "->", f"spawn-failed {entry.name}", str(e)))
        return {"error": str(e), "status": 500}
    job = {"job_id": job_id, "name": entry.name, "state": "running", "exit_code": None,
           "started_at": now_iso(), "finished_at": None, "took_s": None, "command": entry.cmd,
           "cwd": str(cwd), "log_path": str(log_path), "pid": proc.pid, "actor": actor}
    with EXEC_JOBS_LOCK:
        EXEC_JOBS[job_id] = job

    def _wait():
        t0 = time.monotonic()
        proc.wait()
        log_fp.close()
        with EXEC_JOBS_LOCK:
            job["exit_code"] = proc.returncode
            job["finished_at"] = now_iso()
            job["took_s"] = round(time.monotonic() - t0, 1)
            job["state"] = "done" if proc.returncode == 0 else "failed"
        maybe_rotate_log(log_path, EXEC_LOG_SIZE_CAP)
        emit_event(format_event("exec", "->", f"finished {entry.name}",
                                f"exit={proc.returncode}  {job['took_s']}s  job={job_id}"))

    threading.Thread(target=_wait, daemon=True, name=f"exec-{job_id}").start()
    return {"job_id": job_id, "state": "running", "started_at": job["started_at"]}


# --- API ----------------------------------------------------------------------

def api_status() -> dict:
    out = {svc: dict(s) for svc, s in SERVICE_STATE.items()}
    out["controller"] = {
        "pid": os.getpid(),
        "version": __version__,
        "uptime_s": int(time.monotonic() - CONTROLLER_BOOT_MONOTONIC),
        "started_at": CONTROLLER_STARTED_AT,
        "worktree": str(WORKTREE),
        "project": CONFIG.project_name,
        "ports": RESOLVED,
    }
    return out


def _resolve_svcs(target: str) -> list[str]:
    if target == "all":
        return CONFIG.service_names
    return [target]


def api_start(target: str, actor: str) -> dict:
    if target == "all":
        return start_all(actor, only_down=False)
    svc = target
    with SERVICE_LOCKS[svc]:
        if SERVICE_STATE[svc]["state"] == "ready":
            return {"ok": True, "ready": True, "noop": True}
        SERVICE_GEN[svc] += 1
        return spawn_service(svc, actor)


def start_all(actor: str, only_down: bool) -> dict:
    """Start services honoring depends_on: a service starts once all its deps are
    ready. Services with satisfied deps start in parallel (a wave)."""
    results: dict[str, dict] = {}
    pending = [s for s in CONFIG.service_names
               if not (only_down and SERVICE_STATE[s]["state"] != "down")]
    ready_now = {s for s in CONFIG.service_names if SERVICE_STATE[s]["ready"]}
    for s in list(pending):
        if SERVICE_STATE[s]["state"] == "ready":
            results[s] = {"ok": True, "ready": True, "noop": True}
            pending.remove(s)
            ready_now.add(s)
    while pending:
        wave = [s for s in pending
                if all(dep in ready_now for dep in CONFIG.services[s].depends_on if dep in CONFIG.services)]
        if not wave:
            wave = list(pending)  # unsatisfiable deps / cycle — start the rest anyway
        threads = []
        wave_results: dict[str, dict] = {}

        def _run(svc=None):
            with SERVICE_LOCKS[svc]:
                SERVICE_GEN[svc] += 1
                wave_results[svc] = spawn_service(svc, actor)

        for s in wave:
            t = threading.Thread(target=_run, kwargs={"svc": s}, name=f"start-{s}")
            t.start(); threads.append(t)
        for t in threads:
            t.join()
        for s in wave:
            results[s] = wave_results.get(s, {"ok": False, "error": "no result"})
            if SERVICE_STATE[s]["ready"]:
                ready_now.add(s)
            pending.remove(s)
    return results


def api_stop(target: str, actor: str) -> dict:
    results: dict[str, dict] = {}
    for svc in _resolve_svcs(target):
        with SERVICE_LOCKS[svc]:
            emit_event(format_event(svc, "<-", f"stop     (actor: {actor})", ""))
            SERVICE_GEN[svc] += 1
            results[svc] = stop_service(svc, actor)
    return results[target] if target != "all" else results


def api_restart(target: str, actor: str) -> dict:
    results: dict[str, dict] = {}
    for svc in _resolve_svcs(target):
        with SERVICE_LOCKS[svc]:
            SERVICE_GEN[svc] += 1
            results[svc] = restart_service(svc, actor)
    return results[target] if target != "all" else results


def api_exec_job(job_id: str) -> dict:
    with EXEC_JOBS_LOCK:
        job = EXEC_JOBS.get(job_id)
        if not job:
            return {"error": "no such job"}
        return dict(job)


def api_exec_jobs(limit: int) -> list[dict]:
    with EXEC_JOBS_LOCK:
        items = list(EXEC_JOBS.values())
    items.sort(key=lambda j: j.get("started_at") or "", reverse=True)
    return items[:limit]


# --- Shutdown -----------------------------------------------------------------

def initiate_shutdown() -> None:
    if SHUTDOWN_FLAG.is_set():
        return
    SHUTDOWN_FLAG.set()
    with EVENT_PRINT_LOCK:
        print("\nshutting down — stopping children…", flush=True)
    for svc in CONFIG.service_names:
        try:
            stop_service(svc, "shutdown")
        except Exception as e:
            sys.stderr.write(f"shutdown {svc}: {e}\n")
    remove_registry_entry()
    while not EVENT_QUEUE.empty():
        try:
            line = EVENT_QUEUE.get_nowait()
            with EVENT_PRINT_LOCK:
                print(line, flush=True)
            try:
                with EVENTS_LOG.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except OSError:
                pass
        except queue.Empty:
            break
