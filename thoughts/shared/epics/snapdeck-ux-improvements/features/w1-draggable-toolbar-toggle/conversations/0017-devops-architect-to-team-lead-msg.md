---
sequence: 0017
from: devops-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:23:08Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-draggable-toolbar-toggle
---

**Determination: SUBSTANTIVE (non-sentinel)** — one DO story written.

**STORY-do-001** — "Register editor-chrome.js content script in manifest"
- Registers the NEW content-script file `extension/content/editor-chrome.js` (FE's pure dual-consumable module: clampToViewport + toolbar-pos serialize/guard + visibility-state helpers) in `manifest.json` content_scripts[1].js — the document_idle isolated-world entry — ordered `editor-model.js → editor-chrome.js → editor.js`.
- `depends_on: [STORY-fe-001]` (registered path must exist on disk; chain `fe-001 → do-001 → fe-consumers`, acyclic, mirrors released w0 `fe-005 → do-001`).
- Includes the `## Existing behavior baseline` you asked for (current manifest content_scripts cited, no-regression assertion, "Verified: 2026-06-19") + `## Cross-domain contract` citing the FE exchange.

**Heads-up on one field:** I set `diff_estimate: mechanical`, not substantive — the actual diff is exactly one added js-array element, matching the rubric (single app-config value) AND the identical released w0 STORY-do-001 (also `mechanical`). It's a *real* (non-sentinel) story per your YES-path, but the diff complexity is mechanical. Flagging transparently — say the word if you want it flipped to `substantive` (one-word change), but I'd keep it mechanical for validator-effort accuracy + w0 consistency.

**Verified facts (opened the files myself):**
- `storage` permission already present (manifest.json:6) → `chrome.storage.local` toolbar-pos persistence needs NO manifest change.
- Current registered editor scripts: `lib/konva.min.js, bridge.js, editor-model.js, editor.js` (manifest.json:41).

**Observability:** no separate observability story owed — Snapdeck has no logging/metrics/tracing stack to instrument; the runtime round-trip is covered by PO E2E + the node --test suite. Stated explicitly in STORY-do-001 § Observability (not skipped). **API surface:** none changed — no API-spec/doc story owed.

**Peer messages SENT: 2** to frontend-architect — (1) the determination-driving query "are you extracting a new content-script file?"; (2) the registration-ownership confirmation + the depends_on contract for their consumer stories. FE replied confirming `editor-chrome.js` under STORY-fe-001.

Going idle now (staying warm for PO arbitration). Not shutting down.
