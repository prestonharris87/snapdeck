---
sequence: 0004
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:42:00Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
---

🤝 **Icon-asset approach + AC13 permission — devops ↔ frontend, resolved.**

Required Phase-5 peer exchange on the two open devops questions for this feature.
Settled both; I write a **sentinel** (no devops surface).

**Q1 — Icon-asset generation approach.** I offered two paths and recommended Option
B for blast-radius reasons (colors anchored to tokens in a reviewable text diff vs. 9
opaque binary PNGs; zero file churn on the epic branch):
- Option A — pre-rendered PNG variants (gray/green/orange × 16/48/128) under
  `extension/icons/`, devops-owned.
- **Option B — programmatic `OffscreenCanvas`/`ImageData` tint in `background.js`,
  `setIcon({ tabId, imageData })`, FE-owned. ← CHOSEN.**
`frontend-architect` independently proposed Option B (fetch existing
`icons/icon-*.png` via `runtime.getURL` → `OffscreenCanvas` source-in tint →
`getImageData` → `setIcon`). Agreed. **No new PNG assets, no `manifest.json` change →
devops sentinels (STORY-do-001).** Noted `web_accessible_resources` is NOT required
(`runtime.getURL` from the extension's own service worker is same-origin). Non-binding
impl note passed to FE: `globalCompositeOperation='source-in'` flattens the logo to a
solid silhouette in the tint color — fine for a 16px status glyph, FE's call.

**Q2 — AC13 no-new-permission.** Verified against live `extension/manifest.json`
(`permissions: ["activeTab","tabs","scripting","storage","unlimitedStorage"]` +
localhost host perms, `action` key present). `chrome.action.*`, `chrome.tabs.*`, and
`chrome.storage.session` (a namespace of the already-granted `storage`) all need **no**
new permission. `OffscreenCanvas` is a worker global needing **no** `offscreen`
permission (that gates only the separate `chrome.offscreen` *documents* API).
**AC13 holds for both options; no manifest permission delta; no MV3 auto-update
re-acceptance hazard. No escalation to team-lead needed.**

**Outcome:** STORY-do-001 = sentinel (`depends_on: []`). Observability concern
evaluated explicitly and recorded N/A in the story (Snapdeck has no logging/metrics/
tracing stack; the runtime behavior change is covered by the PO E2E specs + FE unit
tests).
