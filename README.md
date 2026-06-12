# Snapdeck

**Run your project's dev services across worktrees, then annotate and file
user-test-reports straight from the browser.**

Snapdeck is two coupled tools in one package:

1. **A per-worktree dev-server controller** (`deck`) — a process supervisor that
   starts your project's services (frontend, backend, database, workers,
   anything), exposes a localhost HTTP API, probes a fresh port slot per
   worktree so siblings never collide, and keeps a cross-worktree registry of
   what's running where.
2. **A Chrome extension** ("Snapdeck for Chrome") — freeze the page, draw red
   arrows, drop text comments, capture screenshots, and save it all as a
   **user-test-report** into the right worktree. The extension finds the
   worktree automatically by asking the controller which one owns the port
   you're browsing.

The controller ships **empty of project knowledge**. Each project supplies a
committed `snapdeck.toml` describing its services. That's what makes Snapdeck
generic — point it at any repo.

## Install

```sh
pipx install snapdeck          # gives you `deck` and `deck-mcp` on PATH
deck config init               # scaffold a snapdeck.toml in the current repo
```

Then load the Chrome extension (unpacked from `extension/` during development;
Chrome Web Store listing is planned).

## Configure a project

Drop a `snapdeck.toml` at your repo root (see [`examples/snapdeck.toml`](examples/snapdeck.toml)):

```toml
[project]
name = "myapp"

[ports]
controller = 7777
step = 10

[services.backend]
cwd = "server"
start = "npm run dev -- --port {port.http}"
[services.backend.ports]
http = 4000
[services.backend.ready]
kind = "http_log"
http_url = "http://localhost:{port.http}/health"
log_pattern = "listening on"

[services.frontend]
cwd = "web"
start = "npm run dev -- --port {port.http}"
depends_on = ["backend"]
browsable = true               # the app you test in the browser
[services.frontend.ports]
http = 3000
[services.frontend.ready]
kind = "http_log"
http_url = "http://localhost:{port.http}"
log_pattern = "ready in|Local:"
```

### Provisioning steps (oneshots)

A service marked `oneshot = true` runs its `start` command **to completion**
instead of staying alive — ready means *exit 0* (the `exit_zero` ready kind,
the default for oneshots). Other services can `depends_on` it, so it's the
natural way to gate your stack on provisioning: restore a database, run
migrations, seed fixtures, generate code. Oneshots don't need to declare ports.

```toml
[services.db_provision]
oneshot = true
start = "./scripts/restore-db.sh"
startup_timeout_s = 300            # hard cap on the provisioning run

[services.backend]
depends_on = ["db_provision"]      # waits for exit 0 before starting
# ...
```

`deck status` shows a finished oneshot as `DONE`; a non-zero exit fails the
startup wave with the exit code in the event log.

### Computed env (`env_from_command`)

Any service can declare `env_from_command` — a command run from the worktree
root whose **JSON-object stdout** is merged into the service's environment at
spawn, overriding ambient/shared values. Use it for values that must be
computed per worktree rather than written into the config, e.g. giving each
worktree its own database:

```toml
[services.backend]
env_from_command = "./scripts/db-identity.sh"   # prints {"DATABASE_URL": "..."}
# ...
```

If the command fails, times out (30s), or prints invalid JSON, the spawn
**fails loudly** (`env-failed` in the event log) — the service never launches
with missing env.

## Use it

```sh
deck up                 # foreground supervisor (Ctrl-C / `q` to stop)
deck up --daemon        # detached
deck status             # what's running, on which ports
deck restart frontend   # per-service control
deck logs backend --grep ERROR --context 3
deck exec build         # run a whitelisted maintenance command
deck ls                 # every live controller for this project (all worktrees)
deck down               # graceful shutdown
```

Each worktree runs its **own** controller. The first uses the base ports
(`:7777` / your service defaults); each sibling worktree bumps by `step`, so you
can run several worktrees at once without conflict.

## How it fits together

```
  Chrome extension ──HTTP /report/save──┐
  deck-mcp (agents) ──stdio─────────────┤──►  controller HTTP API ──► supervises
  deck CLI (humans) ─────────────────────┘     (per worktree)          your services
```

- **MCP server** (`deck-mcp`) exposes the controller to AI coding agents with
  `read-only` and `full` permission profiles, so e.g. a frontend agent can read
  build logs but not restart the server. See [`mcp/`](mcp/).
- **Cross-worktree registry** lets `deck ls` and the extension resolve
  *port → worktree* without any per-worktree wiring.

See [`PROTOCOL.md`](PROTOCOL.md) for the HTTP API and report format.

## Platform support

macOS and Linux today (POSIX process management). Windows support is planned via
`psutil`. Requires Python ≥ 3.11.

## Contributing & security

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — dev setup, layout, the POSIX/psutil rule.
- [`SECURITY.md`](SECURITY.md) — secret hygiene (the tool is secret-free; a project's
  `snapdeck.toml` is gitignored here) and the localhost-only network surface.
- [`CHANGELOG.md`](CHANGELOG.md) — what's changed.

## License

MIT — see [`LICENSE`](LICENSE).
