/**
 * Unit tests for the text-box geometry model item — STORY-fe-001.
 *
 * Runs via: node --test extension/editor.textbox.test.mjs
 *           (or cumulative: node --test extension/*.test.mjs)
 *
 * Strategy: import the UNMODIFIED editor-model.js CJS module directly.
 * Tests cover the pure data invariants of the new geometry-bearing text item:
 *   1. projectAnnotations strips width/height (byte-frozen projection)
 *   2. deserializeModel → serializeModel round-trip is identity (lossless)
 *
 * No Konva / DOM / chrome references — pure data-transform tests only.
 * Auto-fit/wrap/canvas interactions are browser-tester E2E lane (Konva-dependent).
 *
 * ACs verified:
 *   STORY-fe-001 §Unit tests (pure node lane)
 *   feature.md §Acceptance criteria: lossy projection byte-frozen + lossless round-trip
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import editorModel from "./content/editor-model.js";

const { serializeModel, projectAnnotations, deserializeModel } = editorModel;

// ---------------------------------------------------------------------------
// Fixture: a text item carrying box geometry (fe-001 model shape)
// ---------------------------------------------------------------------------

const boxTextItem = {
  id: "t2",
  type: "text",
  x: 50.7,
  y: 60.3,
  width: 200,
  height: 90,
  text: "hi",
};

// ---------------------------------------------------------------------------
// Test 1: projectAnnotations strips width/height from a box-geometry text item
// ---------------------------------------------------------------------------

test("projection strips width/height from a box-geometry text item", function () {
  var result = projectAnnotations([boxTextItem]);
  assert.equal(result.length, 1, "exactly one projected annotation");
  var proj = result[0];

  // Byte-frozen shape: only {id, type, x, y, text} — no width/height
  assert.deepEqual(
    Object.keys(proj).sort(),
    ["id", "text", "type", "x", "y"],
    "projected keys must be exactly {id, text, type, x, y} — no width/height leak"
  );

  // Field values: x/y are Math.round'd, text is verbatim
  assert.equal(proj.id,   boxTextItem.id);
  assert.equal(proj.type, "text");
  assert.equal(proj.x,    Math.round(boxTextItem.x));  // 51
  assert.equal(proj.y,    Math.round(boxTextItem.y));  // 60
  assert.equal(proj.text, boxTextItem.text);

  // Explicit no-leak assertions
  assert.equal(proj.width,  undefined, "width must NOT appear in the projection");
  assert.equal(proj.height, undefined, "height must NOT appear in the projection");
});

test("projection byte-frozen shape — x/y rounded correctly", function () {
  var result = projectAnnotations([{ id: "t3", type: "text", x: 50.7, y: 60.3, width: 200, height: 90, text: "hi" }]);
  assert.deepEqual(result, [{ id: "t3", type: "text", x: 51, y: 60, text: "hi" }]);
});

test("projection of box-text item matches pure-text item shape (no structural difference)", function () {
  var withBox    = projectAnnotations([{ id: "t4", type: "text", x: 10, y: 20, width: 100, height: 50, text: "a" }]);
  var withoutBox = projectAnnotations([{ id: "t4", type: "text", x: 10, y: 20, text: "a" }]);
  assert.deepEqual(
    Object.keys(withBox[0]).sort(),
    Object.keys(withoutBox[0]).sort(),
    "box-geometry text and point-text project to the same key set"
  );
  assert.deepEqual(withBox, withoutBox, "projected value is identical — width/height are fully stripped");
});

// ---------------------------------------------------------------------------
// Test 2: box-geometry text item round-trips identically through serialize/deserialize
// ---------------------------------------------------------------------------

test("box-geometry text item round-trips identically (lossless model round-trip)", function () {
  var model = [boxTextItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model, "model → serializeModel → deserializeModel must be identity (deepEquals)");
});

test("box-geometry text item — all fields survive round-trip verbatim", function () {
  var item = { id: "t5", type: "text", x: 50, y: 60, width: 200, height: 90, text: "hello world" };
  var rt = deserializeModel(serializeModel([item]));
  assert.equal(rt[0].x,      item.x);
  assert.equal(rt[0].y,      item.y);
  assert.equal(rt[0].width,  item.width);
  assert.equal(rt[0].height, item.height);
  assert.equal(rt[0].text,   item.text);
  assert.equal(rt[0].id,     item.id);
  assert.equal(rt[0].type,   item.type);
});

test("round-trip is a deep clone — mutations to the deserialized item do not affect the source", function () {
  var model = [{ id: "t6", type: "text", x: 10, y: 20, width: 100, height: 50, text: "clone test" }];
  var serialized = serializeModel(model);
  var rt = deserializeModel(serialized);
  rt[0].x = 999;
  var rt2 = deserializeModel(serialized);
  assert.equal(rt2[0].x, 10, "deep clone: mutation of deserialized item must not affect the serialized payload");
});

test("round-trip with multiple items including a box-text item preserves all items", function () {
  var arrowItem = { id: "a1", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100 };
  var boxItem   = { id: "b1", type: "box",   x: 10, y: 10, width: 50, height: 30 };
  var textItem  = { id: "t7", type: "text",  x: 20, y: 20, width: 200, height: 80, text: "mixed" };
  var model = [arrowItem, boxItem, textItem];
  var rt = deserializeModel(serializeModel(model));
  assert.deepEqual(rt, model, "all item types survive round-trip with no drift");
});
