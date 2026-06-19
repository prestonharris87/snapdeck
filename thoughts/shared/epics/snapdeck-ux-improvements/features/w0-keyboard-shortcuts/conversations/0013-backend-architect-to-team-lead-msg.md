---
sequence: 0013
from: backend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:57:30Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
---

**Backend decompose complete for w0-keyboard-shortcuts.**

**Story written (1):**
- **STORY-be-001** — "Capture keyboard-shortcut command + onCommand listener + badge signal" — `substantive`, effort 2, `depends_on: []`, `status: pending`. One cohesive service-worker story: manifest `commands` block + top-level `chrome.commands.onCommand` listener in `background.js` + popup-independent result signal. Single story (not split) because the command-id string `"capture-screenshot"` is one contract shared between manifest and listener — splitting would create a split-brain seam.

**Baseline (opened the files, cited real file:line — not from memory):**
- `addScreenshot()` at `background.js:110-142` — zero-arg seam; localhost guard `/^http:\/\/(localhost|127\.0\.0\.1)/` at `:112`; returns `{error}` (`:113/:119/:125`), `{cancelled}` (`:127`), `{ok,count}` (`:141`).
- Existing top-level `chrome.runtime.onMessage.addListener` at `background.js:81-84` (the registration sibling the new `onCommand` listener sits beside).
- Manifest: `permissions` `:6` (no `notifications`), `host_permissions` `:7`, `service_worker` `:8` (classic SW, no `"type":"module"`), `action` block `:14-22`. No-regression assertion + `Verified: 2026-06-19` present.

**Result-signal decision:** action badge (`chrome.action.setBadgeText`), **not** `chrome.notifications` — zero new permission, can't be OS-suppressed; devops confirmed `notifications` would trigger Chrome's "disabled pending re-acceptance" on auto-update. Cancelled → neutral (no false signal); error/not-a-target → red `!` badge + tooltip carrying `addScreenshot()`'s error string. All 9 feature ACs mapped in the `validates` checklist.

**Auth:** stated explicitly — local, user-initiated extension command, no network auth; access gate is the intrinsic localhost guard inside `addScreenshot()`; `host_permissions` unchanged.

**Unit tests:** `node --test` (repo's only JS convention — `node:test`, zero deps) via a new co-located `extension/background.test.mjs` with hand-written `chrome`/`indexedDB` stubs; loads classic SW as CJS, captures the registered onCommand callback. 6 concrete named tests. Flagged that this is the FIRST extension test file (escalate to you if harness setup is deemed out-of-scope rather than skipping).

**Peer messages sent: 3** (all replied, all agreed):
1. **devops-architect** — manifest `commands`-block ownership → resolved: **mine** (single cohesive story, no cross-story `depends_on`); DO writes sentinel STORY-do-001.
2. **frontend-architect** — confirmed no FE work (badge is background-driven, not popup); FE wrote sentinel STORY-fe-001.
3. **database-architect** — confirmed no DB/IndexedDB/report-storage work; DB wrote sentinel STORY-db-001.

**Manifest-ownership resolution:** the `commands` block belongs to my backend story (feature-behavior coupled to my listener), agreed by devops — no separate manifest-config story, no cross-domain `depends_on`.

**Cross-domain deps introduced:** none. STORY-be-001 is standalone (`depends_on: []`), parallel-safe with the other w0 features; only coupling is a `background.js` merge window to coordinate with BOSS at push time (siblings also edit `background.js`).

Registered the story in `feature.md`; lessons + live-status updated. Ready for PO arbitration / Phase 6.
