---
type: conversation
from: security-architect
to: product-owner
feature: w0-keyboard-shortcuts
epic: snapdeck-ux-improvements
mode: single-feature-review
phase: 7
created_at: 2026-06-18T00:00:00Z
escalated: false
---

# Security review handoff — w0-keyboard-shortcuts

STRIDE pass over the only substantive story (`STORY-be-001` — MV3 `commands`
block + top-level `chrome.commands.onCommand` listener → unchanged zero-arg
`addScreenshot()` + action-badge result signal).

## Bottom line

**No HIGH/CRITICAL findings. Nothing escalated. No defensive STORY-sec authored.**
This is a low-risk, least-privilege, caller-only change and is clear to proceed.
All findings are info/low FYIs — none block delivery.

## Findings by severity

| Sev | ID | Summary | Action |
|---|---|---|---|
| low | LOW-1 | Rapid re-press stacks overlapping `addScreenshot()` runs → multiple overlays + aggravates the non-atomic report read-modify-write race (the race itself is out-of-scope, owned by `w0-per-target-reports`; the shortcut just lowers the friction to hit it). | Recommendation folded into story "How we're doing it": add a ~4-line in-flight boolean guard in the new `runCaptureCommand()` wrapper. No new story; stays within this story's new code. |
| info | INFO-2 | `runCaptureCommand()` should `try/catch` the `addScreenshot()` call so a *thrown* (vs returned) error also fires the error badge and doesn't become a silent unhandled rejection — defense-in-depth on the AC6/AC7 non-silence requirement. | Recommendation in Security Review block. |
| info | INFO-1 | Badge tooltip (`setTitle`) echoes `addScreenshot()` error strings — confirmed **safe** (static / Chrome `e.message` text, native non-HTML tooltip, local-only). Recorded so it isn't re-flagged later. | None. |
| info | INFO-3 | Positive: least-privilege design affirmed — no new manifest permission (badge over `notifications`), focus-only (not `"global": true`), localhost-only `host_permissions` unchanged, guard reused. Cannot be weaponized to screenshot a non-localhost page. | Keep as-is; do not add `notifications` or widen host scope in implementation. |

## Default-checklist disposition

- Authn/authz: N/A network surface; intrinsic localhost host-guard
  (`background.js:112`) present and unchanged. ✓
- Input validation: `command` arg is a Chrome-supplied enum compared to the exact
  string `"capture-screenshot"`; no user input reaches a query/filesystem. ✓
- Secrets: none introduced. ✓
- Audit columns: N/A — no new entity table (caller-only). ✓
- Soft-delete: N/A. ✓
- Rate limiting: N/A (no public/remote endpoint); local rapid-fire covered by LOW-1.
- Injection: no queries; badge value rendered by Chrome native API, not a DOM/HTML
  sink. ✓
- CSRF/CORS: N/A — `commands` is not web-reachable; no cookies, no HTTP endpoint. ✓
- XSS/output encoding: badge text/tooltip go through `setBadgeText`/`setTitle`, not
  `innerHTML`; overlay/content scripts unchanged & out of scope. ✓
- Tenant isolation: N/A — single-user local extension. ✓

## Project-specific gotchas — all clear

- No local-dev hardcoded-credential path touched.
- No env/config flag that switches an auth path.
- No new endpoint joining any unauthenticated/public tier — the new `commands`
  keybinding grants no host/data access; it's a keybinding only.

## PO action requested

None required. LOW-1 and INFO-2 are implementation recommendations the
backend-engineer can absorb directly (both live in this story's new code); they do
not change scope or acceptance criteria. Surfaced here only for visibility.
