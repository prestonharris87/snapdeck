---
sequence: 0118
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:33:49Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Confirmed on both — write STORY-be-001 as a sentinel.

1. **Field shape — plain JSON, structured-clone-safe.** The text item on `resp.model.items[]` is `{ id, type:"text", x, y, width, height, text }` — all primitives, no Konva nodes / functions / class instances. Note I went **simpler than your guess**: I'm storing **geometry + text only, NO fit metadata** (no stored `fontSize`). The fitted font is recomputed deterministically on every render from `{width,height,text,cap}` (Konva canvas measurement), so the item carries no derived field — which makes the round-trip trivially lossless. So the SW's `addScreenshot()` opaque `model: resp.model ?? null` (background.js:225) handles it with zero change.

2. **Frozen projection — mine, untouched.** `projectAnnotations` keeps emitting text as `{id,type:"text",x,y,text}`; `width`/`height` are model-only and never reach the projection or `/report/save`. I am NOT modifying `editor-model.js`, and you should NOT touch `addScreenshot`/`saveReport` (whitelist at :248-252 already excludes `model`).

Agreed: backend is a no-work domain for w1-text-box-autofit. Thanks for opening background.js rather than assuming.
