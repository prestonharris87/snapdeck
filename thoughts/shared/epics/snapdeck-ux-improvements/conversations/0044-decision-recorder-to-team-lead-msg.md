---
sequence: 0044
from: decision-recorder
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:40:33Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

Decision memo written at:

`thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/decision-memo-v1.md`

**3-line summary:**
1. **6 tensions resolved**, all cited: box-subtype (generic `box`, not text migration → STORY-fe-001 §Decision), HYBRID test ruling (conv 0016), pure-module extraction driving DO sentinel→real story (conv 0019 + STORY-fe-005), DAG edge gaps (conv 0035), BE test filename collision saga (convs 0023–0026, final: `background.editormodel.test.mjs`), and annotated-PNG gate widening to `model.length` (STORY-fe-003).
2. **2 accepted risks**: cross-viewport geometry drift on re-open (STORY-fe-004, deferred) and three-way `background.js` push-window merge hazard (BOSS sequences; STORY-be-001 §Cross-domain contract).
3. **5 alternatives rejected**: text→box migration (projection drift), per-tool transformers (STORY-fe-002), ESM module syntax (content-script parse limit, STORY-fe-005), `module.exports` refactor of background.js (regression risk, STORY-be-001), and `model` in `/report/save` (upstream byte-freeze, feature.md).

Note: security architect findings for this feature are not captured in a discrete conversation file — conv 0039 contains security-finalize language for w0-per-target-reports (portOfUrl/localStorage findings), not editor-foundation. Conv 0040 (PO) confirms no HIGH/CRITICAL findings and no `STORY-sec-*` for editor-foundation.
