---
sequence: 0004
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:55:03Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

backend-architect here, decomposing w0-editor-foundation storage (background.js).

I store the lossless `model` verbatim on the per-screenshot record in `addScreenshot()` (extension/background.js push-object literal, lines 129-139). I treat `model` as **opaque** — you own its internal schema. Before I freeze my storage story I need the exact WIRE SHAPE on the editor→background ANNOTATE resolve payload:

1. **Exact field name** on the resolve object — confirming it's `resp.model` (sibling of `resp.annotations`, `resp.original`, `resp.annotated`, `resp.meta`, `resp.console`, `resp.network`)?

2. **Presence guarantee** — is `model` ALWAYS present on a non-cancelled resolve, or can it be absent (e.g. an old content script / empty annotation set)? This decides my default: I'm planning `model: resp.model ?? null` so a missing field stores an explicit `null` rather than `undefined` (structured-clone-safe + round-trip-stable for w0-per-target-reports). Tell me if you'd rather I omit the key entirely when absent.

3. **Top-level type** — confirming it's a plain JSON-serializable object `{ version, items: [...] }` (no class instances / functions / Konva nodes), so it survives IndexedDB structured-clone and the w0-per-target-reports structured-clone re-key untouched.

I will NOT add `model` to the upstream `/report/save` payload (saveReport whitelist, lines 159-163 stays frozen) — downstream report→defects projection unchanged. Storing verbatim is the whole job on my side.

Will wait for your reply before finalizing STORY-be-001.
