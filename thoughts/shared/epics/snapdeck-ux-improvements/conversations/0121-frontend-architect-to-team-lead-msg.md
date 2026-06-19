---
sequence: 0121
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:36:12Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**FE decompose complete — w1-text-box-autofit.** 3 stories in `…/features/w1-text-box-autofit/stories/`, all `status: pending`, all `frontend_lane: N/A`, `visual_references: []` (skip_ui_designer):

- **STORY-fe-001** (effort 2, depends []): Drag-to-draw text-box tool — replace click-to-place with drag-to-create capturing `{x,y,width,height}`; text item becomes `{id,type:"text",x,y,width,height,text}`; box-aware textarea authoring + empty-removal; Text-button title copy; **+ new pure node test `extension/editor.textbox.test.mjs`** (projection-strips-geometry + round-trip identity, imports the UNMODIFIED `editor-model.js`). Generalizes the box-shaped draw so w2-rectangle reuses it.
- **STORY-fe-002** (effort 3, depends [fe-001]): Auto-fit wrap render + visual — rewrite `renderText` to a `Konva.Group` (white fill / red `#e53935` outline / black wrapped text), bounded **auto-fit helper** (`TEXT_AUTOFIT_MAX/MIN`), and extends the w0 fe-004 render-boundary guard into the auto-fit path (skip non-finite/wrong-type geometry, `RENDER_TEXT_CAP`, bounded loop — no throw/hang).
- **STORY-fe-003** (effort 2, depends [fe-001, fe-002]): Select/move/resize via the **reused** `attachBoxTransformer` (no parallel transformer) + automatic re-fit on resize (recompute-on-render) + double-click re-edit / single-click select + through-the-editor lossless round-trip.

**Key architect decisions** (recorded as 3 auto-resolved entries in `clarifications.md`): (1) **recompute fit on render**, store geometry+text only → trivially lossless round-trip, free resize re-fit; (2) **auto-fit stays inline in editor.js** — it's Konva-canvas-measurement-dependent so a "pure" module would be a fake abstraction forcing a needless manifest entry → **no new browser module, no manifest change**; (3) hybrid test lane (Konva behavior → `bt` Playwright E2E `extension/e2e/w1-text-box-autofit.spec.ts`; pure invariants → node --test).

**Hard constraints honored:** `editor-model.js`/`projectAnnotations` untouched (no per-item validation added); lossy text projection byte-frozen `{id,type:"text",x,y,text}`; `attachBoxTransformer` reused as-is; render-boundary robustness extended into auto-fit; box-shape draw+select/resize factored for w2 reuse. Every substantive story has a `## Existing behavior baseline` (file:line citations, Verified: 2026-06-19).

**Peer messages sent: 5** (+ replies). Topics: (a) **backend-architect** — text item stays plain-JSON/structured-clone-safe + projection frozen → **BE confirmed STORY-be-001 sentinel** (msg 0099, I confirmed back); (b) **database-architect** — opaque IndexedDB record needs no store/index/version change (awaiting reply for my feature); (c) **devops-architect** — no manifest change (auto-fit inline) (awaiting reply for my feature). I also replied to two cross-feature inbounds addressed to "frontend-architect" about **w1-dynamic-icon-badge** (DB msg 0097 port-cache boundary — concurred; DO msg 0098 icon PNG-vs-programmatic — concurred Option B with a scope caveat to have that feature's owner ratify).

**Cross-domain dependencies introduced: none** — all 3 stories are FE-only on the RELEASED w0 contracts. backend = no-work (confirmed); database + devops = no-work (my independently-verified read: manifest already registers `editor.js` lines 39-44, IndexedDB stores `model` opaquely via w0 be-001) — their explicit replies for this feature are still pending but expected to be sentinels.

**Open question:** none blocking. Only the DB/DO no-work confirmations for w1-text-box-autofit are outstanding; if either surprises with actual work it's PO-arbitration territory, but I'm high-confidence they sentinel. Going idle now (not requesting shutdown).
