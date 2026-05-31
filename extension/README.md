# Snapdeck for Chrome

Freeze your local dev app, annotate it (red arrows + text), capture screenshots,
and file a **user-test-report** into the right worktree — resolved automatically
by asking the Snapdeck controller which worktree owns the port you're browsing.

## Load it (development)

1. Make sure a controller is running for your project: `deck up` (or `deck up --daemon`).
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this `extension/` directory.
4. Pin the Snapdeck icon; open your dev app on `localhost` / `127.0.0.1`.

## Use it

- **＋ Add screenshot** — freezes the page on a captured frame. Then:
  - **Arrow** — drag to draw a red arrow; in **Select**, drag the body or either
    endpoint to adjust.
  - **Text** — click to drop a comment; click into it to edit, drag to move.
  - **Undo / Redo**, **Delete** (select a shape + Delete), **Done** / **Cancel**.
  - A synthetic cursor is drawn where your mouse was, so the report shows what you
    were pointing at.
- Repeat **Add screenshot** across as many pages/screens as you like — they all
  accumulate into one report.
- Add an optional **report note**, then **✓ Save report**.
- **Clear** discards the in-progress report.

The report lands at `<worktree>/thoughts/shared/user-test-reports/<id>/` with
`report.json`, `report.md`, and original + annotated PNGs. Each screenshot also
carries the page URL/title/viewport plus any **console errors** and **failed
network requests** observed on that page (captured via lightweight in-page hooks —
no DevTools "is being debugged" banner).

## What it captures, and why these permissions

| Permission | Why |
|---|---|
| `activeTab`, `tabs` | capture the visible tab on your click |
| `scripting`, content scripts on `localhost`/`127.0.0.1` | inject the annotate overlay; hook console/network |
| `storage`, `unlimitedStorage` | hold the in-progress report (screenshots) in IndexedDB |
| host access to `localhost`/`127.0.0.1` | POST the report to your local controller |

Snapdeck only activates on `localhost` / `127.0.0.1`. It never talks to any remote
server — only your local controller.

## Note on console/network capture

Capture uses in-page hooks (wrapping `console.error`/`warn`, `fetch`, `XHR`, and
`window.onerror`/`unhandledrejection`) injected into the page's main world. This
avoids the session-long Chrome "is being debugged by Snapdeck" banner that the
DevTools-protocol approach would show, at the cost of missing a small class of
browser-level events (e.g. CSP violations). This was a deliberate trade for a
tool you keep loaded while testing.
