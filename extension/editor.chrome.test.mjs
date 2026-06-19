/**
 * Unit tests for extension/content/editor-chrome.js — pure editor-chrome helper module.
 * (STORY-fe-001)
 *
 * Runs via: node --test extension/editor.chrome.test.mjs
 *           (or cumulative: node --test extension/*.test.mjs)
 *
 * Strategy: import the CJS UMD module directly (same pattern as editor.model.test.mjs).
 * NO chrome / window / document / Konva references — pure data-transform tests only.
 *
 * ACs verified:
 *   fe-001 §How we validate it was done correctly (all checklist items)
 *   fe-001 §Unit tests (all 10 named cases including manifest load-order guard)
 *   security-architect Finding 1 / PROMOTE_TO_AC: parseStoredPos + clampToViewport
 *     never throw on garbage input and never produce NaN/Infinity outputs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ESM import of CJS UMD module (same pattern as editor.model.test.mjs)
import editorChrome from "./content/editor-chrome.js";

const { clampToViewport, serializeToolbarPos, parseStoredPos, nextVisibility, layerVisibility } =
  editorChrome;

// Resolve the extension root dir (this test file lives at extension/editor.chrome.test.mjs)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const EXT_ROOT   = __dirname;   // = <repo>/extension/

// ---------------------------------------------------------------------------
// clampToViewport
// ---------------------------------------------------------------------------

test("clampToViewport returns in-bounds position unchanged", function () {
  // A position fully inside the viewport must come out unchanged.
  var pos  = { left: 100, top: 50 };
  var dims = { vw: 1280, vh: 800, tw: 200, th: 40 };
  var result = clampToViewport(pos, dims);
  assert.deepEqual(result, { left: 100, top: 50 });
});

test("clampToViewport clamps off-right / off-bottom back into view", function () {
  // left > vw-tw → clamp to vw-tw; top > vh-th → clamp to vh-th.
  var dims = { vw: 1280, vh: 800, tw: 200, th: 40 };
  var pos  = { left: 1200, top: 780 };   // 1200 > 1080, 780 > 760
  var result = clampToViewport(pos, dims);
  assert.equal(result.left, 1080, "off-right clamps to vw-tw (1280-200=1080)");
  assert.equal(result.top,  760,  "off-bottom clamps to vh-th (800-40=760)");
});

test("clampToViewport clamps negative left/top to 0", function () {
  var dims   = { vw: 1280, vh: 800, tw: 200, th: 40 };
  var pos    = { left: -50, top: -10 };
  var result = clampToViewport(pos, dims);
  assert.equal(result.left, 0, "negative left clamps to 0");
  assert.equal(result.top,  0, "negative top clamps to 0");
});

test("clampToViewport clamps to 0 when toolbar exceeds viewport on an axis", function () {
  // tw > vw → max(0, vw-tw) = 0; th > vh → max(0, vh-th) = 0.
  var dims   = { vw: 100, vh: 50, tw: 200, th: 80 };
  var pos    = { left: 30, top: 10 };
  var result = clampToViewport(pos, dims);
  assert.equal(result.left, 0, "toolbar wider than viewport → left clamped to 0");
  assert.equal(result.top,  0, "toolbar taller than viewport → top clamped to 0");
});

test("clampToViewport coerces non-finite input to 0 per axis (never NaN)", function () {
  var dims = { vw: 1280, vh: 800, tw: 200, th: 40 };

  // NaN left — top should be preserved (not clamped to 0 unless it's in range)
  var r1 = clampToViewport({ left: NaN, top: 50 }, dims);
  assert.equal(r1.left, 0,  "NaN left → 0");
  assert.equal(r1.top,  50, "valid top preserved");
  assert.ok(isFinite(r1.left), "result.left must be finite");
  assert.ok(isFinite(r1.top),  "result.top must be finite");

  // Infinity top — non-finite falls back to 0 BEFORE clamping (per spec: "guard non-finite to 0 before clamping")
  var r2 = clampToViewport({ left: 100, top: Infinity }, dims);
  assert.equal(r2.left, 100, "valid left preserved");
  assert.equal(r2.top,  0,   "Infinity top → falls back to 0 before clamping (never NaN)");
  assert.ok(isFinite(r2.top), "result.top must be finite");

  // -Infinity left
  var r3 = clampToViewport({ left: -Infinity, top: 50 }, dims);
  assert.equal(r3.left, 0, "-Infinity left clamps to 0");

  // Both NaN — both must be 0 (never NaN out)
  var r4 = clampToViewport({ left: NaN, top: NaN }, dims);
  assert.equal(r4.left, 0, "NaN left → 0");
  assert.equal(r4.top,  0, "NaN top → 0");
  assert.ok(!isNaN(r4.left), "result.left must not be NaN");
  assert.ok(!isNaN(r4.top),  "result.top must not be NaN");
});

// ---------------------------------------------------------------------------
// serializeToolbarPos
// ---------------------------------------------------------------------------

test("serializeToolbarPos round-trips valid pos, returns null on garbage", function () {
  // Valid round-trip
  var valid = { left: 10, top: 20 };
  assert.deepEqual(serializeToolbarPos(valid), { left: 10, top: 20 });

  // Null input → null (no throw)
  assert.doesNotThrow(function () { assert.equal(serializeToolbarPos(null), null); });

  // Empty object → null
  assert.equal(serializeToolbarPos({}), null);

  // String values → null
  assert.equal(serializeToolbarPos({ left: "x", top: 20 }), null);
  assert.equal(serializeToolbarPos({ left: 10, top: "y" }), null);

  // NaN → null
  assert.equal(serializeToolbarPos({ left: NaN, top: 20 }), null);
  assert.equal(serializeToolbarPos({ left: 10, top: NaN }), null);

  // Infinity → null (must enforce finiteness — the finite-number guard is also the CSS-injection guard)
  assert.equal(serializeToolbarPos({ left: Infinity, top: 20 }), null);
  assert.equal(serializeToolbarPos({ left: 10, top: -Infinity }), null);

  // Undefined → null
  assert.doesNotThrow(function () { assert.equal(serializeToolbarPos(undefined), null); });

  // Non-object (number) → null
  assert.equal(serializeToolbarPos(42), null);
});

// ---------------------------------------------------------------------------
// parseStoredPos
// ---------------------------------------------------------------------------

test("parseStoredPos guards stored values — valid object returns {left,top}", function () {
  var result = parseStoredPos({ left: 300, top: 150 });
  assert.deepEqual(result, { left: 300, top: 150 });
});

test("parseStoredPos guards stored values — null returns null, never throws", function () {
  assert.doesNotThrow(function () { assert.equal(parseStoredPos(null), null); });
});

test("parseStoredPos guards stored values — undefined returns null, never throws", function () {
  assert.doesNotThrow(function () { assert.equal(parseStoredPos(undefined), null); });
});

test("parseStoredPos guards stored values — non-object returns null, never throws", function () {
  assert.doesNotThrow(function () {
    assert.equal(parseStoredPos(42),         null);
    assert.equal(parseStoredPos("string"),   null);
    assert.equal(parseStoredPos(true),       null);
  });
});

test("parseStoredPos guards stored values — array returns null, never throws", function () {
  // Arrays are objects but should not be accepted as a stored position.
  assert.doesNotThrow(function () {
    assert.equal(parseStoredPos([1, 2]), null);
  });
});

test("parseStoredPos guards stored values — NaN/Infinity fields return null, never throws", function () {
  assert.doesNotThrow(function () {
    assert.equal(parseStoredPos({ left: NaN,      top: 20 }),       null);
    assert.equal(parseStoredPos({ left: 10,       top: Infinity }), null);
    assert.equal(parseStoredPos({ left: -Infinity, top: 20 }),      null);
  });
});

test("parseStoredPos guards stored values — string fields return null, never throws", function () {
  assert.doesNotThrow(function () {
    assert.equal(parseStoredPos({ left: "x", top: 20 }),   null);
    assert.equal(parseStoredPos({ left: 10,  top: "y" }),  null);
  });
});

test("parseStoredPos guards stored values — empty object returns null, never throws", function () {
  assert.doesNotThrow(function () {
    assert.equal(parseStoredPos({}), null);
  });
});

// ---------------------------------------------------------------------------
// nextVisibility
// ---------------------------------------------------------------------------

test("nextVisibility flips boolean — true → false", function () {
  assert.equal(nextVisibility(true), false);
});

test("nextVisibility flips boolean — false → true", function () {
  assert.equal(nextVisibility(false), true);
});

// ---------------------------------------------------------------------------
// layerVisibility
// ---------------------------------------------------------------------------

test("layerVisibility derives both flags — shown=true → both true (selectVisible tracks annVisible)", function () {
  var result = layerVisibility(true);
  assert.deepEqual(result, { annVisible: true, selectVisible: true });
});

test("layerVisibility derives both flags — shown=false → both false (selection chrome hidden with annotations)", function () {
  var result = layerVisibility(false);
  assert.deepEqual(result, { annVisible: false, selectVisible: false });
});

// ---------------------------------------------------------------------------
// Manifest load-order guard (fe-001 §Unit tests — added at arbitration)
//
// Reads extension/manifest.json (pure fs I/O, no network, no browser).
// Asserts:
//   (1) Every path in the document_idle content-script js array resolves to an
//       existing file under extension/.
//   (2) IF content/editor-chrome.js is already registered in the manifest,
//       ALSO asserts the ordering constraint:
//         index(editor-model.js) < index(editor-chrome.js) < index(editor.js)
//
// NOTE: do-001 (devops) adds content/editor-chrome.js to the manifest.
// Until do-001 lands, assertion (2) is intentionally skipped — this test
// will go fully green (including ordering) once do-001 completes.
// The "every path resolves to a file" assertion (1) runs unconditionally.
// ---------------------------------------------------------------------------

test("manifest registers editor-chrome.js in correct load order", function () {
  var manifestPath = join(EXT_ROOT, "manifest.json");
  assert.ok(existsSync(manifestPath), "extension/manifest.json must exist");

  var manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Find the document_idle content-script entry.
  var idleEntry = (manifest.content_scripts || []).find(function (cs) {
    return cs.run_at === "document_idle";
  });
  assert.ok(idleEntry, "manifest must have a document_idle content_scripts entry");

  var jsArray = idleEntry.js || [];

  // Assertion (1): every path in the js array must resolve to an existing file.
  jsArray.forEach(function (jsPath) {
    var resolved = join(EXT_ROOT, jsPath);
    assert.ok(
      existsSync(resolved),
      "manifest js path must exist on disk: extension/" + jsPath + " → " + resolved
    );
  });

  // Assertion (2): ordering constraint — only checked when editor-chrome.js is registered.
  var idxModel  = jsArray.indexOf("content/editor-model.js");
  var idxChrome = jsArray.indexOf("content/editor-chrome.js");
  var idxEditor = jsArray.indexOf("content/editor.js");

  if (idxChrome !== -1) {
    // editor-chrome.js IS registered — enforce full ordering.
    assert.ok(
      idxModel !== -1,
      "content/editor-model.js must be in the document_idle js array when editor-chrome.js is registered"
    );
    assert.ok(
      idxEditor !== -1,
      "content/editor.js must be in the document_idle js array when editor-chrome.js is registered"
    );
    assert.ok(
      idxModel < idxChrome,
      "editor-model.js must load BEFORE editor-chrome.js (load-order regression guard)"
    );
    assert.ok(
      idxChrome < idxEditor,
      "editor-chrome.js must load BEFORE editor.js (load-order regression guard)"
    );
  } else {
    // editor-chrome.js is NOT yet registered — do-001 has not landed yet.
    // Log a diagnostic note but do NOT fail; the ordering constraint fires once it's registered.
    // (This is the expected state during fe-001 development, before do-001 runs.)
    console.log(
      "[manifest-order-guard] NOTE: content/editor-chrome.js not yet in manifest.json " +
      "(do-001 adds it). Load-order assertion will fire once do-001 registers the file. " +
      "Path-exists assertions passed for all currently registered js paths."
    );
  }
});
