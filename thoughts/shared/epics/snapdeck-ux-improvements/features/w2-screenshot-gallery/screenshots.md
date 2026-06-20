---
type: screenshots
epic: snapdeck-ux-improvements
feature: w2-screenshot-gallery
status: required
authored_by: product-owner
authored_at: 2026-06-20T16:36:00Z
---

# Validation screenshots: Screenshot gallery — review, re-open / edit, delete

<!--
This feature has skip_ui_designer: true (no ui-designer mockups), but it DOES
introduce a real new UI surface — the popup thumbnail grid + delete-confirm
affordance + the re-open overlay. status: required. Every Screen is `n/a` (no
mockup screen-slug to pair against); the browser-tester captures one PNG per
requirement into screenshots/<req-id>.png at /mat_implement_feature Phase 5b.

The popup-chrome states render the extension popup at its intrinsic 280px body
width (height auto-grows to content). The re-open state is the in-page editor
overlay on the full host tab (the released editor surface, captured here only to
prove the lossless round-trip the gallery drives).
-->

## gallery-populated — Populated thumbnail grid

- **Screen:** n/a
- **Route:** Active tab is a localhost target (`http://localhost:5101/`) whose `report:5101` record holds 3 screenshots; open the extension popup (click the toolbar icon).
- **Viewport:** 280x600  <!-- extension popup; width = popup body (280px), height auto-grows to content -->
- **State:** Popup open, showing the existing header (with count `3`) / note / Add / Save / Clear chrome, and below it the **thumbnail grid** with exactly 3 tiles in capture order, each rendering its stored annotated thumbnail and a `Delete` affordance in its resting state.
- **Proves:** AC "Gallery render" + E2E "Gallery renders N thumbnails" (the popup renders one thumbnail per screenshot in the current target's per-port report).

## gallery-empty-state — Empty state (non-target / empty report)

- **Screen:** n/a
- **Route:** Active tab is a non-target (`https://example.com/`, no resolvable localhost port) — or a localhost target whose report is empty; open the extension popup.
- **Viewport:** 280x600
- **State:** Popup open with header count `0`; the grid region shows the **empty state** message ("No screenshots in this target's report yet") and **zero** thumbnail tiles.
- **Proves:** AC "Empty state" + E2E "non-target shows the empty state" (a non-target / empty report renders the empty state with no thumbnails).

## delete-confirm — Delete confirmation affordance (armed)

- **Screen:** n/a
- **Route:** From the populated grid (localhost target, report of 3), click `Delete` on a thumbnail tile (e.g. tile #2) to arm the confirmation step.
- **Viewport:** 280x600
- **State:** Popup open with the grid visible; the targeted tile is in its **armed confirm state** — the destructive action is gated behind a deliberate second action (the inline `Confirm? ✓ / ✕` two-button state, or the architect-chosen confirm affordance) clearly visible on that tile, with the other tiles still in their resting state and the count still `3` (nothing deleted yet).
- **Proves:** AC "Delete behind a confirm" + E2E "Delete behind a confirm … cancel is a no-op" (Delete is destructive and requires a confirmation step before any screenshot is removed).

## count-after-delete — Count decremented after a confirmed delete

- **Screen:** n/a
- **Route:** From the populated grid (report of 3), `Delete` tile #2 and **confirm** it; stay on the popup.
- **Viewport:** 280x600
- **State:** Popup after the confirmed delete — the grid now shows **2** tiles (the former #1 and #3), and the header count reads `2` (the toolbar badge consumer having received the `REPORT_COUNT_CHANGED { count:2 }` tick). No confirm affordance armed.
- **Proves:** AC "Count + badge update on delete" + E2E "Delete … count decrements, badge ticks" (a confirmed delete removes exactly that screenshot and decrements the count, driving the badge).

## reopen-overlay — Re-open on the stored PNG (lossless re-edit)

- **Screen:** n/a
- **Route:** From the populated grid, click thumbnail #2 → the popup closes and the in-page editor overlay mounts on the current localhost target tab (`http://localhost:5101/`).
- **Viewport:** 1440x900  <!-- full host tab; the in-page editor overlay, not the popup -->
- **State:** The released in-page editor overlay open on the screenshot's **stored `original` PNG** at screenshot-native sizing, with the persisted annotations (e.g. an arrow + a text box) **restored exactly** (model-byte) and the editor toolbar (`✓ Done` / Cancel) visible.
- **Proves:** AC "Click → lossless re-open (model-byte)" + AC "Overlay reuse … page-independent" + E2E "Click → re-open restores the model" (clicking a thumbnail re-opens that shot in the existing editor on the stored PNG with its model restored). NB: the overlay itself is the released editor surface (owned by editor-foundation); captured here to prove the round-trip this gallery drives.
