# Security & secret hygiene

## The tool is secret-free by design

Snapdeck ships **empty of project knowledge**. All project-specific commands,
paths, ports, and any secrets live in a per-project `snapdeck.toml` that stays in
the consuming repo — never in this one. The repo's `.gitignore` excludes a
top-level `/snapdeck.toml` precisely so a real project config can't be committed
here by accident.

If you're authoring a `snapdeck.toml` for your project:

- **Don't put secrets in it.** Reference environment variables instead
  (e.g. `cmd = "… -P \"$DB_PASSWORD\" …"`), and provide those vars in the
  controller's environment — exec/start commands inherit `os.environ`.
- Treat the file as committed-to-your-project config: assume teammates and CI
  will read it.

## Network surface

- The controller binds **`127.0.0.1` only** — never a public interface.
- The Chrome extension talks **only to `localhost` / `127.0.0.1`** controllers and
  activates only on those origins. It never contacts any remote server.
- The controller sends permissive CORS headers so the local extension can reach
  it; this is intentional and scoped to localhost.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository (Security →
Report a vulnerability) rather than a public issue.
