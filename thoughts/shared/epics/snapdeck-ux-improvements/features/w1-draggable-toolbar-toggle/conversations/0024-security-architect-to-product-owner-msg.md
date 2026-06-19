---
from: security-architect
to: product-owner
feature: w1-draggable-toolbar-toggle
epic: snapdeck-ux-improvements
run_id: run-20260619-042600-10898
mode: single-feature-review
date: 2026-06-19
---

# Security Review handoff — w1-draggable-toolbar-toggle

STRIDE pass over all 6 approved stories. **No HIGH/CRITICAL findings; no PO
escalation (SendMessage) needed; no `STORY-sec-NNN` authored.** This is the
expected clean outcome for a local, no-network Chrome-extension editor-chrome
feature. `## Security Review` blocks were appended to **all 6** stories so the
default checklist is on the record as *applied, not skipped*.

## Findings by severity

| Severity | Count | Where |
|---|---|---|
| critical | 0 | — |
| high | 0 | — |
| medium | 0 | — |
| **low** | **1** | fe-001 (the trust boundary), echoed on fe-002 (the consumer) |
| info | 5 | fe-002 (DoS axis), fe-003, do-001, be-001, db-001 |

## The one real surface — LOW, guards confirmed adequate

**Untrusted `chrome.storage.local` toolbar position** (`snapdeckEditorToolbarPos`).
This is the only trust boundary in the feature. A corrupt/tampered/stale stored
value must not throw at `openEditor()`, strand the toolbar off-screen, or reach the
`bar.el.style.left/top` sink as a non-numeric (CSS-injectable) value. **All three
vectors are closed** by the fe-001 pure module:
- `parseStoredPos` → `null` (never throws) on null/garbage/non-finite. ✓
- `clampToViewport` → coerces non-finite to 0 per axis, clamps off-screen back into
  the viewport. ✓
- Style-injection closed **transitively**: `editor.js` has no `innerHTML` sink
  (verified at HEAD); the only style writes are numeric `…+"px"`, and the finite-number
  guard guarantees `left/top` are numbers — so no CSS string can round-trip in. ✓

**Why LOW, not higher:** `chrome.storage.local` is written/read in the **isolated**
content-script world (verified `manifest.json:34-43` — the `document_idle` entry has
no `"world"` key; only `capture.js` is `world: MAIN`). A web page cannot read or
write this key — the sole writer is the extension itself. So this is defense-in-depth
against the extension's own corruption / a future bug / devtools, not a page-reachable
attack. Mirrors the w0 fe-004 render-boundary robustness pattern and the lessons-file
rule that a first-party-source guard rates LOW. **Disposition: accept as adequate —
no story change.** One engineer guardrail recorded on fe-001/fe-002: keep the apply
path routed through `parseStoredPos → clampToViewport` (not a raw parse/direct apply),
and fall back to the CSS default-center when parse returns `null`.

## Default-checklist disposition (recorded on fe-001 + the sentinels)

Walked the full checklist; nearly all items N/A for this surface, each recorded
explicitly:
- **Authn/authz, CSRF, CORS, rate-limiting:** N/A — no HTTP/server surface (be-001
  sentinel). The localhost host-guard in `addScreenshot()` is untouched.
- **Input validation:** the one untrusted input is guarded — see above. ✓
- **Injection / parameterization:** N/A — no DB query (db-001 sentinel; project has
  no server-side DB).
- **Output encoding / XSS:** N/A — no `innerHTML` sink; new chrome is a CSS-painted
  grip (fe-002) + plain-text `Hide`/`Show` button (fe-003). ✓
- **Secrets:** none introduced.
- **Audit columns / soft-delete / multi-tenant:** N/A — no server entity table, no
  tenancy (db-001).
- **Permission widening:** none — `storage` already granted; do-001 adds exactly one
  isolated-world `js`-array element, no new permission / `host_permissions` /
  `commands` / `externally_connectable`.

## Per-story blocks appended

- **STORY-fe-001** — LOW (the trust-boundary disposition lives here) + feature-level
  STRIDE checklist disposition.
- **STORY-fe-002** — LOW (consumer applies the guards on the live path; style sink
  type-safe) + INFO (drag-end persistence is bounded; DoS axis N/A).
- **STORY-fe-003** — INFO (pure local view state, no trust boundary; XSS N/A).
- **STORY-do-001** — INFO (manifest edit widens no privilege; isolated-world
  registration adds no surface).
- **STORY-be-001** — INFO (empty backend diff ⇒ server-side checklist N/A).
- **STORY-db-001** — INFO (no entity table ⇒ audit/tenancy/injection N/A; single
  fixed key ⇒ no unbounded growth).

## For PO security-finalize

Nothing to arbitrate — no accept/mitigate/defer decision is owed (no MEDIUM+). The
single LOW is already specified-and-tested in fe-001; treat as accepted. No
cross-feature recommendation beyond the existing `buildToolbar()` serialization seam
with `w1-text-box-autofit` already surfaced by the PO/contrarian (that is a
merge-ordering concern, not a security one).
