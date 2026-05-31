"""Process / port utilities, with two backends.

On macOS and Linux these use the original, battle-tested POSIX tools
(``lsof`` / ``pgrep`` / ``killpg``) — byte-for-byte the logic the Elite
dev-controller shipped. On Windows they use ``psutil`` (installed via the
``snapdeck[windows]`` extra), since process groups and lsof don't exist there.

The POSIX path is unchanged, so nothing about mac/linux behavior is affected by
the cross-platform support.
"""

from __future__ import annotations

import os
import signal
import socket
import subprocess
import sys

IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:  # pragma: no cover - exercised only on Windows
    try:
        import psutil
    except ImportError as e:
        raise ImportError(
            "Snapdeck on Windows requires psutil. Install it with: pip install 'snapdeck[windows]'"
        ) from e


def pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    if IS_WINDOWS:  # pragma: no cover
        return psutil.pid_exists(int(pid))
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def pgid_of(pid: int) -> int | None:
    if IS_WINDOWS:  # pragma: no cover - no process groups on Windows
        return None
    try:
        return os.getpgid(pid)
    except ProcessLookupError:
        return None


def port_in_use(port: int) -> bool:
    if IS_WINDOWS:  # pragma: no cover
        try:
            for c in psutil.net_connections(kind="inet"):
                if c.status == psutil.CONN_LISTEN and c.laddr and c.laddr.port == port:
                    return True
        except (psutil.AccessDenied, OSError):
            pass
        return _bind_probe(port)
    try:
        r = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True, timeout=3,
        )
        return r.returncode == 0 and bool(r.stdout.strip())
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return _bind_probe(port)


def _bind_probe(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        s.close()
        return False
    except OSError:
        return True


def listener_on_port(port: int) -> dict | None:
    """Return {pid, cmd} of the process LISTENing on port, or None."""
    if IS_WINDOWS:  # pragma: no cover
        try:
            for c in psutil.net_connections(kind="inet"):
                if c.status == psutil.CONN_LISTEN and c.laddr and c.laddr.port == port and c.pid:
                    try:
                        name = psutil.Process(c.pid).name()
                    except psutil.Error:
                        name = ""
                    return {"pid": c.pid, "cmd": name}
        except (psutil.AccessDenied, OSError):
            return None
        return None
    try:
        r = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-Fpc"],
            capture_output=True, timeout=3,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        return None
    pid = None; cmd = None
    for line in r.stdout.decode("utf-8", errors="replace").splitlines():
        if line.startswith("p"):
            try:
                pid = int(line[1:])
            except ValueError:
                pid = None
        elif line.startswith("c") and pid is not None:
            cmd = line[1:]
            break
    if pid is None:
        return None
    return {"pid": pid, "cmd": cmd or ""}


def listening_ports_of_pid(pid: int) -> list[int]:
    if IS_WINDOWS:  # pragma: no cover
        try:
            p = psutil.Process(pid)
            return sorted({c.laddr.port for c in p.net_connections(kind="inet")
                           if c.status == psutil.CONN_LISTEN and c.laddr})
        except psutil.Error:
            return []
    try:
        r = subprocess.run(
            ["lsof", "-a", "-nP", "-p", str(pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
            capture_output=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    ports: list[int] = []
    for line in r.stdout.decode("utf-8", errors="replace").splitlines():
        if not line.startswith("n"):
            continue
        trailing = line.rsplit(":", 1)[-1].split("->", 1)[0].strip()
        try:
            ports.append(int(trailing))
        except ValueError:
            continue
    seen: set[int] = set(); uniq: list[int] = []
    for p in ports:
        if p not in seen:
            seen.add(p); uniq.append(p)
    return uniq


def descendants_of(pid: int, depth: int = 5) -> list[int]:
    """All descendant PIDs of pid, parent last (so per-PID kills hit children first)."""
    if IS_WINDOWS:  # pragma: no cover
        try:
            kids = psutil.Process(pid).children(recursive=True)
            return [c.pid for c in kids] + [pid]
        except psutil.Error:
            return [pid]
    seen = {pid}; frontier = [pid]
    for _ in range(depth):
        nxt: list[int] = []
        for p in frontier:
            try:
                r = subprocess.run(["pgrep", "-P", str(p)], capture_output=True, timeout=3)
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
            for line in r.stdout.decode("utf-8", errors="replace").splitlines():
                try:
                    child = int(line.strip())
                except ValueError:
                    continue
                if child not in seen:
                    seen.add(child); nxt.append(child)
        if not nxt:
            break
        frontier = nxt
    return [p for p in seen if p != pid] + [pid]


def kill_tree(pid: int, pgid: int | None, sig: signal.Signals) -> bool:
    """Signal a process and its descendants. Returns True if any kill succeeded."""
    if IS_WINDOWS:  # pragma: no cover - no signals/process-groups on Windows
        ok = False
        try:
            procs = psutil.Process(pid).children(recursive=True) + [psutil.Process(pid)]
        except psutil.Error:
            procs = []
        for p in procs:
            try:
                p.kill() if sig == signal.SIGKILL else p.terminate()
                ok = True
            except psutil.Error:
                continue
        return ok
    if pgid:
        try:
            os.killpg(pgid, sig)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            pass
    success = False
    for p in descendants_of(pid):
        try:
            os.kill(p, sig)
            success = True
        except (ProcessLookupError, PermissionError):
            continue
    return success
