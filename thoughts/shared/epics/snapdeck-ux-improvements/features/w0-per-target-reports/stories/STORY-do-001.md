---
name: "No devops changes — manifest already covers per-port storage"
assignee: devops-engineer
author_architect: devops-architect
status: pending
sentinel: true
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified: [extension/manifest.json, extension/background.js]
reuse_patterns: []
depends_on: []
---

# STORY-do-001: No devops changes required for this feature

No devops changes required for this feature.

## Rationale

This feature re-keys the in-progress report from a single global IndexedDB
record (`kv` key `"report"`) to a per-port key (`report:<browserPort>`) and adds
a cross-tab port-resolution cache in `chrome.storage.session`. Neither change
touches the extension's permission surface, host permissions, build, or CI:

- **`chrome.storage.session` (port-resolution cache)** — covered by the
  `storage` permission, which is **already present** in
  `extension/manifest.json` (`"permissions"` includes `"storage"`, verified at
  line 6). `chrome.storage.session` is a namespace of the same `storage`
  permission, so no new permission is needed.
- **IndexedDB (per-port reports)** — IndexedDB requires **no Chrome permission**
  at all. The pre-existing `unlimitedStorage` permission (also line 6) already
  removes the per-origin storage quota and amply covers additional per-port
  records in the same `snapdeck`/`kv` store.
- **Host permissions** — unchanged. The feature operates only on the same
  localhost/127.0.0.1 targets already granted by `host_permissions` (line 7)
  and the existing `content_scripts` match patterns.
- **No DB version bump** — the generic `kv` object store is reused as-is, so
  there is no schema/`onupgradeneeded` change for devops to wire.
- **No build / CI change** — Snapdeck's extension ships as static files with no
  build step or CI pipeline in this repo, so there is nothing to rebuild,
  lint-validate, or re-package for this change.

Verified `extension/manifest.json` line 6 already grants `storage` +
`unlimitedStorage`, so **no permission change is needed**. The feature's runtime
behavior change (per-port report keying, `GET_STATE` shape) is owned by the
backend/frontend extension-logic stories; observability for an MV3 extension is
limited to the service worker's existing `console.*` logging, which is unchanged
by a storage re-keying and is out of devops scope here.

Verified: 2026-06-19

## How we validate

Nothing to validate in the devops domain — `extension/manifest.json` is
unmodified. The downstream extension-logic stories' own E2E specs
(two-port isolation, save isolation, service-worker restart persistence,
non-target tab) exercise the actual behavior; loading the unpacked extension
with the unchanged manifest is sufficient permission coverage.

## Dependencies

None — this is a standalone sentinel confirming no devops work.
