# Security Architect — findings handoff (w2-rectangle-tool)

**From:** security-architect → **For:** product-owner (PO incorporation) · **Date:** 2026-06-20
**Mode:** single-feature-review (BOSS-mode warm planning team)
**Highest severity:** INFO. **No HIGH/CRITICAL** → no PO arbitration required, no SendMessage escalation.
**`STORY-sec` minted:** none. **Stories blocked:** none.

## Verdict in one line

Clean INFO pass — the expected outcome for a localhost-only, no-network editor refactor whose only
real delta is adding numeric rectangle geometry to an already-existing user-annotation projection. No
new trust boundary is introduced. The one defensive change worth making (the finite/`≤0` projection
guard) is **already in-scope** on STORY-fe-002 (contrarian INFO#1, PO-promoted) — I endorse it; nothing
to add.

## STRIDE pass (epic surface = the 3 in-repo code surfaces + 2 sentinels)

Grounded 2026-06-20 against released code: `editor.js` `renderBox`/draw-preview/toolbar (300-430),
`editor-model.js` `projectAnnotations`/`deserializeModel` (whole file), `reports.py` `_render_markdown`/
`save_report`/`/report/save` payload assembler (`background.js:300-333`), and `manifest.json`
content-script world isolation.

- **S — Spoofing / cross-tenant:** N/A. No `externally_connectable` in the manifest (absent — confirmed),
  localhost-only `host_permissions`, no auth surface added, `/report/save` endpoint unchanged. Not
  multi-tenant. The rectangle is the user's own annotation.
- **T — Tampering:** LOW defense-in-depth, already covered. The editor `model` is built in the
  **isolated-world** `content_scripts[1]` entry (no `"world"` key; only `capture.js` is MAIN-world/
  page-reachable). A hostile page can't write the model or reach the message API. The malformed-box path
  is reachable only via the extension's own stored model / a future bug — neutralised on the projection
  side by fe-002's new finite/`≤0` guard.
- **R — Repudiation:** N/A. No entity table; `report.json` already records `git.branch`/`git.sha`/
  `created_at`. No audit-column surface to extend (no DB — db-001 sentinel).
- **I — Information disclosure:** INFO security-positive. The projection adds `{id,x,y,width,height}`
  numeric geometry — strictly narrower than the released `text` branch (a full user string) and `arrow`
  branch (coordinate pairs) already projected. No PII/token/credential/URL. Intended (rectangles ARE
  report annotations). No new disclosure class.
- **D — Denial of service:** No new path. fe-002's finite/`≤0` guard stops coerced garbage reaching
  `/report/save`; rectangle has no text → no auto-fit measurement loop (w1 slow-wrap axis N/A); projection
  is O(items) bounded by user gestures; the shared `render()` path is **not** forked, so RENDER_ITEM_CAP /
  render-boundary caps stay inherited (feature directive #7). NB: w1's "bounded re-open of arbitrary
  models" forward-flag is for **w2-screenshot-gallery**, not this feature — confirmed this feature builds
  no re-open UI.
- **E — Elevation of privilege:** N/A. No auth/permission/manifest/host-guard/endpoint change (do-001
  sentinel; no permission widening → no Chrome auto-update permission-disable triggered).

## The three team-lead-flagged questions — answered

1. **Info disclosure (projection→upstream):** Intended and adds no disclosure beyond existing arrow/text
   geometry. The rectangle carries numeric geometry + a uid only. ✅
2. **Injection (controller markdown render):** No new vector. The `_render_markdown` box branch renders
   only `Math.round`ed numeric fields (`id` is **not** rendered), and the Python f-string fills `{}`
   placeholders by `str()`-coercion — **not** format-spec injection (no `str.format`/`%` re-parse). The
   only arbitrary-string→`report.md` sink remains the **pre-existing, unchanged** `text` annotation
   (+ console/network). The rectangle does not widen it. Controller correctly trusts upstream (consistent
   with sibling text/arrow branches). ✅
3. **DoS / render-boundary:** A malformed hydrated box cannot produce an unbounded/garbage projection —
   fe-002's promoted finite/`≤0` guard mirrors `renderBox:324-325` and keeps render↔projection symmetric.
   The rectangle projection addition opens no new DoS path. ✅

## One forward note for PO awareness (pre-existing, OUT OF SCOPE — do not action here)

`report.md` is consumed downstream by the report→defects / AI-resolver pipeline, so it is effectively an
**LLM-prompt surface**. The arbitrary-string→`report.md` path (the `text` annotation, console output,
network URLs) is a pre-existing content-injection-adjacent surface that this feature **does not widen**
(rectangle = numeric-only, `id` unrendered). Recorded so it isn't lost — but it must **not** be addressed
inside the rectangle branch (wrong lever). If the project later wants to harden the AI-resolver prompt
surface, that is a separate, broader story against the `text`/console/network sinks. Not a finding
against w2-rectangle-tool; no `STORY-sec` minted.

## Default checklist — dispositions (recorded so PO sees it was applied, not skipped)

| Item | Disposition |
|---|---|
| Authn/authz on every endpoint | N/A — no endpoint added; `/report/save` unchanged |
| Input validation before DB/FS | Trust-upstream by design (matches siblings); projection guard added upstream (fe-002) |
| Secrets in env-bound config | N/A — no secrets touched |
| Audit columns on entity tables | N/A — no entity table (flat `report.json`/`report.md`; opaque `model`) |
| Soft-delete flag | N/A — no store/schema change (db-001 sentinel) |
| Rate limiting on public/auth-adjacent endpoints | N/A — no endpoint; localhost-only, single-user tool |
| No injection vectors | ✅ Confirmed — numeric-only render, no format-spec injection |
| CSRF on cookie-auth endpoints | N/A — no cookie auth, no endpoint change |
| CORS configuration | N/A — no endpoint/CORS change |
| Output encoding / no raw-HTML opt-out | ✅ Konva canvas render + textContent label — no `innerHTML` sink |
| Tenant isolation | N/A — not multi-tenant |
| Manifest/permission widening (Snapdeck-specific) | ✅ None — no new permission / `externally_connectable` |

## Where the detail lives

`## Security Review` blocks appended to all five stories: STORY-fe-001, STORY-fe-002, STORY-be-001
(injection detail), STORY-db-001, STORY-do-001.
