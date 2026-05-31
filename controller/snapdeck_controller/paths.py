"""Worktree resolution and filesystem layout.

Worktree resolution mirrors the hard-won rule from the original Elite
dev-controller: use ``.absolute()``, NOT ``.resolve()``. A worktree's tooling
directory may be symlinked to a shared parent; ``.resolve()`` would follow the
symlinks and pin the worktree to that shared parent instead of the actual
invoking worktree. We anchor on the directory that contains ``snapdeck.toml``.
"""

from __future__ import annotations

import os
from pathlib import Path

import platformdirs

from . import SnapdeckError

CONFIG_FILENAME = "snapdeck.toml"


def resolve_worktree(explicit: str | None = None) -> Path:
    """Return the worktree root (the dir containing snapdeck.toml).

    Precedence:
      1. an explicit path (CLI flag),
      2. ``SNAPDECK_WORKTREE`` env (or legacy ``DEV_CONTROLLER_WORKTREE``),
      3. walk up from the current directory until a snapdeck.toml is found.
    """
    env = explicit or os.environ.get("SNAPDECK_WORKTREE") or os.environ.get("DEV_CONTROLLER_WORKTREE")
    if env:
        p = Path(env).absolute()
        if not (p / CONFIG_FILENAME).exists():
            raise SnapdeckError(f"{p} has no {CONFIG_FILENAME}")
        return p
    cur = Path.cwd().absolute()  # NOT .resolve() — preserve symlinked worktree identity
    for d in [cur, *cur.parents]:
        if (d / CONFIG_FILENAME).exists():
            return d
    raise SnapdeckError(
        f"no {CONFIG_FILENAME} found in this directory or any parent.\n"
        f"Run `deck config init` to scaffold one, or pass --worktree <path>."
    )


def state_dir(worktree: Path) -> Path:
    """Per-worktree controller state (ports.json, logs, pid, events)."""
    return worktree / ".snapdeck"


def registry_dir(project_name: str) -> Path:
    """Cross-worktree registry, namespaced per project.

    e.g. (Linux) ~/.local/state/snapdeck/<project>/instances/
         (macOS) ~/Library/Application Support/snapdeck/<project>/instances/
    """
    return Path(platformdirs.user_state_dir("snapdeck")) / project_name / "instances"


def registry_root() -> Path:
    """The parent of all project registries (for cross-project enumeration)."""
    return Path(platformdirs.user_state_dir("snapdeck"))
