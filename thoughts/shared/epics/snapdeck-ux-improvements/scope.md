---
type: epic-scope
epic: snapdeck-ux-improvements
status: locked
created_at: 2026-06-19T02:12:32Z
---

# Epic: Snapdeck Chrome Extension UX Improvements

## Problem statement

The Snapdeck Chrome extension works, but its UX has several gaps that make it
harder to use than it should be. The toolbar icon is static, so it gives no
signal about whether the current tab is a usable Snapdeck target or whether a
report is already in progress. The in-progress report is a single global record
rather than per-worktree, so two worktrees on different ports can't each hold
their own report. There is no keyboard access to the most common action
(capture). The annotation editor's text boxes are effectively broken — text
wraps while typing but flattens to a single unwrapped line on commit, the "box"
is never stored, and committed text can't be resized; there is also no
rectangle/box primitive. Finally, once a screenshot is in a report there is no
way to review it, re-open it for editing, or delete it. This epic closes those
gaps so the freeze → annotate → file loop is legible and forgiving.

## Goals

- The toolbar icon is **dynamic and per-tab**: gray when the current page is not
  a Snapdeck target, green when it is a registered target, and orange with a
  live screenshot count while a report is in progress — returning to green after
  the report is saved.
- **Reports are per-target** (keyed by the worktree/browser-port), so switching
  tabs surfaces that target's own in-progress report and never mixes screenshots
  across worktrees.
- The most frequent action (capture & annotate the visible tab) is reachable via
  a **keyboard shortcut** without opening the popup; the toolbar **badge**
  surfaces the unsaved-screenshot count.
- The annotation **text tool behaves like Google Slides auto-fit**: the user
  draws a box, text wraps to the box and the font auto-sizes to fit (capped at a
  maximum), and the box can be re-selected, moved, resized, and re-edited. Text
  renders as black on a white fill inside a red outline.
- A **rectangle (red outline) tool** exists alongside arrows, with the same
  draw / move / resize behavior.
- The annotation **toolbar can be dragged** out of the way via a grab handle.
- The user can **toggle annotations on/off** in the editor to see the raw
  screenshot.
- From the popup, the user can **review the screenshots in the in-progress
  report**, click one to **re-open it in the same in-page editor**, edit and
  re-save it, or **delete** it (destructive control + confirmation).

## Non-goals (explicit)

- No changes to the controller / CLI / MCP server beyond consuming the existing
  `/resolve` registry endpoint. Green-state detection reuses the registry that
  already exists; it does not add new controller endpoints.
- No change to the downstream `report.json` annotation **projection** schema —
  the lossy `{from,to}` / `{x,y,text}` projection stays for the future
  "report → defects" consumer. (A fuller, round-trippable editor `model` is
  persisted **alongside** it; the projection itself is not removed.)
- The **localhost-only** restriction stays. Snapdeck still only operates on
  `http://localhost/*` and `http://127.0.0.1/*`.
- No separate editor tab/page. Re-editing reuses the existing in-page overlay
  (the stored PNG covers the host page exactly as during capture).
- No global (Chrome-unfocused) keyboard shortcuts — focus-only is sufficient and
  the chosen combo (`Cmd/Ctrl+Shift+S`) cannot be global per Chrome's rules.
- No migration of existing/persisted reports is required (pre-epic in-progress
  reports may be discarded on upgrade).

## Success metrics

- On any tab, the icon color/state correctly reflects {not-a-target,
  registered-target, report-in-progress(N)} within a tab switch, and the orange
  count increments live as screenshots are added.
- Starting a report on port A, switching to port B, and switching back to A
  restores A's in-progress report and count unchanged.
- `Cmd/Ctrl+Shift+S` triggers capture+annotate on a target tab without opening
  the popup.
- A text annotation drawn as a box keeps its wrapping and box geometry after
  commit, re-fits its font when the box is resized, and can be re-edited — i.e.
  no flatten-to-one-line regression.
- A screenshot already in a report can be re-opened, edited, re-saved with the
  edits intact (lossless round-trip), and deleted with a confirmation step.

## Hypotheses (what we believe to be true, testable)

- Green-state detection can reuse the same `/resolve` controller probe that Save
  already relies on, made cheap enough for per-tab use via a two-tier check
  (instant gray for non-localhost; cached registry probe only for localhost tabs
  with no active report). Falsified if the probe cost/latency makes tab
  switching feel sluggish even with caching.
- Re-editing a stored screenshot does **not** require the original page to be
  open, because the editor overlay already covers the host page entirely with
  the captured PNG and never uses the live DOM visually. Falsified if some
  capture-time state (beyond image + model + viewport + console/network buffers)
  turns out to be required to reproduce the editor faithfully.
- A single Konva.Transformer-based box-resize mechanism can serve both the text
  box and the rectangle tool. Falsified if text auto-fit and rectangle resize
  need materially different handle behavior.

## Constraints / critical directives

- **Manifest V3.** Service worker is ephemeral — any cross-tab cache (e.g.
  port→owner resolution) must live in `chrome.storage.session`, not a plain
  module variable, and all `tabs`/`commands`/`action` listeners must be
  registered at top level so they rebind on worker wake. Per-tab icon/badge
  state set via `tabId` persists across worker restarts.
- **Reuse existing seams.** Capture and save already exist as standalone
  functions (`addScreenshot`, `saveReport` in `extension/background.js`);
  shortcuts dispatch to them. The editor already paints the screenshot PNG over
  a full-viewport overlay (`extension/content/editor.js`); re-edit reuses it.
- **Lossless model persistence is foundational.** The editor must persist its
  full internal `model` (arrows, text boxes with width/height, rectangles) so
  re-edit round-trips exactly; the existing lossy projection is emitted
  *additionally*, not instead.
- **Green = registered, not just localhost.** "Registered target" means a live
  controller's `/resolve` registry owns the browser port — the same truth Save
  depends on. The capture guard should be brought in line with this so "icon is
  green" and "capture+save will work" are the same condition.
- **Branch / push policy.** Strip any local-only patch blocks and revert any
  local-path config before any push; rebase onto the upstream integration branch
  first. `git push` always requires explicit approval. See `CLAUDE.md` §
  "Local-dev patches and runbook" and "Critical workflow constraints".

## Suggested feature decomposition (seeds — PO refines)

Two natural clusters. The editor cluster shares a foundational refactor
(box model + lossless `model` persistence + Konva.Transformer box-resize) that
several features build on; the gallery's re-edit depends on that persistence,
and the icon's orange-count semantics depend on per-target reports.

*Cluster A — Icon / state / popup shell*

- **Per-target reports** — re-key the in-progress report store from one global
  record to a map keyed by worktree/browser-port; popup, Save, Clear, and count
  all become "the current target's report". (Foundational for the icon's
  report-in-progress state.)
- **Dynamic per-tab toolbar icon + badge** — gray / green / orange+count state
  machine driven by `tabs.onActivated`/`onUpdated`, green via cached `/resolve`
  probe; count via `chrome.action.setBadgeText`.
- **Keyboard shortcuts** — `commands` API; capture = `Cmd/Ctrl+Shift+S`
  dispatched to `addScreenshot`; save / open-popup bindings finalized in feature
  scoping.
- **Screenshot gallery + re-open / edit / delete** — popup renders thumbnails of
  the current target's report; clicking re-opens the in-page editor on the
  stored PNG (screenshot-native sizing, stored console/network preserved); Done
  replaces the record; Delete is a destructive, confirmed editor-toolbar action.

*Cluster B — Annotation editor*

- **Editor foundation** — introduce the box model, lossless `model` persistence,
  and a Konva.Transformer-based move/resize for box-shaped annotations (shared by
  text boxes and rectangles).
- **Text-box auto-fit rework** — draw-a-box text tool; wrap + font auto-fit
  capped at a max; white fill, red outline, black text; editable + resizable in
  select mode (single-click selects/handles, double-click edits).
- **Rectangle (outline box) tool** — red-outline rectangle drawn by drag, moved
  and resized via the shared box transformer, like arrows today.
- **Draggable toolbar + annotation visibility toggle** — grab handle to reposition
  the editor toolbar (DOM drag, position remembered across captures); a toggle to
  hide/show the annotation layer to inspect the raw screenshot.

The product-owner during /mat_write_epic Phase 4 may split, merge, or reorder
these. Treat them as starting suggestions, not commitments.

## Cross-epic dependencies

- `provides:` a richer per-target report model and a re-editable, round-trippable
  annotation editor that downstream report→defects tooling can rely on.
- `depends_on:` none. The controller `/resolve` registry and `/report/save`
  endpoints already exist and are unchanged by this epic.
