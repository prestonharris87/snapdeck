// editor-chrome.js — PURE editor-chrome helper module (STORY-fe-001).
// No chrome / window / document / Konva. No top-level side effects.
// Dual-consumable: browser content script (isolated-world global) + node --test (CJS require/import).
//
// Five exported functions:
//   clampToViewport(pos, dims)     → { left, top }  (clamp toolbar to viewport)
//   serializeToolbarPos(pos)       → { left, top } | null  (validate before writing to storage)
//   parseStoredPos(raw)            → { left, top } | null  (guard value read from storage)
//   nextVisibility(shown)          → Boolean  (pure toggle)
//   layerVisibility(shown)         → { annVisible, selectVisible }  (derive layer flags)
//
// Trust boundary note (security-architect Finding 1 / PROMOTE_TO_AC):
//   parseStoredPos / serializeToolbarPos are the sole trust boundary for the
//   chrome.storage.local toolbar-position round-trip. They must NEVER throw on
//   garbage input and must NEVER pass a non-finite value to the left/top sink.
//
// Consumer contract (fe-002, fe-003): the return field names below are frozen.
// Do NOT rename without updating both consumer stories.

(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;                     // node --test (CJS import)
  } else {
    root.__snapdeckEditorChrome = api;        // content script (isolated-world global)
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * isFiniteNum — shared finite-number check (mirrors editor.js:115 `isFiniteNum`).
   * Returns true only when v is a JS number AND is finite (not NaN, not ±Infinity).
   */
  function isFiniteNum(v) {
    return typeof v === "number" && isFinite(v);
  }

  // ---------------------------------------------------------------------------
  // clampToViewport
  // ---------------------------------------------------------------------------

  /**
   * clampToViewport(pos, dims) → { left, top }
   *
   * Clamps the toolbar's desired top-left position so the toolbar rect stays
   * fully on-screen.
   *
   * @param {Object} pos  - { left: Number, top: Number } desired top-left (px, fixed-viewport)
   * @param {Object} dims - { vw, vh, tw, th } viewport width/height, toolbar width/height
   * @returns {{ left: number, top: number }}
   *
   * Clamping rules per axis:
   *   left ∈ [0, max(0, vw - tw)]
   *   top  ∈ [0, max(0, vh - th)]
   * If the toolbar is wider/taller than the viewport, the offending axis is clamped to 0.
   * Non-finite inputs (NaN, Infinity, wrong-typed) fall back to 0 on that axis — never NaN out.
   */
  function clampToViewport(pos, dims) {
    // Guard all inputs to finite numbers; fall back to 0 on non-finite.
    var left = isFiniteNum(pos && pos.left) ? pos.left : 0;
    var top  = isFiniteNum(pos && pos.top)  ? pos.top  : 0;
    var vw   = isFiniteNum(dims && dims.vw) ? dims.vw  : 0;
    var vh   = isFiniteNum(dims && dims.vh) ? dims.vh  : 0;
    var tw   = isFiniteNum(dims && dims.tw) ? dims.tw  : 0;
    var th   = isFiniteNum(dims && dims.th) ? dims.th  : 0;

    var maxLeft = Math.max(0, vw - tw);
    var maxTop  = Math.max(0, vh - th);

    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top:  Math.max(0, Math.min(top,  maxTop)),
    };
  }

  // ---------------------------------------------------------------------------
  // serializeToolbarPos
  // ---------------------------------------------------------------------------

  /**
   * serializeToolbarPos(pos) → { left, top } | null
   *
   * Validates that pos has finite numeric left and top.
   * Returns a plain { left, top } suitable for chrome.storage.local.set, or
   * null when either field is missing / non-numeric / non-finite.
   * Never throws.
   */
  function serializeToolbarPos(pos) {
    if (
      pos !== null &&
      typeof pos === "object" &&
      isFiniteNum(pos.left) &&
      isFiniteNum(pos.top)
    ) {
      return { left: pos.left, top: pos.top };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // parseStoredPos
  // ---------------------------------------------------------------------------

  /**
   * parseStoredPos(raw) → { left, top } | null
   *
   * Guards a value read back from chrome.storage.local.
   * Returns { left, top } when raw is an object with finite numeric left and
   * top; returns null for any other value (null, undefined, wrong type,
   * NaN/Infinity fields, extra garbage).
   * Never throws.
   */
  function parseStoredPos(raw) {
    try {
      if (
        raw !== null &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        isFiniteNum(raw.left) &&
        isFiniteNum(raw.top)
      ) {
        return { left: raw.left, top: raw.top };
      }
    } catch (_) {
      // Swallow unexpected errors — never throw on garbage input.
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // nextVisibility
  // ---------------------------------------------------------------------------

  /**
   * nextVisibility(shown) → Boolean
   *
   * Pure toggle: returns !shown.
   * Coerces the input to boolean first so non-boolean truthy/falsy works correctly.
   */
  function nextVisibility(shown) {
    return !shown;
  }

  // ---------------------------------------------------------------------------
  // layerVisibility
  // ---------------------------------------------------------------------------

  /**
   * layerVisibility(shown) → { annVisible: Boolean, selectVisible: Boolean }
   *
   * Derives the desired Konva layer visibility flags from a single "annotations
   * shown" boolean. The selection chrome (Konva.Transformer on selectLayer) tracks
   * annLayer — it is hidden whenever annotations are hidden so resize handles
   * cannot float over a hidden annotation layer.
   *
   * Contract (frozen — fe-002/fe-003 consumers):
   *   shown === true  → { annVisible: true,  selectVisible: true  }
   *   shown === false → { annVisible: false, selectVisible: false }
   */
  function layerVisibility(shown) {
    var visible = !!shown;
    return { annVisible: visible, selectVisible: visible };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    clampToViewport:    clampToViewport,
    serializeToolbarPos: serializeToolbarPos,
    parseStoredPos:     parseStoredPos,
    nextVisibility:     nextVisibility,
    layerVisibility:    layerVisibility,
  };
});
