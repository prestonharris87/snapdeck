---
type: story
id: STORY-fe-001
name: "Per-tabId icon-state render primitives (tint + action dispatch)"
domain: frontend
parent_feature: w1-dynamic-icon-badge
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 2
status: approved
depends_on: []
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-150619-36719
frontend_lane: N/A
visual_references: []
defects: []
diff_estimate: substantive
---

# Story: Per-tabId icon-state render primitives (tint + action dispatch)

## What we're doing

Add two **purely additive** functions to the Snapdeck MV3 service worker
(`extension/background.js`) that render the three icon states the feature needs:
(1) `iconImageDataForState(state)` — programmatically tints the existing Snapdeck
logo PNGs to gray / green / orange `ImageData` via `OffscreenCanvas` (no new asset
files, no manifest change — confirmed with devops-architect, who sentinels their
domain); and (2) `applyIconState(tabId, { state, count })` — applies a resolved
state to a single tab via the **`tabId`-scoped** `chrome.action` API
(`setIcon` / `setBadgeText` / `setBadgeBackgroundColor` / `setTitle`). This is the
"view" layer only — the *decision* of which state a tab is in (tab events,
`/resolve` probe, count read, cache) is **STORY-fe-002**, and the live-count /
flash reconcile is **STORY-fe-003**. No released code is modified.

## What it should look like

Two new top-level declarations in `background.js` (place them in a clearly-commented
new section, e.g. `// --- per-tab icon state machine (w1-dynamic-icon-badge) ---`,
**below** the released code; do not interleave with released functions):

```js
// State color tokens — green anchored to the existing badge token (AC13);
// orange/gray selected per design.md (see clarifications.md CLAR-001).
const ICON_COLORS = {
  gray:   "#5F6368",   // not-a-target / inactive
  green:  "#1E8E3E",   // registered target (existing badge token — AC13 anchor)
  orange: "#E37400",   // in-progress report (also the orange badge background)
};

// Tints the packaged logo to a flat silhouette in the state color, at all 3 sizes.
// Returns { 16: ImageData, 48: ImageData, 128: ImageData } for chrome.action.setIcon.
async function iconImageDataForState(state) { /* OffscreenCanvas tint, see below */ }

// Applies one resolved state to ONE tab via the tabId-scoped action API.
async function applyIconState(tabId, { state, count = 0 }) { /* see contract below */ }
```

**`applyIconState` dispatch contract (this is the load-bearing spec):**

| state    | `setIcon`                  | `setBadgeText`                 | `setBadgeBackgroundColor`        | `setTitle`                              |
|----------|----------------------------|-------------------------------|----------------------------------|-----------------------------------------|
| `gray`   | gray imageData `{tabId}`   | `{ tabId, text: "" }`         | — (no-op; badge hidden)          | `{ tabId, title: "Snapdeck — not a Snapdeck target" }` |
| `green`  | green imageData `{tabId}`  | `{ tabId, text: "" }`         | — (no-op; badge hidden)          | `{ tabId, title: "Snapdeck — ready to capture" }`      |
| `orange` | orange imageData `{tabId}` | `{ tabId, text: String(count) }` | `{ tabId, color: "#E37400" }` | `{ tabId, title: `Snapdeck — ${count} unsaved screenshot(s)` }` |

- **Every** `action` call passes `{ tabId }` so state is per-tab and survives a
  service-worker restart (Chrome retains tab-scoped action state across SW death).
- Badge **text color** is left to Chrome's auto-contrast (matches the released
  flash, which sets no text color) — `#E37400` yields white text, legible.
- Do NOT set the GLOBAL (no-`tabId`) badge anywhere in this story — that namespace
  belongs to the released `runCaptureCommand()` flash (reconciled in fe-003).

**Icon tinting approach (`iconImageDataForState`):** for each size `s` in `[16,48,128]`:
`fetch(chrome.runtime.getURL('icons/icon-' + s + '.png'))` → `blob()` →
`createImageBitmap(blob)` → draw onto `new OffscreenCanvas(s, s)` 2d context →
set `ctx.globalCompositeOperation = 'source-in'`, `ctx.fillStyle = ICON_COLORS[state]`,
`ctx.fillRect(0,0,s,s)` (recolors the opaque logo pixels to the tint, preserving
alpha → a flat colored silhouette) → `ctx.getImageData(0,0,s,s)`. A flat silhouette
is the intended status-glyph look at 16px (confirmed acceptable with devops-architect).
You MAY memoize the generated `{16,48,128}` map in a module-level `const` keyed by
state — this is a **pure derivation of packaged assets**, not the cross-event mutable
state AC9 forbids (a worker restart simply regenerates it identically). Omitting the
memo and regenerating per call is also correct (slightly more work per event).

## Existing behavior baseline

- **Currently:** `extension/manifest.json:9-22` declares the STATIC
  `icons` + `action.default_icon` (the base PNGs `extension/icons/icon-{16,48,128}.png`,
  glob-confirmed present). The only runtime `action` mutation today is the GLOBAL
  (no-`tabId`) badge flash in the released `runCaptureCommand()`
  (`extension/background.js:124-156` — `setBadgeText`/`setBadgeBackgroundColor`/
  `setTitle` with `#1E8E3E`/`#C0392B`, `setTimeout`-reset).
- **Dispatch path / call graph:** the toolbar icon is static (manifest); no
  per-tab icon logic exists. This story adds the first per-`tabId` `action.setIcon`
  path; nothing consumes it yet (fe-002 wires the callers).
- **No-regression assertion:** `runCaptureCommand()` (bg.js:118-163), the released
  `runtime.onMessage`/`commands.onCommand` listeners (bg.js:104-116), `manifest.json`,
  and the icon PNG files are **NOT modified**. The new functions are additive
  top-level declarations; the global-badge flash behavior stays byte-identical.
- **Explicitly changing:** ADD `iconImageDataForState(state)` and
  `applyIconState(tabId, { state, count })` to `background.js`.
- **Verified:** 2026-06-19 (read `background.js`, `manifest.json`, `extension/icons/`).

## How we're doing it

- Edit only `extension/background.js` (add the two functions + `ICON_COLORS`) and
  the feature test file `extension/background.icon-badge.test.mjs` (new).
- Place the new code in a new top-level section **below** all released code. Do not
  edit released w0/kb lines.
- **No manifest change, no new permission, no new asset files** (AC13). `OffscreenCanvas`
  is a service-worker global needing no `offscreen` permission; `chrome.runtime.getURL`
  on the extension's own packaged assets is same-origin and needs no
  `web_accessible_resources` entry (both confirmed with devops-architect).
- Icons must **inherit the state color from the token table** — do not hardcode a
  stroke/extra color; green MUST be `#1E8E3E` (AC13 anchor). No emojis, no symbol-icon
  characters, no inline ad-hoc `<svg>` — this is an `action`-API/`ImageData` surface,
  not DOM.
- **Dev-server note:** this is a Chrome extension, not a web app — there is no dev
  server. Visual verification is by loading the unpacked extension in Chrome and
  driving it via the `browser-tester` teammate (see "How we validate"). Do not assume
  a long-lived dev process.

## How we validate it was done correctly

- [ ] `iconImageDataForState('gray'|'green'|'orange')` resolves to an object with
      numeric keys `16`, `48`, `128`, each an `ImageData`-shaped value.
- [ ] `applyIconState(tabId, { state: 'gray' })` calls `setIcon` with `{ tabId }`,
      `setBadgeText({ tabId, text: '' })`, and a `setTitle({ tabId, ... })` — and never
      a GLOBAL (no-`tabId`) action call.
- [ ] `applyIconState(tabId, { state: 'green' })` → `setBadgeText({ tabId, text: '' })`,
      green icon, ready-to-capture title.
- [ ] `applyIconState(tabId, { state: 'orange', count: 3 })` → `setBadgeText({ tabId,
      text: '3' })`, `setBadgeBackgroundColor({ tabId, color: '#E37400' })`, orange icon,
      title mentions `3`.
- [ ] Green state color is exactly `#1E8E3E` (AC13).
- [ ] No `manifest.json` diff, no new files under `extension/icons/`, no new permission.
- [ ] `node --test extension/*.test.mjs` is GREEN (the new top-level code must not
      break the released sibling suites — see fe-002's defensive-registration note;
      fe-001 adds no top-level listeners so it is inherently safe, but verify the
      cumulative run).
- [ ] browser-tester smoke: load the unpacked extension; confirm `applyIconState`
      produces a visibly gray/green/orange 16px toolbar icon (screenshot each).

## Motion contract

n/a — this is `action`-API / `ImageData` work with `frontend_lane: N/A`. The icon
"transition" is a discrete `chrome.action.setIcon` swap with no DOM, no animation
timeline, and no reduced-motion surface. (Per feature.md Motion E2E: n/a.)

## Unit tests

All cases live in **`extension/background.icon-badge.test.mjs`** (new; feature-distinct
filename — siblings own `background.reports/shortcuts/editormodel.test.mjs`). Reuse the
`node:vm` + hand-written-`chrome` harness from `background.reports.test.mjs:42-145`,
extended with: `chrome.action.setIcon`/`setBadgeText`/`setBadgeBackgroundColor`/`setTitle`
call-recorders; lenient `OffscreenCanvas` (ctx with no-op `drawImage`/`fillRect` +
`getImageData` returning a stub), `createImageBitmap`, `fetch` (resolves a stub blob),
and `chrome.runtime.getURL` stubs so `iconImageDataForState` runs without throwing.

- `extension/background.icon-badge.test.mjs` — `applyIconState_gray_clearsBadge_perTab` —
  asserts `setIcon`, `setBadgeText` called with `{tabId, text:''}`, `setTitle` with
  `{tabId}`, and NO no-`tabId` action call.
- `extension/background.icon-badge.test.mjs` — `applyIconState_green_emptyBadge_perTab` —
  green icon + `{tabId, text:''}` badge + ready-to-capture title.
- `extension/background.icon-badge.test.mjs` — `applyIconState_orange_setsCountBadge_perTab` —
  `setBadgeText({tabId, text:'3'})`, `setBadgeBackgroundColor({tabId, color:'#E37400'})`,
  orange icon, title contains `3`.
- `extension/background.icon-badge.test.mjs` — `iconImageDataForState_returnsAllThreeSizes` —
  resolves an object keyed `16/48/128` for each of the 3 states (lenient OffscreenCanvas stub).
- `extension/background.icon-badge.test.mjs` — `applyIconState_neverSetsGlobalBadge` —
  across all three states, every `chrome.action.*` call includes a `tabId` (guards the
  fe-003 reconcile boundary: this story must not touch the global badge namespace).

## Dependencies

none. (Greenfield render primitive; consumes no in-feature producer story. The base
icon PNGs and the `chrome.action` API are pre-existing/released and unchanged.)

## Security Review

> security-architect STRIDE pass (single-feature-review), 2026-06-19. Grounded against
> live `extension/background.js` + `extension/manifest.json` (read in full this pass).
> Verdict: **clean — INFO only.** No HIGH/CRITICAL → no PO arbitration needed.

**INFO-1 — Icon render is `ImageData`/`OffscreenCanvas` over packaged same-origin assets;
no XSS, no remote fetch, no new permission (security-positive).** `iconImageDataForState`
tints the extension's OWN packaged PNGs via `fetch(chrome.runtime.getURL('icons/icon-*.png'))`
— a same-origin read of bundled assets, no remote URL, no `web_accessible_resources` needed.
The output is `ImageData` applied via `chrome.action.setIcon`; there is **no DOM, no
`innerHTML`, no inline SVG**, so the icon path is not a script-injection vector (consistent
with the project lesson that `action`-API/`ImageData` surfaces carry no DOM-XSS). The badge
`setTitle` strings (`"Snapdeck — N unsaved screenshot(s)"`) write to Chrome's native
non-HTML tooltip sink, and `count` is the extension's own integer (`screenshots.length`) — no
untrusted echo, no encoding gap. The story adds **no manifest permission** (AC13) and **no
asset files**; `OffscreenCanvas` is a worker global needing no `offscreen` permission
(verified against the live manifest: `["activeTab","tabs","scripting","storage",
"unlimitedStorage"]`, no `externally_connectable`). **No action.**

**Trust-boundary note (security-positive):** the story's `applyIconState_neverSetsGlobalBadge`
unit case (every `chrome.action.*` call carries `{ tabId }`) is also a *namespace-isolation*
guarantee — it keeps this feature's per-tab paints out of the released global-badge namespace
that kb's `runCaptureCommand()` flash owns, so the two cannot silently clobber each other's
state. Good defensive instinct; keep it.

**Checklist dispositions (extension, no-server, no-PII, localhost-only):** authn/authz,
input-validation-to-DB, secrets, audit columns, soft-delete, rate-limit, injection, CSRF,
CORS, tenant-isolation — all **N/A** for a render-primitive that touches no HTTP endpoint, no
DB write, and no page-reachable input. Recorded so the checklist reads as *applied*, not
skipped.

## History

- 2026-06-19 — created by frontend-architect (effort=2, depends on none)
- 2026-06-19 — security-architect: appended `## Security Review` (INFO-1 + N/A checklist
  dispositions; clean, no HIGH/CRITICAL).
