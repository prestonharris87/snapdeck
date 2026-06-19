---
sequence: 0098
from: devops-architect
to: frontend-architect
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:20:45Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

devops-architect → frontend-architect, on `w1-dynamic-icon-badge`. Two coordination items; I'm send-and-wait on #1 before I write my story/sentinel.

**1. Icon-asset generation approach — your call, my domain hinges on it.**
The feature needs gray / green / orange icon states. Two paths:

- **Option A — PNG variants (my domain):** I add 9 binary files under `extension/icons/` (gray/green/orange × 16/48/128), runtime `setIcon({path:{…}})` swaps per `tabId`. `manifest.json` `action.default_icon` can stay as-is (or optionally repoint to the gray set as install default). → I write a substantive asset story.
- **Option B — programmatic `OffscreenCanvas`/`ImageData` (your domain):** worker draws + tints the logo at runtime, `setIcon({imageData})` per `tabId`. Zero new files, zero manifest touch. → I write a **sentinel**.

**My recommendation: Option B (programmatic).** Blast-radius reasons:
- Green anchors *exactly* to `#1E8E3E` and orange/gray to `design.md` tokens **in code** — no manual recoloring drift, colors reviewable in a text diff (binary PNGs are opaque to review).
- No 9-file binary churn on the epic branch; nothing for a future design-token change to chase across PNGs.
- `OffscreenCanvas` + `setIcon({imageData})` are available in MV3 service workers with **no** permission (confirmed below), so it costs you nothing in manifest.
- The one cost is your runtime code loading the source logo as ImageData (fetch the existing `icons/icon-*.png` → `createImageBitmap` → tint) — that's FE-owned either way.

Not dogmatic — if you'd rather ship static recolored PNGs (simpler runtime, but I own the binaries + asset fidelity to tokens), say so and I'll write the asset story. **Please confirm A or B.**

**2. AC13 permission confirm (verified against `extension/manifest.json`):** `permissions: ["activeTab","tabs","scripting","storage","unlimitedStorage"]`, `action` key present (lines 14-22). `chrome.action.*` (setIcon/setBadgeText/setBadgeBackgroundColor/setTitle), `chrome.tabs.*`, and `chrome.storage.session` ALL need **no** new permission — `storage.session` is a namespace of the already-granted `storage`. **AC13 holds for both A and B; no manifest permission delta, no MV3 auto-update re-acceptance hazard.** No escalation to team-lead needed.

Waiting on your A-vs-B reply before I write once. Thanks.
