# Snapdeck protocol

The contract shared by the three faces of Snapdeck (CLI, MCP server, Chrome
extension) over the controller's localhost HTTP API.

## Controller HTTP API

Each worktree's controller binds `127.0.0.1:<controller_port>` (probed from the
`[ports].controller` base, bumped by `step` per worktree). The resolved port is
written to `<worktree>/.snapdeck/ports.json`.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/status` | Lifecycle snapshot: per-service state/ready/ports + controller info |
| POST | `/start/<svc\|all>` | Start a service (blocks until ready or soft-timeout) |
| POST | `/stop/<svc\|all>` | SIGTERM → 5s grace → SIGKILL, frees the port |
| POST | `/restart/<svc\|all>` | Stop then start; re-probes the preferred port |
| GET  | `/logs/<svc>?n=&grep=&context=&path=&full` | Per-service log tail |
| GET  | `/exec/catalog` | Whitelisted exec commands (no `cmd` field) |
| POST | `/exec/<name>?confirm=0\|1` | Run a catalog command async → `{job_id}` |
| GET  | `/exec/job/<id>` / `/exec/job/<id>/log` | Job state / captured output |
| GET  | `/exec/jobs?limit=N` | Recent jobs |
| GET  | `/resolve?port=<n>` | **Which worktree's browsable service owns this port?** |
| POST | `/report/save` | Persist a user-test-report (Phase 2) |
| POST | `/shutdown` | Graceful controller shutdown |

All routes accept `?actor=<name>` for event-log attribution and send permissive
CORS headers so the browser extension can call them.

## Cross-worktree registry

Each controller writes `<user_state_dir>/snapdeck/<project>/instances/<slug>.json`:

```json
{
  "project": "elite",
  "worktree": "/abs/path/to/worktree",
  "controller_port": 7787,
  "ports": { "frontend": {"http": 4210}, "backend": {"https": 44390, "http": 63779} },
  "browsable": "frontend",
  "browsable_ports": [4210],
  "user_test_reports_dir": "/abs/path/.../thoughts/shared/user-test-reports",
  "pid": 12345,
  "started_at": "2026-05-31T20:00:00+00:00"
}
```

Any live controller can answer `/resolve` from this shared registry, so the
extension only needs to find *one* controller (probe the controller-port range)
to discover the worktree owning the browser port.

## MCP server (`deck-mcp`)

Newline-delimited JSON-RPC 2.0 over stdio (`initialize`, `tools/list`,
`tools/call`). Two profiles select the advertised tool set:

| Profile | Tools |
|---|---|
| `read-only` | `status`, `logs`, `exec_catalog`, `exec_job`, `exec_jobs`, `list_worktrees` |
| `full` | read-only **+** `start_service`, `stop_service`, `restart_service`, `exec_run` |

Tools omitted from a profile are also refused if called directly (defense in
depth). Control tools lazily boot the controller (`--no-autostart`) if none is
running; read tools report "not running" rather than booting the stack.

## User-test-report bundle (Phase 2)

`POST /report/save` writes `<reports_dir>/<report-id>/`:

```
<report-id>/
  report.json          # canonical machine artifact (consumed by a future "report → defects" skill)
  report.md            # human-readable mirror
  screenshots/01-original.png  01-annotated.png  ...
```

`report.json` is a raw, multi-page evidence bundle — **not** a single defect. See
the field shape in the implementation plan; a single report may yield many
defects, decided later by a separate skill.
