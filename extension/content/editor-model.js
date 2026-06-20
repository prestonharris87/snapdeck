// editor-model.js — PURE model-transform module (STORY-fe-005).
// No chrome / window / document / Konva. No top-level side effects.
// Dual-consumable: browser content script (isolated-world global) + node --test (CJS require/import).
//
// Three exported functions:
//   serializeModel(model)    → { version:1, items: <deep-clone of model> }
//   projectAnnotations(model)→ lossy annotations[] (byte-frozen; arrow/text byte-identical; box projected w2)
//   deserializeModel(payload)→ model[] (guarded; items pass through OPAQUELY for w1/w2 forward-compat)
//
// Security note (from security-architect): envelope validated here; item-field sanity is a
// render-layer concern — items pass through opaquely for w1/w2 forward-compat. Do NOT add
// per-item field validation here; that would break the ratified opaque forward-compat contract.

(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;                   // node --test (CJS import)
  } else {
    root.__snapdeckEditorModel = api;       // content script (isolated-world global)
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MODEL_VERSION = 1;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /**
   * serializeModel — lossless wire envelope.
   * Returns { version: 1, items: <deep clone of model> }.
   * items is an independent copy — mutating `model` afterward does not change the result.
   */
  function serializeModel(model) {
    return { version: MODEL_VERSION, items: clone(model || []) };
  }

  /**
   * projectAnnotations — byte-frozen lossy projection.
   * Field names, order, and Math.round MUST match exactly per fe-003 byte-frozen contract.
   *   arrow → { id, type:"arrow", from:[round(x1),round(y1)], to:[round(x2),round(y2)] }
   *   text  → { id, type:"text",  x:round(x), y:round(y), text }
   *   box   → { id, type:"box",   x:round(x), y:round(y), width:round(width), height:round(height) }
   *             (w2 rectangle projected; guard mirrors renderBox:324-325 — non-finite or ≤0 skipped)
   */
  function projectAnnotations(model) {
    var result = [];
    (model || []).forEach(function (m) {
      if (m.type === "arrow") {
        result.push({
          id: m.id, type: "arrow",
          from: [Math.round(m.x1), Math.round(m.y1)],
          to:   [Math.round(m.x2), Math.round(m.y2)],
        });
      } else if (m.type === "text") {
        result.push({
          id: m.id, type: "text",
          x: Math.round(m.x), y: Math.round(m.y), text: m.text,
        });
      } else if (m.type === "box") {
        // PO arbitration (INFO#1): mirror renderBox's render-boundary guard so render and projection
        // treat malformed geometry symmetrically — a non-finite or ≤0 box is NOT projected (it is
        // already skipped at render by renderBox:324-325). Pure inline check — do NOT import
        // isFiniteNum from editor.js (this module is dependency-free).
        // COUPLING: controller/_render_markdown in reports.py cases on the same "box" literal
        // (elif a.get("type") == "box") — if the projected type literal ever changes, that branch moves in lockstep.
        var fin = function (n) { return typeof n === "number" && isFinite(n); };
        if (!fin(m.x) || !fin(m.y) || !fin(m.width) || !fin(m.height)) return;
        if (m.width <= 0 || m.height <= 0) return;
        result.push({
          id: m.id, type: "box",
          x: Math.round(m.x), y: Math.round(m.y),
          width: Math.round(m.width), height: Math.round(m.height),
        });
      }
    });
    return result;
  }

  /**
   * deserializeModel — round-trip read side.
   * Returns clone(payload.items) when payload is a valid v1 envelope;
   * otherwise returns [] (never throws).
   * Items pass through OPAQUELY — unknown w1/w2 subtype fields are preserved
   * without validation (forward-compat contract; do not add per-item guards here).
   */
  function deserializeModel(payload) {
    if (
      payload &&
      payload.version === MODEL_VERSION &&
      Array.isArray(payload.items)
    ) {
      return clone(payload.items);
    }
    return [];
  }

  return {
    MODEL_VERSION: MODEL_VERSION,
    serializeModel: serializeModel,
    projectAnnotations: projectAnnotations,
    deserializeModel: deserializeModel,
  };
});
