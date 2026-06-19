---
name: "No devops changes — text rework stays in registered editor.js"
type: story
id: STORY-do-001
domain: devops
parent_epic: snapdeck-ux-improvements
parent_feature: w1-text-box-autofit
assignee: devops-engineer
author_architect: devops-architect
status: approved
sentinel: true
created_at: 2026-06-19T15:35:00Z
last_run_id: run-20260619-150554-36418
defects: []
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/manifest.json
  - extension/content/editor.js
  - extension/content/editor-model.js
reuse_patterns:
  - "extension/manifest.json:32-45 — content_scripts[1] (document_idle, isolated-world) already lists content/editor-model.js + content/editor.js; the rework lands inside these already-registered files"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/stories/STORY-do-001.md — the w0 registration precedent that does NOT recur here (no browser-loaded module is extracted this feature)"
visual_references: []
depends_on: []
---

# STORY-do-001 — No devops changes required for this feature

**No devops changes required for this feature.**

## Why this is a sentinel (no-work domain)

The text-box auto-fit rework is a pure runtime/code change inside content scripts that
are **already registered** in `extension/manifest.json`. Confirmed against the live manifest
and via peer confirmation from the frontend-architect — not assumed:

- **No new browser-loaded module to register.** `extension/manifest.json` `content_scripts[1]`
  (the `document_idle`, isolated-world entry, `manifest.json:39-44`) already lists
  `content/editor-model.js` and `content/editor.js`. The frontend-architect confirmed the
  entire text-tool rework lands **inside `editor.js`**, with the auto-fit/wrap logic kept
  **inline** in `editor.js` (it is Konva canvas-text-measurement-dependent and cannot be a
  faithful pure node module), and `content/editor-model.js` **unchanged**. Adding opaque
  text-item fields to the editor `model` requires **no** manifest change — this is the
  explicit MV3 directive in `feature.md` ("`content/editor-model.js` is already a registered
  content script; adding opaque text-item fields needs no manifest change").
- **The one new file is NOT a content script.** The frontend-architect's only new file is
  `extension/editor.textbox.test.mjs`, run via `node --test` and **never injected into a
  page** — so it is not a `content_scripts[].js` entry and needs no manifest registration.
  This is the **inverse of the w0 seam** (`w0-editor-foundation` STORY-do-001), where a
  *browser-loaded* module (`content/editor-model.js`) was extracted out of the IIFE and that
  extraction is what forced a manifest registration. Nothing browser-loaded is extracted here.
- **No permission / host / command delta.** No new Chrome `permissions`, no `host_permissions`
  change (the `http://localhost/*` + `http://127.0.0.1/*` **localhost-only guard is unchanged**,
  per scope), no `web_accessible_resources`, no `commands` change. `storage` + `unlimitedStorage`
  already cover the per-screenshot `model` persistence; the new geometry/fit fields ride opaquely
  inside the existing `model` field with no DB-version or storage-API change.
- **No project CI surface to wire anything into.** Snapdeck is an unpacked MV3 extension with
  **no `package.json`, no `Makefile`, no bundler, and no repo-root CI** — verified by glob: the
  only workflow YAMLs are under `.claude/.github/workflows/` (framework infra, not the project
  CI surface). The new `node --test` file is invoked directly against the file; there is no
  test-runner config, build target, or CI job for me to author or update.

## Observability — N/A (no stack to extend)

Snapdeck has **no logging / metrics / tracing stack** to hook into; a canvas annotation tool
emits no runtime telemetry. The mandatory-observability rule presumes an existing observability
surface to extend, and there is none here. The runtime behavior changes (draw-a-box, auto-fit,
wrap re-flow, resize re-fit, lossless round-trip, render-boundary robustness) are fully covered
by the Product Owner's E2E specs in `feature.md` (the browser-tester Playwright lane) plus the
frontend-architect's `node --test` module suite. This is consistent with the released
`w0-editor-foundation` STORY-do-001 disposition (same project, same "no observability infra" call).

## API surface — unchanged (no spec/doc update owed)

This feature changes **no HTTP surface**. The lossy `annotations` projection stays byte-frozen
(`{ id, type:"text", x, y, text }` via `editor-model.js` `projectAnnotations`, which scope
forbids modifying), and the upstream `/report/save` payload is unchanged — the new box geometry /
fit fields live **only** in the opaque `model` items that ride the internal editor→background
resolve message channel, never in the projection or the saved payload. No API-spec/contract
document to update.

## How we validate it was done correctly

- [ ] **Unmodified manifest:** this feature's diff touches **no** `extension/manifest.json` — no new
      `content_scripts[]` entry, no `permissions`/`host_permissions`/`web_accessible_resources`/`commands`
      change; `content/editor-model.js` + `content/editor.js` stay the already-registered entries.
- [ ] **No new browser-loaded module:** the only new file (`extension/editor.textbox.test.mjs`) is a
      `node --test` file, never injected into a page — so it needs no manifest registration (the inverse
      of the w0 module-extraction seam).
- [ ] **No CI / build / observability surface touched:** no `package.json`/`Makefile`/bundler/CI job
      exists to wire into, and none is added; the localhost-only host guard is unchanged.

## Dependencies

`depends_on: []` — genuinely standalone. There is no devops artifact to produce, so there is
nothing to sequence against any FE/DB/BE story. The frontend-architect explicitly confirmed
**no** `depends_on: [STORY-do-NNN]` is needed from any FE story (nothing browser-loaded is being
registered). If a later revision re-introduces a browser-loaded module split (the w0 pattern),
this sentinel would flip to a real registration story depending on the FE file-creating story —
but per the FE architect's confirmed design that does not happen this feature.

## Cross-domain coordination

- **frontend-architect** (2 messages, 1 round, topic: manifest/content-script boundary). Asked
  whether the rework stays inside the already-registered `editor.js`/`editor-model.js` or splits
  a new browser-loaded module needing registration (the w0 trap). FE confirmed: all rework inline
  in `editor.js`, `editor-model.js` unchanged, and the only new file
  (`extension/editor.textbox.test.mjs`) is a `node --test` file, not a content script → no
  manifest change. Mirrored to
  `thoughts/shared/epics/snapdeck-ux-improvements/conversations/`. This confirmation is what makes
  the sentinel a team agreement rather than an isolated assumption.

## Revisions

### 2026-06-19 — product-owner arbitration (Phase 6)

Sentinel **verified correct and accepted** — the contrarian pass confirmed nothing browser-loaded is
extracted (auto-fit stays inline in `editor.js`; `editor-model.js` unchanged; the one new file is a
`node --test` file, not a content script), so there is genuinely no manifest/registration/CI/permission
delta. FE peer-confirmation is recorded in `conversations/`. PO changes: **added a `## How we validate`
checklist** (the sentinel shipped without one — recurring sentinel gap) and **added `last_run_id`** for
frontmatter conformance with its siblings. Status promoted pending → approved.
