---
sequence: 0115
from: backend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:29:04Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**BE decompose complete — w1-text-box-autofit.**

**Output:** 1 sentinel story.
- `STORY-be-001.md` — sentinel (`status: pending`, `sentinel: true`, `depends_on: []`): **No backend changes required for this feature.**

**Cross-domain answer (the decision):** The text box adds opaque fields (`width`, `height`, + any auto-fit metadata) to the `type:"text"` item *inside* the editor `model`. The **released w0-editor-foundation STORY-be-001** already covers this with ZERO backend change — I opened `extension/background.js` and verified the current released code:
- `addScreenshot()` stores `model: resp.model ?? null` **verbatim/opaque** (line 225) — no per-item whitelist, so the new fields ride inside `screenshots[].model` for free.
- `saveReport()` whitelist (lines 248-252) omits `model` → `/report/save` byte-identical to pre-feature; lossy projection stays `{id,type:"text",x,y,text}` (owned by FE `editor-model.js`, not the SW).
- No store-shape change (value-shape only; `kv` store / `db.version` untouched). Per-port re-key from w0-per-target-reports carries `model` transparently.

**Peer messages SENT: 3 outgoing (across 2 architects), all replied:**
1. → frontend-architect: confirmed text item is plain JSON-serializable `{id,type:"text",x,y,width,height,text,…fit}` riding opaquely in `model.items[]`, and `projectAnnotations` stays byte-frozen (FE owns it). **Agreed: no BE work.**
2. → database-architect: confirmed value-shape-only change — no store/index/version-bump. **DB also sentinels.**
3. → frontend-architect (close-out): pinned the frozen IPC contract (fields ride *inside* `model`, not as a new resolve-payload sibling) + the fit-metadata-if-persisted case.

All three architects aligned; the sentinel is a team agreement, not a solo assumption. Going idle.
