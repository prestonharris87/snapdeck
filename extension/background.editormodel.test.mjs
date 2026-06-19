/**
 * Unit tests for background.js lossless editor-model persistence (STORY-be-001)
 *
 * Runs via: node --test extension/background.editormodel.test.mjs
 *           (or: node --test extension/*.test.mjs — cumulative with siblings)
 *
 * Strategy:
 *   Load background.js source into a node:vm context pre-seeded with hand-written
 *   chrome + in-memory indexedDB + fetch stubs BEFORE evaluation.  Drive the real
 *   addScreenshot() and saveReport() through the chrome.runtime.onMessage listener
 *   seam (captured at load time) — zero production refactor, no exports added.
 *
 * ACs verified (STORY-be-001):
 *   addScreenshot_storesModelVerbatim_onScreenshotRecord
 *   addScreenshot_defaultsModelToNull_whenResolveOmitsModel
 *   addScreenshot_preservesExistingNineFields_whenAddingModel
 *   saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel
 *   saveReport_upstreamPayloadByteIdentical_forSameAnnotations
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

// ---------------------------------------------------------------------------
// Mutable test-scoped state (reset in beforeEach)
// ---------------------------------------------------------------------------
let _kv            = {};   // in-memory kv backing store
let _mockTabUrl    = 'http://localhost:5101/';
let _captureVisibleTabFn = () => Promise.resolve('data:image/png;base64,FAKE');
let _sendMessageFn       = () => Promise.resolve(null);

// ---------------------------------------------------------------------------
// In-memory IndexedDB stub (mirrors background.reports.test.mjs pattern)
// ---------------------------------------------------------------------------
function _makeReq(getValue) {
  const req = {};
  queueMicrotask(() => {
    try {
      req.result = getValue();
      req.onsuccess && req.onsuccess();
    } catch (e) {
      req.error = e;
      req.onerror && req.onerror();
    }
  });
  return req;
}

const _idbStub = {
  open(_name, _version) {
    return _makeReq(() => ({
      createObjectStore() {},
      transaction(_storeName, _mode) {
        return {
          objectStore() {
            return {
              get(key)      { return _makeReq(() => _kv[key]); },
              put(val, key) { return _makeReq(() => { _kv[key] = val; }); },
            };
          },
        };
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// Chrome API stubs
// ---------------------------------------------------------------------------
let _onMessageListener = null;

const _chromeMock = {
  runtime: {
    onMessage: {
      addListener(cb) { _onMessageListener = cb; },
    },
  },
  // no-op for chrome.commands.onCommand.addListener (registered by keyboard-shortcuts merge)
  commands: {
    onCommand: { addListener() {} },
  },
  tabs: {
    query() {
      if (_mockTabUrl === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 1, url: _mockTabUrl, windowId: 1 }]);
    },
    captureVisibleTab(windowId, opts) { return _captureVisibleTabFn(windowId, opts); },
    sendMessage(tabId, msg)           { return _sendMessageFn(tabId, msg); },
  },
  // Minimal action stubs so runCaptureCommand() doesn't throw if invoked
  action: {
    setBadgeText()           {},
    setBadgeBackgroundColor(){},
    setTitle()               {},
  },
};

// ---------------------------------------------------------------------------
// Default fetch stub: accepts /resolve discovery and /report/save POSTs.
// Per-test overrides assign to sandbox.fetch directly.
// ---------------------------------------------------------------------------
function _makeFetchStub(onSave) {
  return function fakeFetch(url, opts) {
    const urlStr = url.toString();
    if (urlStr.includes('/resolve')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      });
    }
    if (urlStr.includes('/report/save')) {
      if (onSave) onSave(opts);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      });
    }
    return Promise.reject(new Error('unexpected fetch: ' + urlStr));
  };
}

// ---------------------------------------------------------------------------
// Build the vm sandbox and run background.js inside it once.
// ---------------------------------------------------------------------------
const sandbox = vm.createContext({
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  console,
  fetch: _makeFetchStub(null),
  chrome:    _chromeMock,
  indexedDB: _idbStub,
});

vm.runInContext(bgSrc, sandbox);

// Sanity-check: the onMessage listener must have been registered at module scope.
assert.ok(
  _onMessageListener !== null,
  'background.js must call chrome.runtime.onMessage.addListener at the top level'
);

// ---------------------------------------------------------------------------
// Cross-context helper: JSON round-trip strips vm-context prototypes so that
// deepStrictEqual compares values, not Object/Array constructor identity.
// ---------------------------------------------------------------------------
const toPlain = v => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Dispatch an extension message through the captured onMessage listener and
// return a Promise that resolves to whatever sendResponse receives.
// ---------------------------------------------------------------------------
function sendMsg(msg) {
  return new Promise((resolve) => {
    _onMessageListener(msg, {}, resolve);
  });
}

// ---------------------------------------------------------------------------
// beforeEach — reset mutable state for every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  _kv              = {};
  _mockTabUrl      = 'http://localhost:5101/';
  _captureVisibleTabFn = () => Promise.resolve('data:image/png;base64,FAKE');
  _sendMessageFn       = () => Promise.resolve(null);
  sandbox.fetch    = _makeFetchStub(null);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MODEL_FIXTURE = {
  version: 1,
  items: [
    { id: 'a', type: 'arrow', x1: 1, y1: 2, x2: 3, y2: 4 },
    { id: 'b', type: 'box',   x: 5,  y: 6,  width: 7, height: 8 },
  ],
};

/** Base ANNOTATE resolve payload (the editor→background resolve shape from STORY-fe-003). */
const ANNOTATE_RESP_BASE = {
  meta: {
    url: 'http://localhost:5101/',
    title: 'Test Page',
    captured_at: '2026-01-01T00:00:00.000Z',
    viewport: { w: 1280, h: 720, dpr: 1 },
  },
  original:    'data:image/png;base64,orig',
  annotated:   'data:image/png;base64,ann',
  annotations: [{ id: 'a', type: 'arrow', from: [1, 2], to: [3, 4] }],
  console:     [],
  network:     [],
};

// ===========================================================================
// Tests
// ===========================================================================

/**
 * addScreenshot_storesModelVerbatim_onScreenshotRecord
 *
 * When the resolve payload carries a `model`, the stored screenshots[].model
 * deep-equals it exactly — verbatim and opaque (no enumeration/whitelisting).
 */
test('addScreenshot_storesModelVerbatim_onScreenshotRecord', async () => {
  _sendMessageFn = () => Promise.resolve({ ...ANNOTATE_RESP_BASE, model: MODEL_FIXTURE });

  const result = await sendMsg({ type: 'ADD_SCREENSHOT' });

  assert.ok(result && result.ok, 'ADD_SCREENSHOT must succeed');
  const record = _kv['report:5101'];
  assert.ok(record, 'report:5101 must be written to kv');
  assert.strictEqual(record.screenshots.length, 1, 'exactly one screenshot must be stored');
  assert.deepStrictEqual(
    toPlain(record.screenshots[0].model),
    MODEL_FIXTURE,
    'stored model must deep-equal the resolve payload model verbatim'
  );
});

/**
 * addScreenshot_defaultsModelToNull_whenResolveOmitsModel
 *
 * When the resolve payload has no `model` field (legacy / pre-fe-003 content script),
 * the stored screenshots[].model must be exactly `null` — not `undefined`, not absent.
 */
test('addScreenshot_defaultsModelToNull_whenResolveOmitsModel', async () => {
  // Spread ANNOTATE_RESP_BASE — no `model` key present
  _sendMessageFn = () => Promise.resolve({ ...ANNOTATE_RESP_BASE });

  await sendMsg({ type: 'ADD_SCREENSHOT' });

  const s = _kv['report:5101'].screenshots[0];
  assert.ok('model' in s, 'model key must be present on the stored record (even when null)');
  assert.strictEqual(s.model, null, 'model must be null when resolve payload omits the field');
});

/**
 * addScreenshot_preservesExistingNineFields_whenAddingModel
 *
 * The 9 pre-existing fields on the per-screenshot record are unchanged in name,
 * value, and shape after the model property is added.
 */
test('addScreenshot_preservesExistingNineFields_whenAddingModel', async () => {
  _sendMessageFn = () => Promise.resolve({ ...ANNOTATE_RESP_BASE, model: MODEL_FIXTURE });

  await sendMsg({ type: 'ADD_SCREENSHOT' });

  const s = _kv['report:5101'].screenshots[0];

  // Verify all 9 pre-existing fields are present and correct
  assert.strictEqual(s.url,         ANNOTATE_RESP_BASE.meta.url,          'url must match meta.url');
  assert.strictEqual(s.title,       ANNOTATE_RESP_BASE.meta.title,        'title must match meta.title');
  assert.strictEqual(s.captured_at, ANNOTATE_RESP_BASE.meta.captured_at,  'captured_at must match meta.captured_at');
  assert.deepStrictEqual(toPlain(s.viewport),    ANNOTATE_RESP_BASE.meta.viewport, 'viewport must match meta.viewport');
  assert.strictEqual(s.original,    ANNOTATE_RESP_BASE.original,           'original must match resp.original');
  assert.strictEqual(s.annotated,   ANNOTATE_RESP_BASE.annotated,          'annotated must match resp.annotated');
  assert.deepStrictEqual(toPlain(s.annotations), ANNOTATE_RESP_BASE.annotations, 'annotations must match resp.annotations');
  assert.deepStrictEqual(toPlain(s.console),     ANNOTATE_RESP_BASE.console,     'console must match resp.console');
  assert.deepStrictEqual(toPlain(s.network),     ANNOTATE_RESP_BASE.network,     'network must match resp.network');
});

/**
 * saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel
 *
 * The /report/save POST body's screenshots[0] must have NO `model` key and must
 * carry exactly the 9 frozen projection fields — locking the byte-frozen-upstream
 * invariant at the storage layer.
 */
test('saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel', async () => {
  // Seed the kv store directly — bypass addScreenshot so this test is independent
  _kv['report:5101'] = {
    note: '',
    screenshots: [{
      url:         'http://localhost:5101/',
      title:       'Test Page',
      captured_at: '2026-01-01T00:00:00.000Z',
      viewport:    { w: 1280, h: 720, dpr: 1 },
      original:    'data:image/png;base64,orig',
      annotated:   'data:image/png;base64,ann',
      annotations: [],
      console:     [],
      network:     [],
      model:       MODEL_FIXTURE,   // ← must NOT appear in the upstream payload
    }],
  };

  let capturedBody = null;
  sandbox.fetch = _makeFetchStub((opts) => {
    capturedBody = JSON.parse(opts.body);
  });

  const result = await sendMsg({ type: 'SAVE_REPORT' });

  assert.ok(result && result.ok, 'SAVE_REPORT must succeed');
  assert.ok(capturedBody, 'fetch must have been called with a POST body');

  const s = capturedBody.screenshots[0];

  // model must not be present
  assert.ok(!('model' in s), 'model must NOT appear in the /report/save upstream payload');

  // Exact 9-field key-set lock (sorted for stability)
  const FROZEN_KEYS = [
    'annotations', 'annotated_png_b64', 'captured_at', 'console',
    'network_failures', 'original_png_b64', 'title', 'url', 'viewport',
  ].sort();
  assert.deepStrictEqual(
    Object.keys(s).sort(),
    FROZEN_KEYS,
    'upstream screenshots[0] must have exactly the 9 frozen projection fields'
  );
});

/**
 * saveReport_upstreamPayloadByteIdentical_forSameAnnotations
 *
 * The full /report/save POST body matches a frozen expected payload object for
 * a record that carries a `model` — proving the projection bytes did not drift.
 */
test('saveReport_upstreamPayloadByteIdentical_forSameAnnotations', async () => {
  const annotations = [{ id: 'a', type: 'arrow', from: [10, 20], to: [30, 40] }];
  const consoleEntries = [{ level: 'log', text: 'hello' }];
  const networkEntries = [{ url: 'http://localhost:5101/fail', status: 404 }];

  _kv['report:5101'] = {
    note: 'test note',
    screenshots: [{
      url:         'http://localhost:5101/',
      title:       'Test Page',
      captured_at: '2026-06-18T00:00:00.000Z',
      viewport:    { w: 1280, h: 720, dpr: 1 },
      original:    'data:image/png;base64,orig',
      annotated:   'data:image/png;base64,ann',
      annotations,
      console:     consoleEntries,
      network:     networkEntries,
      model:       MODEL_FIXTURE,   // present locally; must be absent from upstream
    }],
  };

  const expectedPayload = {
    browser_port: 5101,
    note: 'test note',
    screenshots: [{
      url:               'http://localhost:5101/',
      title:             'Test Page',
      captured_at:       '2026-06-18T00:00:00.000Z',
      viewport:          { w: 1280, h: 720, dpr: 1 },
      original_png_b64:  'data:image/png;base64,orig',
      annotated_png_b64: 'data:image/png;base64,ann',
      annotations,
      console:           consoleEntries,
      network_failures:  networkEntries,
      // NO model key
    }],
  };

  let capturedBody = null;
  sandbox.fetch = _makeFetchStub((opts) => {
    capturedBody = JSON.parse(opts.body);
  });

  await sendMsg({ type: 'SAVE_REPORT' });

  assert.ok(capturedBody, 'fetch must have been called with a POST body');
  assert.deepStrictEqual(
    capturedBody,
    expectedPayload,
    'upstream /report/save payload must be byte-identical to expected (no drift from model addition)'
  );
});
