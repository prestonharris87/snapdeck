---
type: story
id: STORY-do-001
name: "No devops changes — icon states generated in-worker, no assets/manifest"
domain: devops
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: devops-engineer
author_architect: devops-architect
effort: 1
status: approved
sentinel: true
depends_on: []
diff_estimate: none
files_modified: []
files_not_modified:
  - extension/manifest.json
  - extension/icons/icon-16.png
  - extension/icons/icon-48.png
  - extension/icons/icon-128.png
  - extension/background.js
reuse_patterns:
  - "extension/manifest.json:6 — existing permissions array (activeTab/tabs/scripting/storage/unlimitedStorage); AC13 no-new-permission anchor"
  - "extension/manifest.json:9-13,17-21 — existing icons + action.default_icon (3 neutral PNGs) — unchanged by this feature"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w1-dynamic-icon-badge/stories/STORY-db-001.md — sibling w1 sentinel format"
created_at: 2026-06-19T15:40:00Z
last_run_id: run-20260619-150619-36719
visual_references: []
defects: []
---

# Story: No devops / asset / manifest changes required for this feature

## What we're doing

**No devops, asset-packaging, or manifest changes are required for this feature.**
This is an explicit "no work needed" sentinel for the devops domain.

`w1-dynamic-icon-badge` turns the static toolbar (`action`) icon into a per-`tabId`
state machine (gray / green / orange+count). The three color states are produced
**programmatically at runtime** inside the MV3 service worker — `OffscreenCanvas` +
2D-context tint of the existing logo, read back as `ImageData`, applied via
`chrome.action.setIcon({ tabId, imageData })` — per the asset-approach decision made
with `frontend-architect` (Option B: programmatic generation, not pre-rendered PNG
variants). That runtime code lives entirely in the frontend story set
(`STORY-fe-001`, `extension/background.js`). There is therefore **no** new icon
asset to add under `extension/icons/`, **no** `manifest.json` edit, **no** new
manifest permission, **no** CI/build-system/dependency change, and **no** local
service-dependency change for the devops-engineer role to own.

Snapdeck is an unpacked Chrome MV3 extension: raw unbundled JS + a plain
`extension/manifest.json`, vendored libs, **no `package.json`/bundler/build step,
no repo-root CI pipeline, and no logging/metrics/tracing stack.** So this domain is
genuinely empty here.

## Why this is a sentinel (not substantive)

- **No new icon assets.** Option B (programmatic `OffscreenCanvas`/`ImageData`
  generation) was chosen with `frontend-architect`, so there are **no**
  `icon-gray-*.png` / `icon-green-*.png` / `icon-orange-*.png` files to add. The
  existing three neutral PNGs (`extension/icons/icon-16/48/128.png`,
  `manifest.json:9-13`) are the FE worker's tint source via
  `fetch(chrome.runtime.getURL('icons/icon-16.png'))` — read-only, unchanged. No
  `web_accessible_resources` entry is needed (`runtime.getURL` from the extension's
  own service worker is same-origin).
- **No `manifest.json` change.** `action.default_icon` (`manifest.json:17-21`) stays
  pointed at the existing neutral PNGs (install-time default); per-`tabId` state is
  set purely via the runtime `setIcon`/`setBadgeText`/`setBadgeBackgroundColor`/
  `setTitle` `action`-API calls FE owns. No manifest key is added or repointed.
- **No new permission (AC13).** `permissions:
  ["activeTab","tabs","scripting","storage","unlimitedStorage"]` (`manifest.json:6`)
  plus the localhost `host_permissions` already cover every API this feature uses:
  `chrome.action.*` (the `action` key, `manifest.json:14`, needs no permission),
  `chrome.tabs.*` (covered by `tabs`), and `chrome.storage.session` (a namespace of
  the already-granted `storage`). `OffscreenCanvas` is a web-platform global in the
  worker and needs **no** `offscreen` permission (that permission gates only the
  separate `chrome.offscreen` *documents* API). Verified against the live manifest
  on 2026-06-19. Adding no permission also avoids the MV3 auto-update
  re-acceptance hazard (extension would be disabled pending re-consent).
- **No CI / build / dependency / local-service work.** This repo has no
  `package.json`, no bundler, no repo-root CI pipeline (the only workflow YAMLs are
  under `.claude/` framework infra, not the project CI surface), and no
  container/compose local-service stack. There is nothing to wire.

## Observability (mandatory cross-cutting concern — N/A, justified)

This feature **does** change runtime behavior (a new per-`tabId` icon/badge state
machine), so the observability concern is evaluated explicitly rather than skipped:

- **Logging / metrics / tracing: N/A — no observability stack exists to extend.**
  Snapdeck is an unpacked MV3 extension with no structured-logging configuration, no
  metrics pipeline, and no tracing infrastructure. There is no telemetry surface to
  hook, and manufacturing one is out of scope for a toolbar-icon UX change.
- **How the runtime change is verified instead:** the icon/badge state transitions
  are fully covered by the Product Owner's E2E specs in `feature.md` (gray/green/
  orange assertions, live count increment, save→green, per-`tabId` isolation,
  service-worker-restart re-derivation, steady-state-after-flash, deceptive-host →
  gray) plus the FE story's pure-logic unit tests (`node --test` over the
  state-derivation seam). No DevOps telemetry story is warranted.

## How we validate it was done correctly

- [ ] `extension/manifest.json` is unchanged in this feature's diff — no new
      `permissions` entry, no `icons`/`action.default_icon` edit, no
      `web_accessible_resources` addition.
- [ ] No new files appear under `extension/icons/` (the three existing PNGs are
      untouched; no color-variant PNGs added).
- [ ] No `package.json` / build-config / CI-pipeline / local-service-dependency file
      appears in the diff (there are none to change).
- [ ] The icon-state generation is implemented in the FE story
      (`extension/background.js`, `OffscreenCanvas` + `setIcon({ imageData })`), not
      as static assets.

## Unit tests

n/a — sentinel story, no devops artifact to verify. Manifest well-formedness is
naturally guarded because the manifest is unchanged; the no-build manifest-validation
lane (`node -e JSON.parse(manifest)` + asserting every `content_scripts[].js` path
exists) would only be exercised if a manifest edit were made, and none is. The
icon-state / cache pure-logic seams are covered by the FE story's `node --test`
suite, not by a devops test.

## Dependencies

`depends_on: []` — genuinely standalone. This is a no-op sentinel: it adds, edits,
and removes nothing, so it has no producer to wait on. The programmatic icon
generation it cedes to FE is tracked by `STORY-fe-001`; this sentinel does not
depend on it (a sentinel asserting "no devops work" needs no upstream). The existing
`icons/icon-*.png` assets the FE worker tints are already present in-repo (released),
not a deliverable of any story in this feature.

## Cross-domain contract

Sentinel status was coordinated with `frontend-architect` before finalizing (the
required Phase-5 peer exchange named in my dispatch). Confirmed:

1. **Asset approach = Option B (programmatic).** Icon color states are generated in
   `background.js` via `OffscreenCanvas`/`ImageData` and applied with
   `setIcon({ tabId, imageData })` — FE-owned. No PNG variants, so no devops asset
   story; my domain sentinels.
2. **No `manifest.json` change** — `default_icon` stays on the existing neutral PNGs;
   per-tab state is runtime `action`-API only. The existing icons are tinted via
   `runtime.getURL` (same-origin; no `web_accessible_resources` needed).
3. **AC13 holds — no new permission.** `action`/`tabs`/`storage` (covers
   `storage.session`) are already granted; `OffscreenCanvas` needs no `offscreen`
   permission. No MV3 auto-update re-acceptance hazard. No escalation to `team-lead`
   needed.

See this feature's `conversations/` log (devops-architect ↔ frontend-architect,
"Icon-asset approach + AC13 permission confirm").

## History

- 2026-06-19 — created by devops-architect (effort=1, sentinel, depends_on none).
  Asset approach (programmatic vs PNG variants) settled with frontend-architect →
  Option B (programmatic, FE-owned); AC13 no-new-permission confirmed against the
  live `extension/manifest.json`.
