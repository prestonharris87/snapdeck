# Changelog

All notable changes to Snapdeck are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions use SemVer.

## [Unreleased]

### Added
- **Controller** (`deck`): generic, config-driven dev-server supervisor driven by
  `snapdeck.toml` — arbitrary services, pluggable ready-detection
  (`http_log`/`http`/`log_match`/`port_open`/`delay`), per-service env +
  launch-profile merge, post-start file patches, an exec catalog, and a
  cross-worktree registry. Probes a fresh port slot per worktree.
- `deck` CLI: `up`/`down`/`status`/`start`/`stop`/`restart`/`logs`/`exec*`/
  `catalog`/`ls`/`config init`. `--controller-port` pins a worktree's slot.
- `config init` detects the project stack (Angular/Next/Vite/Node, .NET, Django,
  docker-compose) and scaffolds a tailored config.
- **MCP server** (`deck-mcp`): spec-faithful stdio JSON-RPC with `read-only` and
  `full` profiles.
- **Chrome extension**: freeze-and-annotate editor (red arrows, text, undo/redo,
  synthetic cursor) on Konva; per-page console + failed-network capture via
  in-page hooks (no DevTools banner); saves a **user-test-report**
  (`report.json` + `report.md` + original/annotated PNGs) to the owning worktree,
  resolved automatically by browser port.
- Cross-platform: psutil backend for Windows (`snapdeck[windows]`); POSIX path
  unchanged on macOS/Linux.
- Configurable `[ports].orphan_signatures` for `--kill-orphan`.

### Notes
- Config is discovered at the worktree root or under `.claude/snapdeck.toml`.
- Reports dedupe repeated console/network entries (a spammy dev-warning collapses
  to one record with a count).

## [0.1.0]
- Initial extraction from the internal Elite dev-controller.
