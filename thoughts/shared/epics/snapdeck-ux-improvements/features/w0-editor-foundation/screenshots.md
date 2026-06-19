---
type: screenshots
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
status: n/a
authored_by: product-owner
authored_at: 2026-06-18T00:00:00Z
---

# Validation screenshots: Annotation editor foundation (box model + lossless persistence + shared transformer)

**Not applicable** — this is a non-UI feature (`skip_ui_designer: true`, `frontend_lane: N/A`). It is a
mechanism refactor of the vanilla-JS Konva editor (`extension/content/editor.js`): a box-model
primitive, lossless `model` persistence, and a shared `Konva.Transformer` move/resize. There are no new
screens or branded visual components to capture — the only new visible affordance is standard
`Konva.Transformer` resize-handle chrome, whose behavior is proven by the feature's E2E specs (box
draw→select→resize, round-trip identity, arrow no-regression), not a static screenshot. Visual styling
of box annotations is owned by the downstream w1-text-box-autofit feature. Phase 5b capture skips this
feature.
