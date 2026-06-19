---
type: story
id: STORY-be-001
name: "Capture keyboard-shortcut command + onCommand listener + badge signal"
domain: backend
parent_feature: w0-keyboard-shortcuts
parent_epic: snapdeck-ux-improvements
assignee: backend-engineer
author_architect: backend-architect
effort: 2
status: approved
depends_on: []
greenfield: false
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-023636-42973
visual_references: []
defects: []
---

# Story: Capture keyboard-shortcut command + onCommand listener + badge signal

## What we're doing

Add a Chrome MV3 `commands` binding that gives the existing capture+annotate
action a **focus-only** keyboard shortcut (`Ctrl+Shift+S` / mac `Command+Shift+S`),
and wire it up with a **top-level** `chrome.commands.onCommand` listener in
`extension/background.js` that dispatches the capture command to the existing,
unchanged **zero-arg `addScreenshot()`** seam — the same code path the popup's
`ADD_SCREENSHOT` message already uses. Because there is no open popup to render
`addScreenshot()`'s `{ error }` / `{ cancelled }` / `{ ok, count }` return, add a
**popup-independent action-badge signal** so a not-a-target / error result is
never silent. This is a caller-only change: no report-storage / IndexedDB / popup
/ overlay / content-script edits.

## What it should look like

### 1. Manifest `commands` block (`extension/manifest.json`)

A new top-level `commands` key (sibling of `action`, `permissions`, etc.):

```json
"commands": {
  "capture-screenshot": {
    "suggested_key": {
      "default": "Ctrl+Shift+S",
      "mac": "Command+Shift+S"
    },
    "description": "Snapdeck: capture & annotate the current localhost tab"
  }
}
```

- **Command id contract:** `"capture-screenshot"`. This exact string is the
  contract shared between the manifest `commands` key and the `onCommand`
  listener's `command` argument compare in `background.js`. Both live in this one
  story, so there is no cross-story seam — keep the string identical in both
  files.
- **Focus-only:** the command MUST NOT set `"global": true` (Chrome's default
  command type is focus-only; product intent is page-focused capture, and Chrome
  restricts/limits global commands).
- **User-rebindable:** declaring `suggested_key` (not a hard binding) leaves the
  shortcut editable from `chrome://extensions/shortcuts` — no extra work needed;
  this is intrinsic to the `commands` API.

### 2. Top-level `onCommand` listener (`extension/background.js`)

Registered at **module scope** — immediately adjacent to the existing top-level
`chrome.runtime.onMessage.addListener(...)` at `background.js:81-84` — so it
re-binds every time the ephemeral MV3 service worker wakes:

```js
chrome.commands.onCommand.addListener((command) => {
  if (command !== "capture-screenshot") return;
  // fire-and-forget; result is surfaced via the action badge, not a return value
  runCaptureCommand();
});
```

`runCaptureCommand()` is a thin async wrapper that calls the existing zero-arg
`addScreenshot()` and maps its three documented return shapes onto the action
badge (see § "Badge signal contract"). It MUST NOT reimplement capture, the
localhost guard, or the report-write tail — those all live inside
`addScreenshot()` and are inherited by calling it as-is.

### 3. Badge signal contract (popup-independent, zero new permission)

The signal uses `chrome.action.setBadgeText` / `setBadgeBackgroundColor` /
`setTitle`. **No manifest permission change is required** — the `action` is
already declared (`manifest.json:14-22`), so the badge API is available. (We
deliberately do **not** use `chrome.notifications`, which would add a
`notifications` permission to the manifest — see § "How we're doing it" for the
rationale.)

`runCaptureCommand()` maps `addScreenshot()`'s return as follows:

| `addScreenshot()` returns | Badge behavior |
|---|---|
| start of every invocation | **Reset to neutral**: `setBadgeText({text:""})` + `setTitle({title:"Snapdeck"})` so a prior error badge never lingers and a cancelled run ends neutral. |
| `{ error: <msg> }` (includes the not-a-target localhost-guard error from `background.js:113`, the capture-failed error `:119`, and the overlay-unavailable error `:125`) | `setBadgeText({text:"!"})` + `setBadgeBackgroundColor({color:"#C0392B"})` (red) + `setTitle({title:<msg>})` so hovering the toolbar icon shows the reason. Best-effort auto-clear after ~4s (a `setTimeout` reset); correctness does **not** depend on the timer firing — the next command also resets. **NON-SILENT.** |
| `{ ok, count }` | `setBadgeText({text:"✓"})` + `setBadgeBackgroundColor({color:"#1E8E3E"})` (green); best-effort auto-clear after ~2s. (Confirmatory only — the in-page overlay already gave primary feedback; this stays popup-independent.) |
| `{ cancelled: true }` | **No** text/color/title beyond the neutral reset at start → net effect neutral. **No success and no error signal** (satisfies the cancelled-no-false-signal AC). |

### Auth requirement (explicit)

**No network auth — this is a local, user-initiated Chrome-extension command, not
an HTTP endpoint.** There is no remote caller, no token, no scheme. Access
control is the **intrinsic localhost host-permission guard inside
`addScreenshot()`** (`background.js:112`: `tab.url` must match
`/^http:\/\/(localhost|127\.0\.0\.1)/`). The command is triggered only by a
focus-only keyboard shortcut on the user's own focused tab. `host_permissions`
remain localhost-only and unchanged (`manifest.json:7`). No `notifications` (or
any other) permission is added.

## Existing behavior baseline

- **Currently:** `extension/background.js:110-142` — `addScreenshot()` resolves
  the active tab via `activeTab()` (`:111` → `activeTab()` at `:49-52`), applies
  the localhost guard `/^http:\/\/(localhost|127\.0\.0\.1)/` (`:112`), captures
  the visible tab (`:117`), drives the in-page annotate overlay via
  `chrome.tabs.sendMessage(tab.id, {type:"ANNOTATE", image})` (`:123`), then
  returns one of three shapes: `{ error }` (`:113`, `:119`, `:125`),
  `{ cancelled: true }` (`:127`), or `{ ok, count }` (`:141`, after pushing onto
  the report and `setReport`).
- **Existing top-level registration (the sibling I sit beside):**
  `extension/background.js:81-84` — `chrome.runtime.onMessage.addListener(...)`
  at module scope; its `ADD_SCREENSHOT` case dispatches to `addScreenshot()`
  (`:98-99`). My new `chrome.commands.onCommand.addListener` mirrors this
  top-level shape and reuses the same dispatch target.
- **Manifest baseline:** `extension/manifest.json:6` —
  `permissions: ["activeTab","tabs","scripting","storage","unlimitedStorage"]`
  (NO `notifications` → badge, not notification); `:7` — `host_permissions`
  localhost-only; `:8` — `background.service_worker: "background.js"` (classic
  service worker, NOT `"type":"module"`); `:14-22` — `action` block already
  declared → `chrome.action.setBadgeText` available with no new permission.
- **Dispatch path / call graph:** keypress → Chrome `commands` →
  `chrome.commands.onCommand` (**NEW** listener, `background.js` module scope) →
  `runCaptureCommand()` (**NEW**) → `addScreenshot()` (**unchanged**) →
  `activeTab()` + localhost guard + `captureVisibleTab` + `sendMessage(ANNOTATE)`
  → `getReport`/`setReport` (**unchanged** IndexedDB `kv`/`report` tail).
- **No-regression assertion:** the existing `chrome.runtime.onMessage` listener
  (`:81-84`) and the popup's `ADD_SCREENSHOT` path stay byte-identical; the body
  of `addScreenshot()` is NOT modified; report storage (`idb`/`idbGet`/`idbSet`/
  `getReport`/`setReport`/`clearReport`, the IndexedDB `kv` store, the single
  `report` record shape) is untouched; `host_permissions` unchanged;
  `background.js` remains a classic service worker (do NOT add `"type":"module"`).
- **Explicitly changing:** ADD a `commands` block to `manifest.json`; ADD a
  top-level `chrome.commands.onCommand.addListener` + the `runCaptureCommand()`
  wrapper + badge-mapping in `background.js`.
- **Verified:** 2026-06-19 — opened `extension/background.js` and
  `extension/manifest.json` in full this run.

## How we're doing it

- **Files to touch:** `extension/manifest.json` (add the `commands` block) and
  `extension/background.js` (add the top-level `onCommand` listener +
  `runCaptureCommand()` + badge mapping).
- **Reuse the existing registration shape.** Copy the top-level placement of
  `chrome.runtime.onMessage.addListener` (`background.js:81-84`) — register
  `chrome.commands.onCommand.addListener` at module scope, never inside an async
  callback (the MV3 worker is ephemeral and would drop a listener registered on
  a later tick after eviction).
- **Call `addScreenshot()` as-is (zero-arg).** It resolves the active tab and
  owns the localhost guard internally. Do NOT pass it a tab, do NOT add a
  parameter, do NOT duplicate the guard. This matches the locked cross-team
  contract (`addScreenshot()` stays zero-arg; confirmed across sibling teams).
- **Result signal = action badge, NOT notifications.** Rationale (durability /
  low-risk): the badge needs **zero new permissions** (the `action` is already
  declared), is always visible on the toolbar icon, and cannot be suppressed at
  the OS level. `chrome.notifications` would add a `notifications` permission to
  the manifest (a user-facing install/update permission prompt + a larger
  Web-Store-review and OS-dependency surface) for no contract benefit.
  **Confirmed with devops-architect (2026-06-19):** adding a manifest permission
  such as `notifications` triggers Chrome's "extension disabled pending
  re-acceptance of new permissions" behavior on auto-update for existing
  installs — an operational step the badge avoids entirely. If a future feature
  wants richer toasts, that is a deliberate, separately-scoped permission
  expansion — not something this thin caller should drag in.
- **Keep `addScreenshot()`'s error STRINGS as the tooltip.** Pass the `{error}`
  message straight into `setTitle` so the not-a-target reason the popup would
  have shown is preserved verbatim — no new copy to maintain.
- **Do NOT touch report storage / IndexedDB / the `report` record shape** — that
  surface is owned this wave by sibling `w0-per-target-reports`. Treat
  `addScreenshot()` as a stable function-level seam.
- **Do NOT convert the service worker to an ES module.** `background.js` is a
  classic service worker (`manifest.json:8` has no `"type":"module"`). Adding
  `export`/`import` or `"type":"module"` is out of scope and a regression risk
  (strict-mode + scoping differences across the whole file). Keep the new code
  classic-SW compatible. (See § "Unit tests" for how to test without converting.)

## How we validate it was done correctly

Maps to feature.md acceptance criteria (AC#) and the PO E2E specs.

- [ ] **(AC1)** `manifest.json` declares a `commands.capture-screenshot` entry
      with `suggested_key.default = "Ctrl+Shift+S"`,
      `suggested_key.mac = "Command+Shift+S"`, and a human-readable `description`.
- [ ] **(AC2)** The command does NOT set `"global": true` (focus-only). →
      PO spec `capture-command-binding-is-focus-only`.
- [ ] **(AC3)** `chrome.commands.onCommand.addListener(...)` is registered at the
      **top level** (module scope) of `background.js`, adjacent to the existing
      `chrome.runtime.onMessage.addListener` — verifiable by the
      service-worker-wake E2E (`shortcut-rebinds-after-service-worker-wake`).
- [ ] **(AC4)** Firing the `capture-screenshot` command on a focused
      `http://localhost/*` / `http://127.0.0.1/*` tab calls the **zero-arg**
      `addScreenshot()`, the popup does NOT open, and a completed annotation
      appends exactly one screenshot to the in-progress report. → PO spec
      `shortcut-captures-on-localhost-target`.
- [ ] **(AC5)** `addScreenshot()` is called unchanged; the diff makes **no**
      edits to `idb`/`getReport`/`setReport`/`clearReport`/the IndexedDB `kv`
      store/the `report` record shape, and no edits to `host_permissions`.
- [ ] **(AC6)** On a focused non-localhost tab, **no capture occurs** and a
      popup-independent visible signal fires (red `!` badge + tooltip carrying
      the localhost-guard message) — not silent. → PO spec
      `shortcut-on-non-target-surfaces-visible-signal`.
- [ ] **(AC7)** On a capture/overlay error (e.g. content script not loaded →
      `addScreenshot()` returns the `:125` error), the same badge error signal
      fires rather than failing silently.
- [ ] **(AC8)** A cancelled annotate (`addScreenshot()` returns
      `{cancelled:true}`) leaves the report unchanged AND produces **no** success
      and **no** error badge (badge ends neutral). → PO spec
      `cancelled-annotate-leaves-report-unchanged`.
- [ ] **(AC9)** The localhost-only restriction is unchanged and the binding
      remains user-rebindable via `chrome://extensions/shortcuts` (intrinsic to
      `suggested_key`).
- [ ] **(AC10 — Phase 7.5 security-finalize, LOW-1 promoted)** `runCaptureCommand()`
      is re-entrancy-guarded: firing `capture-screenshot` again while a prior
      invocation is still in flight does NOT start a second `addScreenshot()` /
      overlay, and cannot drop a screenshot via overlapping report writes — each
      completed annotation appends exactly one. Guard lives in the new wrapper
      (module-scope in-flight boolean, cleared in `finally`); the out-of-scope
      report/IndexedDB seam is NOT touched. → PO spec
      `shortcut-reentrancy-guard-no-overlapping-captures`.

## Motion contract

n/a — non-UI (extension manifest + background service worker) story. The only
on-screen surfaces (the existing annotate overlay and the toolbar badge)
introduce no animation owned by this story.

## Unit tests

**Runner:** the repo's only JS test convention — Node's built-in
`node --test` (`node:test` + `node:assert/strict`, ESM), exactly as
`.claude/scripts/__tests__/channel-size-warn.test.js` uses. **Zero new
dependencies** (no jest/vitest; there is no `package.json` to add one to).

**Test seam (no SW-to-module conversion required).** `background.js` has no
import/export syntax, so it loads cleanly as CommonJS via `await import(...)` from
an ESM test — running its top-level statements against stubbed globals. The test
sets `globalThis.chrome` and `globalThis.indexedDB` to hand-written stubs
(testing-conventions § "Hand-written stub classes") **before** importing
`background.js`; the `chrome.commands.onCommand.addListener` stub captures the
registered command callback so the test can invoke it directly. Each scenario
stubs the `chrome.tabs.*` surface so the real `addScreenshot()` produces the
desired return shape. This introduces the **first** extension unit-test file —
co-locate it next to the source. If the team decides standing up the extension
test harness is itself out of scope, escalate to `team-lead` (testing.md/devops
territory) rather than skipping the assertions.

- `extension/background.shortcuts.test.mjs` — `onCommand_registeredAtModuleLoad_topLevel` —
  importing `background.js` with a stubbed `chrome` registers a
  `chrome.commands.onCommand` listener at load (proves top-level registration /
  AC3).
- `extension/background.shortcuts.test.mjs` — `onCommand_unknownCommand_doesNotCapture` —
  invoking the captured callback with a command name other than
  `"capture-screenshot"` does NOT call `chrome.tabs.captureVisibleTab` and sets
  no badge.
- `extension/background.shortcuts.test.mjs` — `onCommand_nonLocalhostTab_setsErrorBadge_noCapture`
  — with `chrome.tabs.query` returning a non-localhost tab, the callback sets the
  red `!` badge + a tooltip equal to the localhost-guard message and never calls
  `captureVisibleTab` (AC6).
- `extension/background.shortcuts.test.mjs` — `onCommand_localhostTab_completedAnnotate_setsSuccessBadge`
  — localhost tab + `captureVisibleTab` + `sendMessage` returning a completed
  annotation → `addScreenshot()` returns `{ok,count}`, badge set to green `✓`,
  and exactly one screenshot is appended (AC4).
- `extension/background.shortcuts.test.mjs` — `onCommand_cancelledAnnotate_leavesBadgeNeutral`
  — `sendMessage` returns `{cancelled:true}` → no success and no error badge after
  the neutral reset; report unchanged (AC8).
- `extension/background.shortcuts.test.mjs` — `onCommand_overlayUnavailable_setsErrorBadge`
  — `sendMessage` rejects (content script absent) → `addScreenshot()` returns the
  `:125` error and the error badge fires (AC7).

## Dependencies

`depends_on: []` — justified: this is a **caller-only** change. It requires (a)
no schema/migration (no `STORY-db-*` dependency — report storage is explicitly
out of scope, owned by `w0-per-target-reports`), (b) no new env var / build /
CI / config (no `STORY-do-*` dependency — the action badge needs no new manifest
permission; the `commands` block is feature-behavior owned here), and (c) no
frontend story (no popup/overlay/content-script changes). Parallel-safe with the
other w0 features per scope.md § Branch policy; the only coupling is a shared-file
merge window in `background.js` to coordinate with BOSS at push time.

## Security Review

**Reviewer:** security-architect — single-feature-review (Phase 7), 2026-06-18.
**Verdict:** No HIGH/CRITICAL findings; no PO escalation; no defensive
`STORY-sec-NNN` required. This is a low-risk, least-privilege, caller-only change.
Findings are info/low FYIs — they do **not** block delivery.

**STRIDE summary (threat surface is intrinsically small):**

- **Spoofing — none.** `chrome.commands.onCommand` fires only from a genuine local
  user keystroke (or the user's own rebound key); a web page cannot programmatically
  trigger a `commands` event. No remote caller, no token, not multi-tenant.
- **Tampering — none new.** The new code writes only the action badge (cosmetic,
  local) and appends through the **unchanged** zero-arg `addScreenshot()` seam.
- **Repudiation — N/A.** Single-user local extension; no new entity table → no
  audit columns (created-by/changed-by/changed-at) are owed.
- **Information disclosure — none of concern.** On a non-localhost tab the localhost
  guard (`background.js:112`) returns **before** `captureVisibleTab`/`sendMessage`,
  so no page URL/content is ever read or leaked. The badge tooltip echoes
  `addScreenshot()`'s error strings, but those are static constants / Chrome runtime
  `e.message` values, rendered in Chrome's **native (non-HTML) tooltip** on the
  user's own toolbar — no XSS, no cross-origin leak. See INFO-1.
- **Denial of service — local-only, low.** No loops/queries/remote surface, so
  network rate-limiting is N/A. The one real observation is rapid re-press
  re-entrancy. See LOW-1.
- **Elevation of privilege — none; design is least-privilege (positive).** The
  command adds **no** manifest permission (badge reuses the already-declared
  `action`; no `notifications`), keeps `host_permissions` localhost-only, and is
  **focus-only** (does not set `"global": true`). It dispatches to zero-arg
  `addScreenshot()` which re-applies the localhost guard — the shortcut grants no
  capability the popup path didn't already have, and it **cannot be weaponized to
  screenshot a non-localhost page** (the user firing it on a malicious tab is
  blocked by the guard; the page can't fire it at all). See INFO-3.

### LOW-1 — Rapid re-press can stack overlapping captures (aggravates a pre-existing report-write race)

- **Severity:** low
- **Threat (STRIDE: DoS / Tampering):** `runCaptureCommand()` is fire-and-forget.
  A user mashing `Cmd/Ctrl+Shift+S` can launch overlapping `addScreenshot()`
  invocations — multiple annotation overlays, and concurrent runs of the
  non-atomic `getReport()` → push → `setReport()` tail (`background.js:128-140`),
  whose last-writer-wins behavior can silently drop a screenshot. The race lives in
  out-of-scope `addScreenshot()`/report storage (owned by `w0-per-target-reports`),
  but the shortcut **lowers the friction** to trigger it (no popup open/click
  between presses).
- **Recommendation (fold into "How we're doing it" — no new story):** add a simple
  module-scope in-flight boolean in the new wrapper, e.g.
  `let captureInFlight = false;` — early-return when `true`, set it before calling
  `addScreenshot()`, and clear it in a `finally`. ~4 lines, entirely within this
  story's new code; does **not** touch the out-of-scope report/IndexedDB seam.
- **PO disposition (Phase 7.5): PROMOTE_TO_AC.** This feature's headline value is
  *fast, repeated* capture, which materially raises the likelihood of the
  non-atomic `getReport→push→setReport` last-writer-wins drop — so protecting the
  "exactly one screenshot appended" guarantee against the shortcut's own
  friction reduction is a hard requirement, not an optional polish. The mitigation
  is fully in-scope (a module-scope re-entrancy guard in the NEW wrapper; it does
  NOT touch the out-of-scope report/IndexedDB seam owned by `w0-per-target-reports`).
  Promoted to **feature.md AC10** (observable behavior) + PO E2E spec
  `shortcut-reentrancy-guard-no-overlapping-captures` + a matching validates item
  below. Implementation note: phrasing in AC10 is behavioral; the in-flight-boolean
  approach is the recommended realization, and a matching unit-test assertion is
  warranted at implementation time (the `## Unit tests` section is left at its
  original 6 tests per BOSS's hybrid ruling — not expanded here).

### INFO-2 — `runCaptureCommand()` should try/catch the `addScreenshot()` call (defense-in-depth on the non-silence AC)

- **Severity:** info
- **Threat (STRIDE: Information disclosure via silent failure):** the badge contract
  maps `addScreenshot()`'s three *return* shapes, but does not state what happens if
  it *throws* (e.g. an unexpected `chrome.tabs` exception not caught internally). An
  uncaught rejection in the fire-and-forget listener would be **silent** — the exact
  outcome AC6/AC7 forbid.
- **Recommendation:** wrap the `addScreenshot()` call in `try/catch` inside
  `runCaptureCommand()` and map a thrown error onto the same red `!` error badge as
  the `{error}` return. Cheap reinforcement of the "non-silence" requirement; avoids
  an unhandled promise rejection in the MV3 worker.
- **PO disposition (Phase 7.5): ACCEPT_AS_RECOMMENDATION.** Not a new AC — existing
  **AC7** already forbids a silent error path, and I read AC7 to encompass an
  uncaught throw from `addScreenshot()` (a throw that yields no badge is an AC7
  failure at validation). The `try/catch` mapping the throw onto the same red `!`
  error badge is the recommended way to satisfy AC7 for that case; a matching
  unit-test assertion (`addScreenshot` throws/rejects → error badge) is warranted
  at implementation time. No feature.md change needed, and the `## Unit tests`
  section is left as-is per BOSS's hybrid ruling.

### INFO-1 — Badge tooltip surfaces error strings verbatim (confirmed safe — FYI)

- **Severity:** info (no action required)
- **Note:** passing `addScreenshot()`'s `{error}` message into `chrome.action.setTitle`
  is safe: the strings are static (`:113`, `:119`, `:125`) or contain Chrome runtime
  `e.message` text, never attacker-controlled web content; Chrome renders the title as
  a plain-text native tooltip (no HTML sink). Recorded so a future reviewer doesn't
  re-flag it.
- **PO disposition (Phase 7.5): ACCEPT_AS_RECOMMENDATION.** Confirmed-safe FYI, no
  action. Standing guardrail for implementation: keep tooltip text sourced from
  `addScreenshot()`'s static error constants / Chrome `e.message` only — never
  interpolate page-derived / web content into `setTitle`.

### INFO-3 — Least-privilege design affirmed (positive FYI)

- **Severity:** info (commendation)
- **Note:** the choice of the action badge over `chrome.notifications` (avoids a new
  manifest permission and Chrome's auto-update permission-disable hazard), the
  focus-only (non-global) command type, the unchanged localhost-only
  `host_permissions`, and reuse of the unchanged in-`addScreenshot()` guard together
  make this the least-privileged realization of the feature's AC. No expansion of the
  extension's data/host reach. Keep it this way in implementation — do **not** add
  `notifications` or widen `host_permissions`/`matches`.
- **PO disposition (Phase 7.5): ACCEPT_AS_RECOMMENDATION.** Adopted as a standing
  do-not-regress guardrail: the implementation MUST NOT add a `notifications` (or
  any new) manifest permission, MUST keep the command focus-only (no
  `"global": true`), and MUST leave `host_permissions`/`matches` localhost-only.
  This reinforces existing AC2/AC5/AC9; no new AC needed.

## History

- 2026-06-19 — created by backend-architect (effort=2, depends on none)

## Revisions

- 2026-06-19 — product-owner (Phase 6 arbitrate): promoted `status: pending →
  approved`. No content change. Reviewed and accepted: zero-arg `addScreenshot()`
  consumed as-is (locked cross-team contract honored); top-level
  `chrome.commands.onCommand` registration; the intra-story `"capture-screenshot"`
  command-id contract (no cross-story seam); the action-badge result signal as a
  valid, non-silent realization of feature.md's mechanism-agnostic AC, chosen
  over `chrome.notifications` to avoid the auto-update permission-disable hazard;
  the 9 validates items map 1:1 to feature.md AC1–AC9; `depends_on: []` justified
  (caller-only, no schema/env/FE producer). PO accepts the badge for v1 with a
  deferred, non-blocking usability follow-up on signal prominence (see
  `../conversations/0014-product-owner-arbitration-summary.md`).
- 2026-06-19 — product-owner (Phase 7.5 security-finalize): dispositioned the
  security-architect's 4 findings (a PO disposition line now closes each block).
  **LOW-1 → PROMOTE_TO_AC** (re-entrancy guard): added **feature.md AC10** + PO
  E2E spec `shortcut-reentrancy-guard-no-overlapping-captures` + a matching
  validates item (AC10) — all describing behavior realized within this story's new
  wrapper code; the out-of-scope report/IndexedDB seam is untouched. **INFO-2 →
  ACCEPT_AS_RECOMMENDATION** (try/catch satisfies existing AC7 for the throw case).
  For LOW-1 and INFO-2 a matching unit-test assertion is *warranted* at
  implementation time, but the `## Unit tests` section is left at its original 6
  tests per BOSS's hybrid ruling — NOT expanded here. **INFO-1 → ACCEPT_AS_RECOMMENDATION**
  (tooltip strings confirmed safe; standing guardrail — never interpolate web
  content into `setTitle`). **INFO-3 → ACCEPT_AS_RECOMMENDATION** (least-privilege
  standing guardrail — no new permission, focus-only, localhost-only). No
  HIGH/CRITICAL findings; story remains `approved`.
