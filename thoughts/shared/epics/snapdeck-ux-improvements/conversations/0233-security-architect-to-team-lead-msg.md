---
from: security-architect
to: team-lead
cc: product-owner
epic: snapdeck-ux-improvements
feature: w1-dynamic-icon-badge
mode: single-feature-review
date: 2026-06-19
re: STRIDE pass — final approved stories (fe-001/002/003 + be/db/do sentinels)
verdict: CLEAN — INFO only; 0 HIGH/CRITICAL/MEDIUM; no STORY-sec; no PO arbitration
---

# Security Review handoff — w1-dynamic-icon-badge

## Bottom line

**Clean pass.** This is a localhost-only, no-server, no-PII Chrome MV3 extension feature
that turns the `action` icon into a per-`tabId` state machine, consuming released w0 read
paths read-only. The default checklist is mostly **N/A** (no HTTP endpoint → no
authn/authz/CSRF/CORS/rate-limit; no server entity table → no audit columns; not
multi-tenant → no tenancy), and the items that *do* have a surface were already
dispositioned by the Contrarian 5.5 + PO arbitration passes. I added **three INFO
notes** (one per substantive FE story) and **affirmed** the existing accepted risks.

- **CRITICAL/HIGH:** 0 → **no SendMessage to product-owner** (per the narrow-exception
  rule, only HIGH/CRITICAL go to PO for accept/mitigate/defer).
- **MEDIUM:** 0.
- **LOW:** 1 (already accepted — 30s stale-green resolve cache, fe-002).
- **INFO:** 3 (fe-001, fe-002, fe-003) — all security-positive / explicit-assessment /
  N/A-disposition records.
- **STORY-sec authored:** none (nothing defensive-only that doesn't already fit an
  existing story).

Ground truth: I re-read `extension/background.js` end-to-end and `manifest.json` this
pass rather than trusting prior lessons (the localhost guard gets *tighter* between
features — confirmed).

## Per-story findings

### STORY-fe-001 (render primitives) — INFO, clean
- Icon render is `ImageData`/`OffscreenCanvas` over the extension's **own packaged
  PNGs** (`runtime.getURL`, same-origin) — no remote fetch, no `web_accessible_resources`,
  no DOM/`innerHTML`/SVG → **no XSS**. `setTitle`/badge are Chrome-native non-HTML sinks;
  `count` is the extension's own integer. No new permission (AC13).
- Security-positive: the `applyIconState_neverSetsGlobalBadge` test (`{tabId}` on every
  `action.*` call) is also a namespace-isolation guarantee vs the released global-badge
  flash. Keep it.

### STORY-fe-002 (tab-event derivation + `/resolve` fan-out + session cache) — INFO + accepted LOW
- **AC10 / one-source-of-truth VERIFIED at the released-code level.** `currentTargetPort()`
  (`background.js:81`) uses the boundary-anchored `/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/`,
  **byte-identical** to `addScreenshot()`'s write gate (`:266`). fe-002 consumes it and
  introduces **no second / looser predicate** (confirmed in the story body + my read). A
  deceptive `http://localhost.evil.com` → `null` → **gray, no probe** (AC1/AC10). The
  team-lead's "verify NO second/looser port predicate" ask: **confirmed clean.**
- **No SSRF (security-positive).** `findController()` targets a **fixed hardcoded**
  `127.0.0.1:<7777+i*10>` range; the only page-influenced value is a localhost-gated
  integer `?port=`. A hostile non-localhost page can't make the extension probe at all
  (gate returns null), let alone to a host of its choosing.
- **DoS / probe-storm BOUNDED.** Contrarian Finding 1 (~80 `/resolve` fetches on a fresh
  load via 4 overlapping re-entrant derives) is mitigated by the PO-required per-port
  single-flight (`_resolveInFlight`, cleared in `finally`) + 30s TTL cache. Localhost-only,
  ≤40 fetches/probe, self-limiting once cached — sufficient throttle for a local single-user
  tool. Concur with PO disposition; no separate rate-limit story.
- **LOW (accepted):** ≤30s stale-green in the `chrome.storage.session` resolve cache after a
  `deck down`. Extension-owned, per-extension-isolated store (not page/cross-extension
  writable); bounded, self-healing on reload. Already accepted by Contrarian/PO. No new action.

### STORY-fe-003 (live-count tick consumer + flash reconcile) — INFO, clean
- **Explicit untrusted-`storage.session` assessment (team-lead's ask): NO trust boundary
  crossed.** `chrome.storage.session` is per-extension isolated — not readable/writable by
  other extensions, and page/MAIN-world JS (`capture.js`) has no `chrome.storage` access. No
  `externally_connectable` in the manifest → message/storage surface is web-unreachable. The
  only writer of `reportCountChanged` is Snapdeck's own SW. **Even granting a hypothetical
  forged tick**, the BOSS-elevated design makes the tick a *nudge only*: `refreshActiveTab()`
  always re-reads the authoritative count from the `getReport`/`GET_STATE` SSOT on every wake,
  so a forged tick can at most trigger a repaint that re-reads the **true** count. Worst impact
  = a stale integer screenshot count on a local toolbar. **Cosmetic-only by construction.**
  `droppedTick_wakeReconcilesFromGetState` doubles as the security regression test.
- **Loop closure (security-positive):** the strict `changes.reportCountChanged` key-filter
  prevents a paint→`resolve:*` cache write→`onChanged`→paint feedback loop (BOSS-flagged).
  `onChanged_keyFiltered_resolveCacheWriteNoRederive` guards it.
- Affirmed the two existing accepted risks (idle dormant-SW stale count; masked `!` error
  flash on orange tabs). Both are availability/feedback, not confidentiality/integrity, and
  already PO-dispositioned. The masked-error item, if PO ever judges it unacceptable, is a
  BOSS-escalated released-code defect — not an in-feature edit, and outside my severity lane.

### STORY-be-001 / db-001 / do-001 (sentinels) — N/A, no security surface
- **be-001:** `/resolve` consumed read-only; controller binds 127.0.0.1 (loopback), no
  auth model change — "unchanged, local-loopback," not a new scheme. No controller diff.
- **db-001:** w0 IndexedDB `report:<port>` consumed read-only; no new store/key/version
  bump; the resolve cache is FE-owned `chrome.storage.session`, not a DB. No audit-column
  surface (no server entity table exists).
- **do-001:** no manifest/permission/asset change (AC13); icons tinted programmatically
  from packaged PNGs. No new permission → no MV3 auto-update re-consent hazard.

## Checklist application (so it reads as applied, not skipped)
authn/authz=N/A · input-validation=N/A (no new write path; `tab.url` is browser-authoritative
+ regex-gated) · secrets=N/A · audit-columns=N/A · soft-delete=N/A · rate-limit=N/A
(single-flight+TTL is the relevant throttle) · injection=N/A (IndexedDB keyed access, no
concat) · CSRF=N/A (no `externally_connectable`) · CORS=N/A · XSS=N/A (no DOM sink) ·
tenant-isolation=N/A (single-user local tool).

## For PO (no action required, FYI only)
No HIGH/CRITICAL means nothing needs your accept/mitigate/defer judgment. The INFO notes are
recorded on the stories; the LOW stale-green and the two fe-003 accepted risks are already in
your arbitration record. Nothing here gates delivery.
