"""Snapdeck MCP server — exposes the dev-server controller to AI coding agents.

Two permission profiles, selected with ``--profile``:
  read-only  status, logs, exec catalog/jobs, list-worktrees
  full       read-only + start/stop/restart services and run exec commands

Per-agent gating is achieved by giving an agent the appropriate profile via its
``mcpServers`` frontmatter — the model literally cannot see tools the profile
does not advertise.
"""

__version__ = "0.1.0"
