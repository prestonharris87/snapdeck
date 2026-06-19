---
type: story
id: STORY-do-001
name: "No devops changes — keyboard shortcut ships in backend story"
domain: devops
parent_feature: w0-keyboard-shortcuts
parent_epic: snapdeck-ux-improvements
assignee: devops-engineer
author_architect: devops-architect
effort: 1
status: approved
sentinel: true
sentinel_rationale: >-
  Snapdeck is an unpacked Chrome extension with no build system, no repo-root
  CI pipeline, no env-bound config, and no observability stack. This feature
  adds only a manifest `commands` block + a top-level `chrome.commands.onCommand`
  listener, both owned by backend-architect as one cohesive service-worker story
  (the manifest binding is inert without the listener). Nothing in the
  build/CI/config/observability domain changes.
greenfield: true
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/manifest.json
  - extension/background.js
reuse_patterns: []
depends_on: []
created_at: 2026-06-19T02:53:00Z
last_run_id: run-20260619-023636-42973
visual_references: []
defects: []
---

# DO-001: No devops changes — keyboard shortcut ships in backend story

**No devops / build / CI / config / observability changes required for this feature.**

## What we're doing

Nothing in the build/CI/config/observability domain. `w0-keyboard-shortcuts` is a
caller-only feature inside the Chrome extension: it adds a `commands` block to
`extension/manifest.json` and one top-level `chrome.commands.onCommand` listener
in `extension/background.js` that dispatches to the existing, unchanged zero-arg
`addScreenshot()` seam. There is no pipeline, container, dependency-manifest,
env var, secret, or telemetry hook to create or alter.

## Why this domain has no work

Verified by direct inspection of the repo (2026-06-19):

- **No build system / package manager.** The extension ships as raw, unbundled
  source — `extension/manifest.json`, hand-written JS (`background.js`,
  `popup/`, `content/`), and a vendored `extension/lib/konva.min.js`. There is
  no repo-root `package.json`, `Makefile`, or bundler config, so there is no
  build target to add or tune.
- **No project CI pipeline.** There is no `.github/workflows/` at the repo root.
  (The only workflow YAMLs in the tree live under `.claude/` — framework
  tooling, explicitly out of this project's CI surface.) No PR-check pipeline
  exists to extend for this feature.
- **No env-bound config or secrets.** The feature introduces no env var, no
  config key, and no credential — it binds a keystroke to an in-process function
  call. Nothing to wire through a config mechanism or secret store.
- **No observability stack.** Snapdeck has no logging/metrics/tracing
  infrastructure to hook; the feature's user-visible signal (an action badge per
  backend's lean, or a `chrome.notifications` toast) is a UX affordance authored
  in backend's service-worker story, not a telemetry concern. The mandatory
  observability story does not apply: there is no observability surface in this
  project to extend, and the runtime-behavior change is a single function
  dispatch fully covered by the PO's E2E specs against the background worker.
- **The manifest `commands` block is behaviorally coupled to backend's listener.**
  The command-id string is a shared contract between the manifest and
  `background.js`; the binding is meaningless without the `onCommand` listener.
  Splitting the manifest config into a separate DevOps story would manufacture a
  cross-domain `depends_on` seam with zero DevOps content. Keeping it in one
  backend story keeps a single owner of the command-id contract — the
  lower-blast-radius choice.

## Ownership resolution (cross-domain contract)

The one open ownership question — whether the `extension/manifest.json`
`commands` block is DevOps (extension config) or backend (feature behavior) — was
settled by direct discussion with `backend-architect` **before** finalizing this
sentinel (not assumed):

- DO proposed backend own the manifest `commands` block + `onCommand` listener +
  result signal as ONE cohesive service-worker story; backend confirmed and is
  taking it (single owner of the command-id contract, no cross-story seam).
- See `../conversations/` (devops-architect ↔ backend-architect, this run):
  topic "manifest commands-block ownership" — backend's reply explicitly claims
  the `commands` entry as feature-behavior and prefers no DevOps split.
- DO added one non-binding operational note: the **action-badge** result signal
  (`chrome.action.setBadgeText`) needs no new manifest permission, whereas a
  `notifications` permission would trigger Chrome's "extension disabled pending
  re-acceptance" behavior on auto-update for existing installs. The signal
  mechanism remains backend's/PO's call.

This sentinel records a **team agreement**, not an isolated assumption. The
parallel FE (`STORY-fe-001`) and DB (`STORY-db-001`) sentinels reached the same
conclusion via their own peer messages to backend.

## How we validate

- [ ] The devops story diff for this feature is **empty** — `devops-validator`
      confirms no CI/build/config/observability file is touched by any story in
      this feature.
- [ ] `git diff --stat` against the feature branch shows no changes to any
      build-system, pipeline, env-config, or observability file (there are none
      to change).

If a DevOps-domain change (a new pipeline, a build step, an env var, a telemetry
hook) ever appears in this feature's diff, this sentinel is wrong and must be
reopened.

## Unit tests

None. A sentinel carries no script, pipeline, or config to lint or test. The
CI-pipeline schema/lint check is inapplicable — there is no pipeline definition.
The feature's behavioral coverage (shortcut dispatch, not-a-target signal,
service-worker re-registration, cancelled-annotate) is exercised by the PO's E2E
specs and backend's unit tests against the background worker.

## Dependencies

`depends_on: []` — genuinely standalone. This sentinel produces and consumes no
build/CI/config/observability artifact, and the manifest `commands` block it
deliberately does NOT author is owned within backend's cohesive service-worker
story (no cross-story dependency seam, by design and by agreement).

## History

- 2026-06-19 — created by devops-architect (effort=1, sentinel, depends on none).
  No-DevOps-work decision peer-confirmed with backend-architect; manifest
  `commands` block ownership assigned to backend by mutual agreement. See
  `../conversations/` for the on-the-record exchange.

## Revisions

- 2026-06-19 — product-owner (Phase 6 arbitrate): promoted `status: pending →
  approved`. Converted the two plain-bullet validation items under `## How we
  validate` to `- [ ]` checklist form for an unambiguous validates checklist —
  meaning unchanged. Sentinel rationale (no build/CI/config/observability
  surface; `commands` block owned by backend's cohesive service-worker story)
  accepted as correct; the badge-over-`notifications` operational note is
  consistent with STORY-be-001's chosen signal. See
  `../conversations/0014-product-owner-arbitration-summary.md`.
