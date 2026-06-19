---
sequence: 0126
from: frontend-architect
to: team-lead
step: inline-msg
run_id: run-20260619-150619-36719
timestamp: 2026-06-19T15:45:20Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

**FE decomposition for w1-dynamic-icon-badge is on disk.** 3 stories under `…/stories/`:

- **STORY-fe-001** — *Per-tabId icon-state render primitives (tint + action dispatch).* Programmatic `OffscreenCanvas` `source-in` tint of the existing logo → gray `#5F6368` / green `#1E8E3E` (AC13 anchor) / orange `#E37400`; `applyIconState(tabId,{state,count})` via the tabId-scoped `action` API. effort 2, **substantive**. `depends_on: []`.
- **STORY-fe-002** — *Tab-event icon derivation + two-tier resolve + session cache.* Top-level `tabs.onActivated`/`onUpdated` → `refreshActiveTab` reusing released `currentTargetPort()`/`findController()`/`getReport()` as SSOT; gray-instant for non-localhost (no probe), `/resolve` only on `storage.session` cache miss; 30s TTL + bust-on-reload (BE's `deck up/down` heads-up). effort 3, **substantive**. `depends_on: [STORY-fe-001]`.
- **STORY-fe-003** — *Live-count freshness trigger + transient-flash reconcile.* SKELETON. Reconcile half is FINAL (per-tabId badge precedence: no stuck `✓`/`!`, green/gray clear via `text:null` fall-through). Trigger half pending BOSS. effort 2, **substantive**. `depends_on: [STORY-fe-001, STORY-fe-002]` (+ the BOSS defect id once opened).

**DAG:** fe-001 → fe-002 → fe-003 (linear). No cross-domain edges — BE/DB/DO all sentinel (no in-feature producer to depend on).

**Asset decision (mine to make):** **Option B / programmatic** — no new PNGs, no manifest change, no permission (AC13). devops-architect acked → **STORY-do-001 sentinel**.

**⚠️ One refinement to the BOSS ask (please relay so the defect is scoped right):** the Option-A consumer should be **`chrome.storage.session.onChanged`** fed by a one-line `chrome.storage.session.set({captureTick: Date.now()})` tick — **NOT a second `onMessage` listener.** A 2nd top-level `onMessage` listener BREAKS the released sibling unit suites: their vm `chrome.runtime.onMessage` mock single-captures the last listener (`background.reports.test.mjs:88`), so released `GET_STATE`/`SET_NOTE` tests would invoke ours and hang — and those test files are un-editable (released boundary). The released-side edit is equivalently tiny (a `storage.session.set` tick after `setReport`/`clearReport` at bg.js:227/258/185) and harness-safe. Same minimal-AC11 reconcile holds either way; only the trigger plumbing changes.

**Peer messages SENT: 5** — backend-architect ×1 (`/resolve` shape unchanged), database-architect ×1 (`GET_STATE`/`report` read contract unchanged), devops-architect ×2 (icon-gen ownership + AC13; then Option-B decision), team-lead ×1 (the coordination-#4 escalation). All 3 peer confirms landed (all sentinel this feature).

Also filed `clarifications.md` CLAR-001 (auto-resolved) for the orange/gray token selection (design.md pins none). Going idle — will finalize fe-003's trigger section the moment BOSS rules.
