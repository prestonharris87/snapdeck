---
from: security-architect
to: team-lead
cc: product-owner
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
date: 2026-06-19
type: security-review-handoff
mode: single-feature-review
highest_severity: LOW
po_ping_required: false
story_sec_authored: false
---

# Security Review handoff — w0-editor-foundation

STRIDE pass over all 8 stories of the annotation-editor foundation (box primitive + lossless
`model` persistence + shared `Konva.Transformer`). **This is a local, no-network, no-new-permission
editor refactor — the review is clean.** Highest severity: **LOW** (one defense-in-depth item, not
exploitable today, does not gate w0). No HIGH/CRITICAL, so **PO was not pinged** mid-review; all
findings are below for Phase 7.5 disposition. **No STORY-sec authored** (the one LOW is an AC tweak to
an existing story, not a new defensive story).

## What I verified against real code (not just the stories)

- **No `externally_connectable` in `extension/manifest.json`** → web pages cannot reach the extension's
  message API at all. The ANNOTATE `model` payload only arrives from the extension's own background
  worker (same-extension origin, Chrome-enforced). → **Spoofing of `model` is N/A.**
- **`editor-model.js` registers in the isolated-world entry** (the `document_idle` one), NOT the
  MAIN-world `capture.js` entry → `__snapdeckEditorModel` is unreachable from page JS; no new
  permission/host/`web_accessible_resources`. → **No expanded attack surface (do-001).**
- **Text renders via `Konva.Text` (canvas)** + textarea `.value` editing (`editor.js:111-128`), never
  `innerHTML` → **no DOM-XSS vector** even for a hostile `text` item.
- **localhost-only guard unchanged** — `host_permissions` + both `content_scripts.matches` stay
  `http://localhost/*` + `http://127.0.0.1/*`; `background.js:112` URL guard untouched.
- **`model` excluded from `/report/save`** — enforced on the producer side (fe-003) and consumer side
  (be-001), locked by an exact 9-field upstream key-set assertion. Nothing new leaves the machine.

## Findings (severity-first)

### LOW — STORY-fe-004 · Tampering/DoS, defense-in-depth (deserialization trust)
`deserializeModel` guards the **envelope** (`version===1 && Array.isArray(items)`) but passes **items
opaquely** — correct for w1/w2 forward-compat, but it means a structurally-valid payload with hostile
*item* fields (`NaN`/`Infinity`/`1e308`/wrong-typed geometry, huge `text`, thousands of items) flows
into Konva at the render boundary (`editor.js:74-81`) with no clamp/type-check/count bound. The
existing "guard tolerance" AC only covers **envelope** failures. **Non-exploitable in w0** (source is
the extension's own IndexedDB, not page-writable; single-user local tool) — flagged because
**w2-screenshot-gallery** will re-open arbitrary *stored* models through this exact path.
**Recommendation:** add a render-boundary AC (skip/coerce bad items at `render()`/`renderBox`), and do
**NOT** tighten `deserializeModel` (that would break the opaque contract). **PO disposition options:**
(a) accept-risk now + carry the AC into w2-screenshot-gallery, or (b) add the ~5-line render guard now.

### INFO findings (FYI — no action required to ship w0)
- **STORY-fe-005** — deserialize envelope guard scope is correct; opaque item pass-through is the
  ratified forward-compat contract — do NOT add per-item validation here. Suggest a code comment noting
  the intentional "envelope here / item-sanity at render layer" split so a future maintainer doesn't
  "harden" it and break the contract. Pure side-effect-free module → no new surface.
- **STORY-do-001** — isolated-world registration, no permission/host/`web_accessible_resources`/
  `externally_connectable`/`commands` delta; localhost guard intact. The "exactly one added array
  element" diff check is the right gate.
- **STORY-be-001** — `model` correctly local-only (excluded from `/report/save`, exact 9-field key-set
  lock); stored verbatim/opaque; no new guard relaxed; no NEW class of data persisted (text was already
  in `annotations`). Unbounded opaque value under `unlimitedStorage` noted as accept-risk INFO (item
  count is human-bounded in w0) — no STORY-sec warranted.
- **STORY-fe-003** — producer-side byte-freeze + upstream `model` exclusion verified; assertion-grade
  E2E locks the resolve-key delta to exactly `model`. No new boundary.
- **STORY-fe-001** — pure additive box draw tool; sub-threshold reject guard; canvas render; plain-text
  label (no markup). Clean.
- **STORY-fe-002** — shared transformer; `transformend` clamps `Math.max(1, …)` (good render-boundary
  sanity on the resize side). Clean.
- **STORY-db-001** — sentinel (no DB work; pruned at Phase 8.5). No entity table added → the
  audit-columns checklist item is **N/A** for this feature. No Security Review block appended (it would
  be lost at prune); captured here instead.

## Default-checklist disposition for this feature
- Authn/authz on endpoints — **N/A** (no HTTP endpoints; same-extension messaging, no
  `externally_connectable`; loopback-only controller unchanged).
- Input validation — envelope-validated (fe-005); item-level render robustness = the LOW above.
- Secrets / hardcoded creds — none added.
- Audit columns — **N/A** (no server entity table; client-side ephemeral store).
- Soft-delete — N/A (no delete path in this feature).
- Rate limiting / CSRF / CORS — **N/A** (no network endpoint added; no cookie-auth surface).
- Injection / parameterized queries — **N/A** (no DB/query surface; structured-clone value only).
- Output encoding / XSS — **clean** (canvas render, no `innerHTML`).
- Tenant isolation — **N/A** (single-user local tool, not multi-tenant).

**Bottom line for PO (Phase 7.5):** disposition the one LOW (fe-004 render-boundary robustness) — accept
now or add the small guard; everything else is INFO/FYI. No delivery gate from security on w0.
