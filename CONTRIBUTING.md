# Contributing to Snapdeck

Thanks for your interest! Snapdeck is two coupled pieces — a Python dev-server
controller (`deck` + `deck-mcp`) and a Chrome extension — in one repo.

## Layout

```
controller/snapdeck_controller/   the `deck` CLI + controller engine
  ├── cli.py        argparse CLI (up/down/status/start/stop/…/config init)
  ├── server.py     HTTP API + foreground run loop
  ├── core.py       supervision engine (state, ready-detection, exec, lifecycle)
  ├── procutil.py   process/port utils (POSIX + psutil/Windows backends)
  ├── config.py     snapdeck.toml loader + port templating
  ├── reports.py    /report/save + /resolve (user-test-reports)
  └── paths.py      worktree resolution
mcp/snapdeck_mcp/server.py        deck-mcp stdio server (read-only/full profiles)
extension/                        Snapdeck for Chrome (MV3)
examples/snapdeck.toml            sample project config
```

## Dev setup

```sh
# editable install into a venv
uv venv .venv && uv pip install -e '.[dev]'
.venv/bin/deck --help

# …or put deck/deck-mcp on your PATH (pipx-style)
uv tool install --editable .
```

Try it against a throwaway project:

```sh
mkdir /tmp/demo && cd /tmp/demo && deck config init   # scaffolds snapdeck.toml
# edit the start command/port, then:
deck up
```

## Checks before a PR

```sh
python -m py_compile controller/snapdeck_controller/*.py mcp/snapdeck_mcp/*.py
ruff check .
node --check extension/background.js   # (and the other extension JS)
```

There isn't a formal test suite yet — manual verification against a real project
plus the compile/lint checks above. Tests welcome.

## Platform note (important)

`procutil.py` has two backends. **macOS/Linux use the POSIX path** (`lsof` /
`pgrep` / `killpg`) — this is the battle-tested logic; **leave it unchanged**.
**Windows uses `psutil`** (the `snapdeck[windows]` extra). When you touch a
process/port helper, mirror the behavior in *both* branches and keep the POSIX
branch byte-identical.

## Conventions

- Conventional-commit messages (`feat:`, `fix:`, `refactor:`, `docs:`…).
- Small, focused diffs. Match the surrounding style.
- A project's own `snapdeck.toml` is **gitignored** here — never commit one into
  this repo. See [SECURITY.md](SECURITY.md).

By contributing you agree your work is licensed under the repository's MIT license.
