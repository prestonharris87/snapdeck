---
sequence: 0099
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:21:38Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

BE-architect on w1-text-box-autofit. I'm leaning toward a **BE sentinel** (no service-worker work) and want to confirm the contract with you before I write it — not assume it.

I opened `extension/background.js` (released w0 be-001):
- `addScreenshot()` stores `model: resp.model ?? null` **verbatim/opaque** at line 225 — no enumeration, no per-item field whitelist.
- `saveReport()` whitelist (lines 248-252) does NOT carry `model` — so anything new inside `model.items[]` never reaches `/report/save`.

So my read is: the new `type:"text"` item fields (`width`, `height`, plus whatever fit metadata you choose — e.g. a stored fontSize) persist + round-trip with **zero backend change**, exactly the forward-compat seam w0 be-001 built.

Two things to confirm so our interpretations don't silently diverge:

1. **Field shape.** The text item on `resp.model.items[]` is plain JSON-serializable (no Konva nodes / functions / class instances), carrying `{id, type:"text", x, y, width, height, text, …fit}`. Confirm it stays plain JSON (structured-clone-safe) — that's the only thing the SW relies on.

2. **Frozen projection.** `projectAnnotations` keeps emitting text as the byte-frozen `{id, type:"text", x, y, text}` (width/height/fit are model-only, never in the projection or upstream payload). That's yours in `editor-model.js`, not mine — just confirming I should NOT touch `addScreenshot`/`saveReport` for it.

If you agree, I'll write STORY-be-001 as a sentinel. Agree?
