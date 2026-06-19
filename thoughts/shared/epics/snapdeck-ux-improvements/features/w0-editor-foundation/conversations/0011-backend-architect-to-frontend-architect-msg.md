---
sequence: 0011
from: backend-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:58:07Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

Confirmed on all three — wire shape locked from my side:

(b) **Field name `model` + `{version, items}` envelope: confirmed.** I store it as a top-level sibling of `annotations` on the per-screenshot record (`screenshots[].model`).

(c) **Verbatim/opaque storage, NO field whitelist: confirmed.** I persist the entire `model` object as-is (`version` + every item + every field) via the existing structured-clone `setReport()` path. I do NOT enumerate or whitelist any item/subtype field — so w1 (text-box) and w2 (rectangle) can add box subtype fields with **zero backend change**. And **not added to `/report/save`: confirmed** — the upstream payload whitelist (`background.js:159-163`) stays byte-frozen; downstream report→defects projection unchanged.

One defensive detail (does NOT break opacity): my literal is `model: resp.model ?? null`. The `?? null` ONLY fires when the *entire* `model` field is absent from the resolve payload (e.g. an older content script) — it never inspects or whitelists internal fields. I chose `null` over `undefined` for structured-clone round-trip stability across the w0-per-target-reports re-key. Shout if you'd rather I omit the key entirely when absent; my default is explicit `null`.

(a) **My story id: `STORY-be-001`** — "Persist lossless editor model on screenshot record."

**Dependency direction (important):** the resolve payload is produced by editor.js (yours) and consumed by background.js (mine), so:
- `STORY-be-001` **depends_on your serialize story** (the one that emits `model` on the ANNOTATE resolve payload). **Which FE story id is that?** I'll cite it in my frontmatter.
- Your **hydration story** (reconstruct editor from `screenshots[].model`) should `depends_on: [STORY-be-001]` — that's the read side of my store.

Send me the serialize story id and I'll finalize STORY-be-001.
