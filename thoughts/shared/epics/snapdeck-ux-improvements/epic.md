---
type: epic
slug: snapdeck-ux-improvements
status: planning
created_at: 2026-06-18T00:00:00Z
last_run_id: run-20260619-021434-24507
# Cross-epic graph (consumed by scripts/check-epic-deps.sh).
provides:
  - per-target-report-model
  - re-editable-annotation-editor
depends_on: []
---

# Epic: Snapdeck Chrome Extension UX Improvements

## Problem statement

The Snapdeck Chrome extension works end-to-end — a user can freeze a localhost
page, annotate it, and file a user-test-report into the right worktree — but the
day-to-day loop is harder and less forgiving than it should be. Four gaps stand
out for the person actually using it:

- **No signal from the toolbar icon.** The icon is static, so nothing tells the
  user whether the current tab is a usable Snapdeck target or whether a report is
  already in progress. They find out by clicking, or by a failed save.
- **One global in-progress report.** The in-progress report is a single shared
  record rather than per-worktree, so two worktrees running on different ports
  cannot each hold their own report — screenshots from one bleed into the other.
- **No keyboard path to the most common action.** Capturing and annotating the
  visible tab — the thing the user does most — always requires opening the popup
  first.
- **A broken annotation editor.** Text boxes wrap while typing but flatten to a
  single unwrapped line on commit; the box geometry is never stored; committed
  text cannot be resized; there is no rectangle primitive; and once a screenshot
  is in a report there is no way to review it, re-open it for editing, or delete
  it.

This epic closes those gaps so the freeze → annotate → file loop is legible
(the user can see state at a glance) and forgiving (mistakes are recoverable —
re-edit, resize, delete). The audience is the developer/tester running Snapdeck
across one or more local worktrees.

## Goals

1. The toolbar icon is **dynamic and per-tab**: gray when the current page is not
   a Snapdeck target, green when it is a registered target, and orange with a
   live screenshot count while a report is in progress — returning to green once
   the report is saved.
2. **Reports are per-target**, keyed by the worktree/browser-port, so switching
   tabs surfaces that target's own in-progress report and never mixes
   screenshots across worktrees.
3. The most frequent action — capture & annotate the visible tab — is reachable
   via a **focus-only keyboard shortcut** (`Cmd/Ctrl+Shift+S`) without opening
   the popup, and the toolbar **badge** surfaces the unsaved-screenshot count.
4. The annotation **text tool behaves like Google Slides auto-fit**: the user
   draws a box, text wraps to the box and the font auto-sizes to fit (capped at a
   maximum), and the box can be re-selected, moved, resized, and re-edited. Text
   renders as black on a white fill inside a red outline, with no
   flatten-to-one-line regression on commit.
5. A **rectangle (red outline) tool** exists alongside arrows, with the same
   draw / move / resize behavior as the text box.
6. The annotation **toolbar can be dragged** out of the way via a grab handle,
   and that position is remembered across captures.
7. The user can **toggle annotations on/off** in the editor to inspect the raw
   screenshot.
8. From the popup, the user can **review the screenshots in the in-progress
   report**, click one to **re-open it in the same in-page editor** (lossless
   round-trip), edit and re-save it, or **delete** it behind a confirmation step.

## Non-goals

- **No changes to the controller / CLI / MCP server** beyond consuming the
  existing `/resolve` registry endpoint. Green-state detection reuses the
  registry that already exists; no new controller endpoints are added.
- **No change to the downstream `report.json` annotation projection schema.** The
  lossy `{from,to}` / `{x,y,text}` projection stays for the future
  "report → defects" consumer. A fuller, round-trippable editor `model` is
  persisted *alongside* it — the projection itself is not removed.
- **The localhost-only restriction stays.** Snapdeck still only operates on
  `http://localhost/*` and `http://127.0.0.1/*`.
- **No separate editor tab/page.** Re-editing reuses the existing in-page overlay;
  the stored PNG covers the host page exactly as during capture.
- **No global (Chrome-unfocused) keyboard shortcuts** — focus-only is sufficient,
  and the chosen `Cmd/Ctrl+Shift+S` combo cannot be global per Chrome's rules.
- **No migration of existing/persisted reports.** Pre-epic in-progress reports may
  be discarded on upgrade.

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

## High-level approach

The work splits into two strategic surfaces that share little code but reinforce
each other in the user's loop: the **extension shell** (icon, report store,
shortcuts, popup gallery) and the **annotation editor** (text, rectangles,
toolbar ergonomics). The shell makes the loop legible — you can see what state
you're in before you act — while the editor makes the loop forgiving — what you
drew can be revised, resized, and undone. Both rest on a single foundational
idea: state that used to be implicit, global, or thrown away becomes explicit,
per-target, and persisted.

On the shell side, the unifying move is to re-key the in-progress report from one
global record to a store keyed by the worktree/browser-port, so "the current
target's report" becomes a first-class concept. The dynamic icon then becomes a
small state machine over that store plus a registered-target signal, where
"registered target" means the same `/resolve` registry truth that Save already
depends on — bringing "icon is green" and "capture+save will work" into the same
condition. Because the extension is Manifest V3 and its service worker is
ephemeral, any cross-tab cache (port→owner resolution) lives in session storage
rather than module state, and per-tab icon/badge state is set against the tab so
it survives worker restarts. Keyboard shortcuts and the popup gallery dispatch to
capture/save/edit/delete seams that already exist as standalone functions.

On the editor side, the unifying move is lossless model persistence. The editor
must store its full internal model — arrows, text boxes (with geometry),
rectangles — so a screenshot can be re-opened and round-trip exactly, while the
existing lossy projection is emitted additionally for the downstream consumer.
That same foundation carries the box-shaped annotation work: a shared
move/resize mechanism serves both the auto-fit text box and the rectangle tool,
text wraps and auto-sizes within its box up to a cap, and the toolbar gains
drag-to-reposition and an annotation-visibility toggle. Re-editing deliberately
reuses the existing in-page overlay rather than a new editor page, on the premise
that the captured PNG already covers the host page and the editor never relies on
the live DOM visually — so the original page need not be open to re-edit.

Strategically, the editor's foundational refactor (box model + lossless model
persistence + shared box-resize) is the spine several other capabilities hang
off, and the popup gallery's re-edit depends on that persistence, while the
icon's orange-count semantics depend on the per-target report store. The
product-owner's wave grouping should reflect those dependencies; the scope's two
suggested clusters (shell vs. editor) are seeds, not commitments.

## Features (wave-grouped)

<!--
Populated by the product-owner during /mat_write_epic Phase 4 (decompose-into-features mode).

Layout contract:
- Group features by integer wave (w0, w1, w2, …). Same-wave features are parallel-safe.
- Higher waves depend on ALL lower waves being fully released first.
- Every feature link points to its stub feature.md under `features/<wX-slug>/feature.md`.
- For each feature, surface its `depends_on:` siblings inline (helps the user see the DAG without opening every feature.md).

Do NOT populate stories, mockups, or scope.md here — those are downstream skills.
This section IS the gate-1 backlog view.
-->

### Wave 0 (parallel-safe; no prerequisites)

- [ ] [w0-<feature-slug-1>](features/w0-<feature-slug-1>/feature.md) — <one-line summary>
- [ ] [w0-<feature-slug-2>](features/w0-<feature-slug-2>/feature.md) — <one-line summary>

### Wave 1 (depends on Wave 0)

- [ ] [w1-<feature-slug-3>](features/w1-<feature-slug-3>/feature.md) — <one-line summary> · depends_on: [w0-<feature-slug-1>]

### Wave 2 (depends on Wave 1)

<!-- add more wave sections (Wave 3, Wave 4, …) as the PO assigns them. -->

## Open questions

- **Shortcut secondary bindings.** The scope locks capture to `Cmd/Ctrl+Shift+S`
  but leaves save / open-popup keyboard bindings to be finalized during
  feature scoping. The PO/architects should settle the full `commands` set.
- **Single-click vs. double-click semantics in select mode.** The scope describes
  single-click to select/show handles and double-click to edit a text box; the
  exact interaction (and how it coexists with starting a new annotation) is a
  design detail to confirm in mockups.
- **Re-edit fidelity ceiling.** The "no original page needed to re-edit"
  hypothesis assumes image + model + viewport + console/network buffers fully
  reproduce the editor. If any capture-time state beyond that turns out to be
  required, the gallery re-edit feature's scope shifts — flag at decomposition.
