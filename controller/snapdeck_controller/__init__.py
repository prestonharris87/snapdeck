"""Snapdeck — per-worktree dev-server controller (generic engine).

The engine ships empty of project knowledge. A consuming project supplies a
``snapdeck.toml`` at its repo root describing its services; the controller
supervises them, exposes a localhost HTTP API, and registers itself in a
cross-worktree registry so siblings (and the Chrome extension) can find it.
"""

__version__ = "0.1.0"


class SnapdeckError(Exception):
    """User-facing configuration / environment error (printed without a traceback)."""
