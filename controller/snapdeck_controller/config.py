"""Load and validate snapdeck.toml into a typed config model, plus the port
templating used throughout the engine.

Templating tokens (resolved after probe-and-bump):
  {port.<name>}            the *current* service's resolved port named <name>
  {svc.<service>.<name>}   another service's resolved port named <name>
"""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from . import SnapdeckError
from . import paths as _paths
from .paths import CONFIG_FILENAME

_TOKEN_RE = re.compile(r"\{(port\.[A-Za-z0-9_]+|svc\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+)\}")

VALID_READY_KINDS = {"http_log", "http", "log_match", "port_open", "delay"}


@dataclass
class ReadyConfig:
    kind: str = "http_log"
    http_url: str | None = None
    log_pattern: str | None = None
    log_min_count: int = 1
    primary_port: str | None = None
    port_open: str | None = None  # named port to check for kind == port_open
    delay_s: float = 3.0


@dataclass
class PatchConfig:
    file: str
    json_set: dict[str, str]  # dotted-key -> templated value


@dataclass
class ServiceConfig:
    name: str
    cwd: str
    start: str
    ports: dict[str, int]
    ready: ReadyConfig
    startup_timeout_s: int = 90
    depends_on: list[str] = field(default_factory=list)
    browsable: bool = False
    env: dict[str, str] = field(default_factory=dict)
    env_from_launch_profile: dict | None = None  # {"file": ..., "profile": ...}
    pre_stop: str | None = None
    patches: list[PatchConfig] = field(default_factory=list)

    @property
    def primary_port_name(self) -> str:
        if self.ready.primary_port and self.ready.primary_port in self.ports:
            return self.ready.primary_port
        return next(iter(self.ports))  # first declared port


@dataclass
class ExecEntry:
    name: str
    cmd: str
    description: str = ""
    tier: str = "-"
    cwd: str = "."
    requires_stopped: list[str] = field(default_factory=list)
    requires_confirm: bool = False
    est_duration_s: int = 10
    cumulative_of: list[str] = field(default_factory=list)


@dataclass
class StateFile:
    path: str
    lines: list[str]


@dataclass
class Config:
    project_name: str
    controller_port: int
    port_step: int
    port_max_tries: int
    services: dict[str, ServiceConfig]
    user_test_reports_dir: str
    state_files: list[StateFile]
    exec_catalog: list[ExecEntry]
    source_path: Path

    @property
    def service_names(self) -> list[str]:
        return list(self.services)

    @property
    def browsable_service(self) -> str | None:
        for name, svc in self.services.items():
            if svc.browsable:
                return name
        return None


def load(worktree: Path) -> Config:
    src = _paths.config_path(worktree)
    if src is None:
        raise SnapdeckError(f"no {CONFIG_FILENAME} at {worktree} (root or .claude/)")
    try:
        raw = tomllib.loads(src.read_text(encoding="utf-8"))
    except (tomllib.TOMLDecodeError, OSError) as e:
        raise SnapdeckError(f"failed to read {src}: {e}")

    project = raw.get("project") or {}
    name = project.get("name")
    if not name:
        raise SnapdeckError(f"{src}: [project] name is required")

    ports = raw.get("ports") or {}
    controller_port = int(ports.get("controller", 7777))
    step = int(ports.get("step", 10))
    max_tries = int(ports.get("max_tries", 30))

    services_raw = raw.get("services") or {}
    if not services_raw:
        raise SnapdeckError(f"{src}: at least one [services.<name>] is required")
    services: dict[str, ServiceConfig] = {}
    for svc_name, s in services_raw.items():
        services[svc_name] = _parse_service(src, svc_name, s)

    # Validate depends_on references and browsable uniqueness.
    browsable = [n for n, s in services.items() if s.browsable]
    if len(browsable) > 1:
        raise SnapdeckError(f"{src}: only one service may set browsable = true (got {browsable})")
    for n, s in services.items():
        for dep in s.depends_on:
            if dep not in services:
                raise SnapdeckError(f"{src}: service '{n}' depends_on unknown service '{dep}'")

    reports = raw.get("user_test_reports") or {}
    reports_dir = reports.get("output_dir", "thoughts/shared/user-test-reports")

    state_files = [
        StateFile(path=sf["path"], lines=list(sf.get("lines", [])))
        for sf in (raw.get("state_files") or [])
    ]

    exec_catalog = [_parse_exec(src, e) for e in (raw.get("exec") or [])]

    return Config(
        project_name=name,
        controller_port=controller_port,
        port_step=step,
        port_max_tries=max_tries,
        services=services,
        user_test_reports_dir=reports_dir,
        state_files=state_files,
        exec_catalog=exec_catalog,
        source_path=src,
    )


def _parse_service(src: Path, name: str, s: dict) -> ServiceConfig:
    if "start" not in s:
        raise SnapdeckError(f"{src}: service '{name}' missing `start`")
    raw_ports = s.get("ports") or {}
    if not raw_ports:
        raise SnapdeckError(f"{src}: service '{name}' must declare at least one [services.{name}.ports]")
    ports = {k: int(v) for k, v in raw_ports.items()}

    r = s.get("ready") or {}
    kind = r.get("kind", "http_log")
    if kind not in VALID_READY_KINDS:
        raise SnapdeckError(f"{src}: service '{name}' ready.kind '{kind}' invalid; one of {sorted(VALID_READY_KINDS)}")
    ready = ReadyConfig(
        kind=kind,
        http_url=r.get("http_url"),
        log_pattern=r.get("log_pattern"),
        log_min_count=int(r.get("log_min_count", 1)),
        primary_port=r.get("primary_port"),
        port_open=r.get("port_open"),
        delay_s=float(r.get("delay_s", 3.0)),
    )
    if kind in ("http_log", "http") and not ready.http_url:
        raise SnapdeckError(f"{src}: service '{name}' ready.kind '{kind}' needs http_url")
    if kind in ("http_log", "log_match") and not ready.log_pattern:
        raise SnapdeckError(f"{src}: service '{name}' ready.kind '{kind}' needs log_pattern")

    patches = []
    for p in s.get("patch") or []:
        patches.append(PatchConfig(file=p["file"], json_set=dict(p.get("json_set") or {})))

    return ServiceConfig(
        name=name,
        cwd=s.get("cwd", "."),
        start=s["start"],
        ports=ports,
        ready=ready,
        startup_timeout_s=int(s.get("startup_timeout_s", 90)),
        depends_on=list(s.get("depends_on") or []),
        browsable=bool(s.get("browsable", False)),
        env={k: str(v) for k, v in (s.get("env") or {}).items()},
        env_from_launch_profile=s.get("env_from_launch_profile"),
        pre_stop=s.get("pre_stop"),
        patches=patches,
    )


def _parse_exec(src: Path, e: dict) -> ExecEntry:
    if "name" not in e or "cmd" not in e:
        raise SnapdeckError(f"{src}: every [[exec]] needs a name and cmd")
    return ExecEntry(
        name=e["name"],
        cmd=e["cmd"],
        description=e.get("description", ""),
        tier=e.get("tier", "-"),
        cwd=e.get("cwd", "."),
        requires_stopped=list(e.get("requires_stopped") or []),
        requires_confirm=bool(e.get("requires_confirm", False)),
        est_duration_s=int(e.get("est_duration_s", 10)),
        cumulative_of=list(e.get("cumulative_of") or []),
    )


def render(template: str, current_service: str | None, resolved: dict[str, dict[str, int]]) -> str:
    """Substitute {port.X} and {svc.S.X} tokens against the resolved port map.

    ``resolved`` maps service-name -> {port-name: int}.
    """
    def _sub(m: re.Match) -> str:
        tok = m.group(1)
        if tok.startswith("port."):
            pname = tok[len("port."):]
            if current_service is None:
                raise SnapdeckError(f"'{{{tok}}}' used without a service context")
            try:
                return str(resolved[current_service][pname])
            except KeyError:
                raise SnapdeckError(f"service '{current_service}' has no port '{pname}'")
        # svc.<service>.<name>
        _, svc, pname = tok.split(".", 2)
        try:
            return str(resolved[svc][pname])
        except KeyError:
            raise SnapdeckError(f"no resolved port '{pname}' for service '{svc}'")

    return _TOKEN_RE.sub(_sub, template)
