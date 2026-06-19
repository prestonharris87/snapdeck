/**
 * Unit tests for extension/content/editor-model.js — pure model-transform module.
 * (STORY-fe-005)
 *
 * Runs via: node --test extension/editor.model.test.mjs
 *           (or cumulative: node --test extension/*.test.mjs)
 *
 * Strategy: import the CJS module directly (zero-dep UMD wrapper exposes module.exports
 * in Node CJS mode; ESM import yields it as the default export).
 * NO Konva / DOM / chrome references — pure data-transform tests only.
 *
 * ACs verified:
 *   fe-005 §How we validate it was done correctly (all 7 items)
 *   fe-003 §Unit tests (node lane: round-trip identity + projection byte-frozen)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import editorModel from "./content/editor-model.js";

const { serializeModel, projectAnnotations, deserializeModel, MODEL_VERSION } = editorModel;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const arrowItem = { id: "a1", type: "arrow", x1: 100.4, y1: 120.6, x2: 240.1, y2: 200.9 };
const boxItem   = { id: "b1", type: "box",   x: 300.0, y: 80.0, width: 160.0, height: 90.0 };
const textItem  = { id: "t1", type: "text",  x: 50.7,  y: 60.3, text: "hello" };

// ---------------------------------------------------------------------------
// serializeModel
// ---------------------------------------------------------------------------

test("serializeModel returns versioned deep clone — version field is correct", function () {
  var result = serializeModel([arrowItem]);
  assert.equal(result.version, MODEL_VERSION);
  assert.equal(result.version, 1);
});

test("serializeModel returns versioned deep clone — items is a deep clone", function () {
  var model = [{ id: "a1", type: "arrow", x1: 10, y1: 20, x2: 30, y2: 40 }];
  var result = serializeModel(model);
  // Mutating source after call must not affect result
  model[0].x1 = 999;
  assert.equal(result.items[0].x1, 10, "deep clone: mutation of source must not affect result");
});

test("serializeModel handles empty model", function () {
  var result = serializeModel([]);
  assert.deepEqual(result, { version: 1, items: [] });
});

test("serializeModel handles null/undefined model gracefully", function () {
  var r1 = serializeModel(null);
  assert.deepEqual(r1, { version: 1, items: [] });
  var r2 = serializeModel(undefined);
  assert.deepEqual(r2, { version: 1, items: [] });
});

// ---------------------------------------------------------------------------
// projectAnnotations — byte-frozen output (fe-003 §Unit tests, fe-005 AC)
// ---------------------------------------------------------------------------

test("projectAnnotations byte-frozen vs fixture — arrow item", function () {
  var result = projectAnnotations([arrowItem]);
  // Must match original editor.js:220-223 output exactly (field names, order, Math.round)
  assert.deepEqual(result, [
    { id: "a1", type: "arrow", from: [100, 121], to: [240, 201] },
  ]);
});

test("projectAnnotations byte-frozen vs fixture — text item", function () {
  var result = projectAnnotations([textItem]);
  assert.deepEqual(result, [
    { id: "t1", type: "text", x: 51, y: 60, text: "hello" },
  ]);
});

test("projectAnnotations byte-frozen vs fixture — arrow + text (mixed model)", function () {
  var model = [arrowItem, textItem];
  var result = projectAnnotations(model);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { id: "a1", type: "arrow", from: [100, 121], to: [240, 201] });
  assert.deepEqual(result[1], { id: "t1", type: "text", x: 51, y: 60, text: "hello" });
});

test("projectAnnotations excludes box items (never projected)", function () {
  var model = [arrowItem, boxItem, textItem];
  var result = projectAnnotations(model);
  // Box must not appear; arrow and text unchanged
  assert.equal(result.length, 2);
  assert.ok(result.every(function (r) { return r.type !== "box"; }), "box must be excluded from projection");
  assert.deepEqual(result[0], { id: "a1", type: "arrow", from: [100, 121], to: [240, 201] });
  assert.deepEqual(result[1], { id: "t1", type: "text", x: 51, y: 60, text: "hello" });
});

test("projectAnnotations returns empty array for box-only model", function () {
  var result = projectAnnotations([boxItem]);
  assert.deepEqual(result, []);
});

test("projectAnnotations returns empty array for empty model", function () {
  assert.deepEqual(projectAnnotations([]), []);
});

test("projectAnnotations handles null/undefined gracefully", function () {
  assert.deepEqual(projectAnnotations(null), []);
  assert.deepEqual(projectAnnotations(undefined), []);
});

// ---------------------------------------------------------------------------
// deserializeModel — guard + opaque pass-through (fe-005 ACs + fe-003 node lane)
// ---------------------------------------------------------------------------

test("deserializeModel guards invalid payloads — null returns []", function () {
  assert.deepEqual(deserializeModel(null), []);
});

test("deserializeModel guards invalid payloads — undefined returns []", function () {
  assert.deepEqual(deserializeModel(undefined), []);
});

test("deserializeModel guards invalid payloads — missing version returns []", function () {
  assert.deepEqual(deserializeModel({ items: [arrowItem] }), []);
});

test("deserializeModel guards invalid payloads — wrong version returns []", function () {
  assert.deepEqual(deserializeModel({ version: 99, items: [arrowItem] }), []);
});

test("deserializeModel guards invalid payloads — non-array items returns []", function () {
  assert.deepEqual(deserializeModel({ version: 1, items: "bad" }), []);
  assert.deepEqual(deserializeModel({ version: 1, items: null }), []);
});

test("deserializeModel never throws on invalid payloads", function () {
  // Should not throw for any of these
  assert.doesNotThrow(function () { deserializeModel(null); });
  assert.doesNotThrow(function () { deserializeModel({ version: "bad" }); });
  assert.doesNotThrow(function () { deserializeModel({ version: 1, items: 42 }); });
  assert.doesNotThrow(function () { deserializeModel(42); });
  assert.doesNotThrow(function () { deserializeModel("string"); });
});

test("deserializeModel returns a deep clone (mutations do not affect result)", function () {
  var payload = { version: 1, items: [{ id: "a1", type: "arrow", x1: 10, y1: 20, x2: 30, y2: 40 }] };
  var result = deserializeModel(payload);
  payload.items[0].x1 = 999;
  assert.equal(result[0].x1, 10, "deep clone: mutation of source must not affect result");
});

// ---------------------------------------------------------------------------
// Round-trip identity (fe-005 + fe-003 §Unit tests)
// ---------------------------------------------------------------------------

test("round-trip identity (serialize→deserialize) — arrow item", function () {
  var model = [arrowItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model);
});

test("round-trip identity (serialize→deserialize) — box item", function () {
  var model = [boxItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model);
});

test("round-trip identity (serialize→deserialize) — text item", function () {
  var model = [textItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model);
});

test("round-trip identity (serialize→deserialize) — arrow + box + text", function () {
  var model = [arrowItem, boxItem, textItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model, "full model round-trips with no geometry/content drift");
});

// ---------------------------------------------------------------------------
// Opaque subtype fields survive round-trip (forward-compat for w1/w2)
// ---------------------------------------------------------------------------

test("opaque subtype fields survive round-trip — unknown fields preserved", function () {
  var itemWithExtra = { id: "b2", type: "box", x: 10, y: 20, width: 100, height: 50, fontSize: 18, fill: "white" };
  var model = [itemWithExtra];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt[0], itemWithExtra, "w1/w2 subtype fields must survive serialize→deserialize unchanged");
});

// ---------------------------------------------------------------------------
// Render-boundary guard: deserializeModel passes malformed items through opaquely.
// The actual coerce/skip logic lives in renderBox/renderArrow (editor.js render boundary,
// fe-004 — Konva-render-dependent, browser-tester E2E lane).
// These tests verify the PRECONDITION: that deserializeModel does NOT throw on malformed
// item fields and passes them through, so the render boundary has a chance to guard them.
// ---------------------------------------------------------------------------

test("deserializeModel passes items with NaN/Infinity geometry through opaquely (no throw)", function () {
  // Note: the clone uses JSON.parse(JSON.stringify()) — NaN and Infinity serialize to null per JSON spec.
  // String values are valid JSON and round-trip unchanged. The key property is: NO THROW, item count preserved.
  var badGeom = { id: "b99", type: "box", x: NaN, y: 0, width: "120", height: Infinity };
  var payload = { version: 1, items: [badGeom] };
  assert.doesNotThrow(function () { deserializeModel(payload); });
  var result = deserializeModel(payload);
  assert.equal(result.length, 1, "malformed item passes through (render boundary is caller's concern)");
  // NaN and Infinity become null via JSON round-trip (JSON spec behavior; render guard handles at render time)
  assert.equal(result[0].x, null, "NaN→null via JSON clone (no validation in deserializeModel)");
  assert.equal(result[0].height, null, "Infinity→null via JSON clone (no validation in deserializeModel)");
  assert.equal(result[0].width, "120", "string width passes through opaquely");
});

test("deserializeModel passes large item arrays through opaquely (count cap is render boundary's concern)", function () {
  // generate a big items array; deserializeModel must not throw or truncate
  var items = [];
  for (var i = 0; i < 600; i++) {
    items.push({ id: "x" + i, type: "arrow", x1: i, y1: 0, x2: i + 10, y2: 10 });
  }
  var payload = { version: 1, items: items };
  assert.doesNotThrow(function () { deserializeModel(payload); });
  var result = deserializeModel(payload);
  assert.equal(result.length, 600, "deserializeModel does not cap item count (render boundary caps it)");
});

test("deserializeModel passes items with oversized text through opaquely (text cap is render boundary's concern)", function () {
  var bigText = "x".repeat(50000);
  var payload = { version: 1, items: [{ id: "t99", type: "text", x: 10, y: 20, text: bigText }] };
  assert.doesNotThrow(function () { deserializeModel(payload); });
  var result = deserializeModel(payload);
  assert.equal(result[0].text.length, 50000, "deserializeModel does not cap text length (render boundary caps it)");
});
