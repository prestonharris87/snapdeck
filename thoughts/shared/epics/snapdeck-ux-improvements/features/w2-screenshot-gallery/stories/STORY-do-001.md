---
name: "DevOps sentinel — gallery rides already-permissioned seams"
type: story
id: STORY-do-001
domain: devops
parent_epic: snapdeck-ux-improvements
parent_feature: w2-screenshot-gallery
assignee: devops-engineer
author_architect: devops-architect
status: pending
created_at: 2026-06-20T16:24:00Z
last_run_id: run-20260620-161818-88519
defects: []
sentinel: true
greenfield: false
effort: 1
diff_estimate: mechanical
files_modified: []
files_not_modified:
  - extension/manifest.json
  - extension/background.js
  - extension/popup/popup.html
  - extension/e2e/playwright.config.ts
  - extension/e2e/package.json
reuse_patterns:
  - "extension/manifest.json:6 — permissions array (activeTab/tabs/scripting/storage/unlimitedStorage); already covers chrome.tabs.sendMessage(ANNOTATE), chrome.storage, runtime messaging — do NOT widen"
  - "extension/manifest.json:32-45 — content_scripts already register the full editor stack (capture.js MAIN-world + konva/bridge/editor-model/editor-chrome/editor.js isolated-world) on localhost; the gallery reuses the released ANNOTATE seam, registers nothing new"
  - "thoughts/shared/epics/snapdeck-ux-improvements/features/w0-editor-foundation/stories/STORY-do-001.md — released precedent: a manifest touch is owed ONLY when FE extracts a NEW page-injected content-script module; this feature does not"
depends_on: []
---

# STORY-do-001 — DevOps sentinel: no manifest / build / CI change for the gallery

## Summary

**No DevOps work is required for `w2-screenshot-gallery`.** The popup gallery
(thumbnail grid + re-open + delete-with-confirm) is built entirely from surfaces
that are **already registered and already permissioned** in the shipping
`extension/manifest.json`. There is no manifest permission to add, no new
content-script to register, no build step to update (this is a no-build, no-bundler
unpacked MV3 extension), and no CI pipeline to wire (the repo has none). This is a
**sentinel** story: it exists to attest the audit was done and to freeze the
DevOps surface against accidental scope creep, not to ship a diff.

## Manifest-check basis (verified)

> Verified: 2026-06-20 — read `extension/manifest.json` at HEAD (post-w1-release).

Every seam the gallery consumes is already in the manifest:

| Gallery surface | Manifest backing | Already present? |
|---|---|---|
| New `background.js` message handlers (fetch-screenshots / re-open-and-resave / delete) | runtime messaging needs **no permission**; `background.js` is the registered service worker (`manifest.json:8`) | ✅ yes |
| `chrome.tabs.sendMessage(ANNOTATE …)` to the target tab | `"tabs"` permission (`manifest.json:6`); the editor content-script stack is already registered on `http://localhost/*` + `http://127.0.0.1/*` (`manifest.json:32-45`) — same seam `addScreenshot` already uses | ✅ yes |
| `chrome.storage` read/write of `report:<port>` | `"storage"` + `"unlimitedStorage"` (`manifest.json:6`) | ✅ yes |
| Popup thumbnail grid + delete-confirm | popup registered via `action.default_popup: popup/popup.html` (`manifest.json:15`); popup scripts load via `<script>` tags in `popup.html` (a **frontend** concern), **not** `content_scripts` | ✅ yes |
| Data-URL PNG thumbnails (`<img src="data:image/png…">`) | manifest has **no** `content_security_policy` key → MV3 default `extension_pages` CSP applies, which permits `img-src data:` by default | ✅ yes (no CSP entry owed) |
| `REPORT_COUNT_CHANGED` tick on `chrome.storage.session` | `"storage"` already granted; the session-tick seam was authored by released `w0-per-target-reports` STORY-fe-003 | ✅ yes |

**Build:** Snapdeck is an unpacked MV3 extension with **no build system and no
bundler** — the hand-edited `manifest.json` is the shipping artifact, so there is
no build target to touch.

**CI:** there is **no CI pipeline in this repo** — no root `package.json`, no
`.github/workflows/`, no `.gitlab-ci.yml`, no root pipeline YAML (the only workflow
YAMLs live under `.claude/`, which is framework infra, not the project CI surface).
So there is no PR-check pipeline to extend.

**Test wiring (no DevOps registration needed):**
- **Unit suites** are `extension/*.test.mjs`, auto-discovered by `node --test`
  (e.g. `node --test extension/*.test.mjs`). A new `background.gallery.test.mjs`
  added by FE/BE needs **no** devops registration — the glob picks it up.
- **E2E** is the Playwright harness under `extension/e2e/` with a self-contained
  `playwright.config.ts` whose `testDir` globs `src/`. A new `*.spec.ts` authored by
  the PO / browser-tester is **auto-discovered** — no config edit, no devops wiring.

## Peer-message confirmation

Sent to **frontend-architect** (2026-06-20, topic: "Confirm no manifest/build
change for gallery"): asked them to ✓/flag four manifest-adjacent items — (1) any
new page-injected content-script file, (2) any new background module needing
`importScripts(...)` or a `"type":"module"` SW flip, (3) any new permission,
(4) data-URL thumbnail CSP.

**Reply received (frontend-architect, 2026-06-20) — all four confirmed clean:**
the three FE stories touch only `extension/popup/popup.{html,js,css}` and new
message `case` branches + helper fns **inside the existing `extension/background.js`**.
(1) No new content-script file — re-open rides the **released**
`chrome.tabs.sendMessage(tabId, {type:'ANNOTATE', image, model})` seam (`editor.js`
already registered, `ANNOTATE` already handled). (2) New SW messages ride the
**existing** `chrome.runtime.onMessage` listener — no new top-level listener, no new
module, no `"type":"module"` flip. (3) No new permission (`storage`/IndexedDB,
`tabs`, `activeTab`/`scripting` all already granted). (4) Popup is already the
registered action popup, no new HTML entry, no eval/remote-script → default
`extension_pages` CSP suffices. **Sentinel LOCKED**; the FE popup/background stories
carry **no `STORY-do-001` dependency**, and this story stays `depends_on: []`.

## How we validate

- [ ] **No DevOps diff:** `git diff extension/manifest.json` is **empty** after the
      feature lands (the engineer changes nothing here). devops-validator confirms no
      manifest/permission/host/content-script/CSP delta crept in.
- [ ] **Manifest still valid JSON** (regression guard, not a change):
      `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"`
      exits 0.
- [ ] **Unit suite auto-discovers any new test** without a config edit:
      `node --test extension/*.test.mjs` runs every `*.test.mjs` (the gallery's new
      `node --test` suite included) — no test-registration change owed to devops.
- [ ] **E2E auto-discovers any new spec:** a new `extension/e2e/src/*.spec.ts` is
      picked up by the existing `playwright.config.ts` `testDir: src/` glob — no
      `playwright.config.ts` / `package.json` edit owed to devops.

## Unit tests

No script and no manifest change ship, so there is no DevOps unit under test. The
only DevOps-adjacent assertion is the **regression guard** above — manifest remains
valid JSON and the diff is empty. (The gallery's behavioral coverage — render /
re-open round-trip / delete / two-port isolation / bounded hostile-model — is owned
by the FE `node --test` suite and the PO/browser-tester E2E specs in `feature.md`.)

## Observability / API surface

- **No observability story owed.** Snapdeck has no logging/metrics/tracing stack to
  extend; the gallery's read/edit/delete are local `chrome.storage` operations that
  emit no runtime telemetry. The one cross-surface signal — `REPORT_COUNT_CHANGED`
  on `chrome.storage.session` — is the **already-released** badge seam
  (`w0-per-target-reports` STORY-fe-003 → `w1-dynamic-icon-badge` consumer), not a
  new observability hook. The user-visible behavior is covered by the PO E2E specs
  in `feature.md`.
- **No API-spec / doc update owed.** This feature edits only the **local** in-progress
  `report:<port>` store; the upstream `/report/save` controller contract and the
  saved `report.json` projection are **unchanged** (scope "Out of scope"). The new
  fetch / re-open / delete messages ride the internal extension `chrome.runtime`
  message channel — no documented HTTP API surface changes.

## Dependencies

`depends_on: []` — **genuinely standalone.** This sentinel produces no artifact and
consumes no in-flight story's output. The seams it attests are **already RELEASED**:
`w0-editor-foundation` STORY-do-001 registered the editor content-script stack;
`w0-per-target-reports` authored the `report:<port>` store + `REPORT_COUNT_CHANGED`
tick; `w1-dynamic-icon-badge` is the badge consumer — all merged ahead of Wave 2
(feature `depends_on: [w0-per-target-reports, w0-editor-foundation]`). The sentinel's
"no manifest change" conclusion holds regardless of how the FE/BE gallery stories
are implemented, so it depends on none of them. (If the frontend-architect's reply
flags a new content-script module, the upgraded substantive story would then
`depends_on` the FE story that authors that module — mirroring the released
`fe-005 → do-001` chain in w0.)
